import { z } from 'zod';
import { eq, and, inArray, isNull, or } from 'drizzle-orm';
import {
  complianceFrameworks,
  complianceAssignments,
  complianceResults,
  complianceFrameworkChecks,
  integrationLinks
} from '@mspbyte/drizzle';
import type { JsonValue } from '@mspbyte/drizzle';
import { t, authProcedure } from '../trpc.js';

type FrameworkRow = typeof complianceFrameworks.$inferSelect;
type CheckRow = typeof complianceFrameworkChecks.$inferSelect;
type AssignmentRow = typeof complianceAssignments.$inferSelect;
type ResultRow = typeof complianceResults.$inferSelect;

export const complianceRouter = t.router({
  // ── Existing procedures ─────────────────────────────────────────────────────

  frameworks: authProcedure
    .input(z.object({ siteId: z.string().optional(), linkId: z.string().optional() }))
    .query(async ({ ctx, input }): Promise<FrameworkRow[]> => {
      let siteId = input.siteId;
      let integrationId: string | undefined;

      if (input.linkId) {
        const [link] = await ctx.db
          .select({ integrationId: integrationLinks.integrationId, siteId: integrationLinks.siteId })
          .from(integrationLinks)
          .where(eq(integrationLinks.id, input.linkId))
          .limit(1);

        integrationId = link?.integrationId;
        siteId ??= link?.siteId ?? undefined;
      }

      if (!integrationId) return [];

      const assignmentConditions = [
        and(isNull(complianceAssignments.siteId), isNull(complianceAssignments.linkId))
      ];
      if (input.linkId) assignmentConditions.push(eq(complianceAssignments.linkId, input.linkId));
      if (siteId) {
        assignmentConditions.push(
          and(eq(complianceAssignments.siteId, siteId), isNull(complianceAssignments.linkId))
        );
      }

      const assignments = await ctx.db
        .select({
          frameworkId: complianceAssignments.frameworkId,
          siteId: complianceAssignments.siteId,
          linkId: complianceAssignments.linkId
        })
        .from(complianceAssignments)
        .innerJoin(complianceFrameworks, eq(complianceFrameworks.id, complianceAssignments.frameworkId))
        .where(
          and(
            eq(complianceFrameworks.integrationId, integrationId),
            or(
              eq(complianceAssignments.integrationId, integrationId),
              isNull(complianceAssignments.integrationId)
            ),
            or(...assignmentConditions)
          )
        );

      if (assignments.length === 0) return [];

      const assignmentsByFramework = new Map<string, typeof assignments>();
      for (const assignment of assignments) {
        const rows = assignmentsByFramework.get(assignment.frameworkId) ?? [];
        rows.push(assignment);
        assignmentsByFramework.set(assignment.frameworkId, rows);
      }

      const frameworkIds = [...assignmentsByFramework.entries()]
        .filter(([, rows]) => {
          const hasGlobal = rows.some((row) => row.siteId === null && row.linkId === null);
          const hasCurrentSpecific = rows.some(
            (row) =>
              (input.linkId && row.linkId === input.linkId) || (siteId && row.siteId === siteId)
          );

          return hasGlobal ? !hasCurrentSpecific : hasCurrentSpecific;
        })
        .map(([frameworkId]) => frameworkId);

      if (frameworkIds.length === 0) return [];

      return ctx.db
        .select()
        .from(complianceFrameworks)
        .where(inArray(complianceFrameworks.id, frameworkIds));
    }),

  results: authProcedure
    .input(z.object({ siteId: z.string().optional(), linkId: z.string().optional(), frameworkId: z.string() }))
    .query(
      async ({ ctx, input }): Promise<Array<{ check: CheckRow; result: ResultRow | null }>> => {
        const checks = await ctx.db
          .select()
          .from(complianceFrameworkChecks)
          .where(eq(complianceFrameworkChecks.frameworkId, input.frameworkId));

        if (checks.length === 0) return [];

        const scopeCondition = input.linkId
          ? eq(complianceResults.linkId, input.linkId)
          : input.siteId
            ? and(eq(complianceResults.siteId, input.siteId), isNull(complianceResults.linkId))
            : and(isNull(complianceResults.siteId), isNull(complianceResults.linkId));

        const results = await ctx.db
          .select()
          .from(complianceResults)
          .where(
            and(
              scopeCondition,
              inArray(
                complianceResults.frameworkCheckId,
                checks.map((c) => c.id)
              )
            )
          );

        return checks.map((check) => ({
          check,
          result: results.find((r) => r.frameworkCheckId === check.id) ?? null
        }));
      }
    ),

  // ── Framework management ────────────────────────────────────────────────────

  listFrameworks: authProcedure
    .input(z.object({ integrationId: z.string() }))
    .query(async ({ ctx, input }): Promise<FrameworkRow[]> => {
      return ctx.db
        .select()
        .from(complianceFrameworks)
        .where(eq(complianceFrameworks.integrationId, input.integrationId))
        .orderBy(complianceFrameworks.name);
    }),

  createFramework: authProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        integrationId: z.string(),
        parentId: z.string().uuid().optional()
      })
    )
    .mutation(async ({ ctx, input }): Promise<FrameworkRow> => {
      const [row] = await ctx.db
        .insert(complianceFrameworks)
        .values({
          name: input.name,
          description: input.description,
          integrationId: input.integrationId,
          parentId: input.parentId
        })
        .returning();
      return row!;
    }),

  updateFramework: authProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        parentId: z.string().uuid().optional().nullable()
      })
    )
    .mutation(async ({ ctx, input }): Promise<FrameworkRow> => {
      const { id, ...rest } = input;
      const [row] = await ctx.db
        .update(complianceFrameworks)
        .set({ ...rest, updatedAt: new Date() })
        .where(eq(complianceFrameworks.id, id))
        .returning();
      return row!;
    }),

  deleteFramework: authProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<void> => {
      await ctx.db.delete(complianceFrameworks).where(eq(complianceFrameworks.id, input.id));
    }),

  // ── Check management ────────────────────────────────────────────────────────

  listChecks: authProcedure
    .input(z.object({ frameworkId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<CheckRow[]> => {
      return ctx.db
        .select()
        .from(complianceFrameworkChecks)
        .where(eq(complianceFrameworkChecks.frameworkId, input.frameworkId))
        .orderBy(complianceFrameworkChecks.name);
    }),

  createCheck: authProcedure
    .input(
      z.object({
        frameworkId: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        severity: z.string(),
        checkTypeId: z.string(),
        checkConfig: z.record(z.unknown())
      })
    )
    .mutation(async ({ ctx, input }): Promise<CheckRow> => {
      const [row] = await ctx.db
        .insert(complianceFrameworkChecks)
        .values({
          frameworkId: input.frameworkId,
          name: input.name,
          description: input.description,
          severity: input.severity,
          checkTypeId: input.checkTypeId,
          checkConfig: input.checkConfig as JsonValue
        })
        .returning();
      return row!;
    }),

  updateCheck: authProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        severity: z.string().optional(),
        checkTypeId: z.string().optional(),
        checkConfig: z.record(z.unknown()).optional()
      })
    )
    .mutation(async ({ ctx, input }): Promise<CheckRow> => {
      const { id, checkConfig, ...rest } = input;
      const [row] = await ctx.db
        .update(complianceFrameworkChecks)
        .set({
          ...rest,
          ...(checkConfig !== undefined ? { checkConfig: checkConfig as JsonValue } : {}),
          updatedAt: new Date()
        })
        .where(eq(complianceFrameworkChecks.id, id))
        .returning();
      return row!;
    }),

  deleteCheck: authProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<void> => {
      await ctx.db
        .delete(complianceFrameworkChecks)
        .where(eq(complianceFrameworkChecks.id, input.id));
    }),

  // ── Assignment management ───────────────────────────────────────────────────

  listAssignments: authProcedure
    .input(z.object({ integrationId: z.string() }))
    .query(async ({ ctx, input }): Promise<AssignmentRow[]> => {
      return ctx.db
        .select()
        .from(complianceAssignments)
        .where(eq(complianceAssignments.integrationId, input.integrationId));
    }),

  toggleAssignment: authProcedure
    .input(
      z.object({
        frameworkId: z.string().uuid(),
        integrationId: z.string()
      })
    )
    .mutation(async ({ ctx, input }): Promise<void> => {
      const existing = await ctx.db
        .select()
        .from(complianceAssignments)
        .where(
          and(
            eq(complianceAssignments.frameworkId, input.frameworkId),
            eq(complianceAssignments.integrationId, input.integrationId),
            isNull(complianceAssignments.linkId),
            isNull(complianceAssignments.siteId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await ctx.db
          .delete(complianceAssignments)
          .where(eq(complianceAssignments.id, existing[0]!.id));
      } else {
        await ctx.db.insert(complianceAssignments).values({
          frameworkId: input.frameworkId,
          integrationId: input.integrationId
        });
      }
    }),

  addAssignment: authProcedure
    .input(
      z.object({
        frameworkId: z.string().uuid(),
        integrationId: z.string(),
        linkId: z.string().uuid()
      })
    )
    .mutation(async ({ ctx, input }): Promise<AssignmentRow> => {
      const [row] = await ctx.db
        .insert(complianceAssignments)
        .values({
          frameworkId: input.frameworkId,
          integrationId: input.integrationId,
          linkId: input.linkId
        })
        .returning();
      return row!;
    }),

  removeAssignment: authProcedure
    .input(
      z.object({
        frameworkId: z.string().uuid(),
        linkId: z.string().uuid()
      })
    )
    .mutation(async ({ ctx, input }): Promise<void> => {
      await ctx.db
        .delete(complianceAssignments)
        .where(
          and(
            eq(complianceAssignments.frameworkId, input.frameworkId),
            eq(complianceAssignments.linkId, input.linkId)
          )
        );
    })
});
