import { z } from 'zod';
import { eq, ne, and, or, isNull, ilike, gt, lt, gte, lte, asc, desc, sql } from 'drizzle-orm';
import { alerts } from '@mspbyte/drizzle';
import { TRPCError } from '@trpc/server';
import { t, authProcedure } from '../trpc.js';

type AlertRow = typeof alerts.$inferSelect;

export const alertsRouter = t.router({
  list: authProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        linkId: z.string().optional(),
        status: z.enum(['active', 'resolved', 'suppressed']).optional(),
        severity: z.number().int().optional(),
        entityType: z.string().optional()
      })
    )
    .query(async ({ ctx, input }): Promise<AlertRow[]> => {
      const conditions = [];
      if (input.siteId) conditions.push(eq(alerts.siteId, input.siteId));
      else if (input.linkId) conditions.push(eq(alerts.linkId, input.linkId));
      if (input.status) conditions.push(eq(alerts.status, input.status));
      if (input.severity) conditions.push(eq(alerts.severity, input.severity));
      if (input.entityType) conditions.push(eq(alerts.entityType, input.entityType));
      return ctx.db
        .select()
        .from(alerts)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(alerts.lastSeenAt);
    }),

  suppress: authProcedure
    .input(
      z.object({ alertId: z.string(), until: z.string().datetime(), note: z.string().optional() })
    )
    .mutation(async ({ ctx, input }): Promise<AlertRow> => {
      const [updated] = await ctx.db
        .update(alerts)
        .set({
          status: 'suppressed',
          suppressedAt: new Date(),
          suppressedUntil: new Date(input.until),
          suppressionNote: input.note,
          suppressedBy: ctx.userId,
          updatedAt: new Date()
        })
        .where(eq(alerts.id, input.alertId))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return updated;
    }),

  resolve: authProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<AlertRow> => {
      const [updated] = await ctx.db
        .update(alerts)
        .set({ status: 'resolved', resolvedAt: new Date(), updatedAt: new Date() })
        .where(eq(alerts.id, input.alertId))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return updated;
    }),

  tableData: authProcedure
    .input(
      z.object({
        linkId: z.string().optional(),
        page: z.number().int().default(0),
        pageSize: z.number().int().default(25),
        globalSearch: z.string().optional(),
        filters: z
          .array(
            z.object({
              field: z.string(),
              operator: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'ilike']),
              value: z.string().optional()
            })
          )
          .optional(),
        sortField: z.string().optional(),
        sortDir: z.enum(['asc', 'desc']).optional()
      })
    )
    .query(async ({ ctx, input }): Promise<{ rows: AlertRow[]; total: number }> => {
      const conditions = [];

      if (input.linkId) conditions.push(eq(alerts.linkId, input.linkId));

      if (input.globalSearch) {
        const q = `%${input.globalSearch}%`;
        conditions.push(or(ilike(alerts.message, q), ilike(alerts.entityId, q))!);
      }

      for (const f of input.filters ?? []) {
        if (f.field === 'status' && f.value) {
          const sv = f.value as 'active' | 'resolved' | 'suppressed';
          if (f.operator === 'eq') conditions.push(eq(alerts.status, sv));
          else if (f.operator === 'neq') conditions.push(ne(alerts.status, sv));
        }
        if (f.field === 'severity' && f.value != null) {
          const sev = parseInt(f.value);
          if (!isNaN(sev)) {
            if (f.operator === 'eq') conditions.push(eq(alerts.severity, sev));
            else if (f.operator === 'neq') conditions.push(ne(alerts.severity, sev));
            else if (f.operator === 'gt') conditions.push(gt(alerts.severity, sev));
            else if (f.operator === 'lt') conditions.push(lt(alerts.severity, sev));
            else if (f.operator === 'gte') conditions.push(gte(alerts.severity, sev));
            else if (f.operator === 'lte') conditions.push(lte(alerts.severity, sev));
          }
        }
      }

      const where = conditions.length ? and(...conditions) : undefined;

      const [{ total }] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(alerts)
        .where(where);

      const sortableMap = {
        lastSeenAt: alerts.lastSeenAt,
        severity: alerts.severity,
        status: alerts.status
      } as const;
      const sortCol = input.sortField
        ? (sortableMap[input.sortField as keyof typeof sortableMap] ?? alerts.lastSeenAt)
        : alerts.lastSeenAt;
      const order = input.sortDir === 'asc' ? asc(sortCol) : desc(sortCol);

      const rows = await ctx.db
        .select()
        .from(alerts)
        .where(where)
        .orderBy(order)
        .limit(input.pageSize)
        .offset(input.page * input.pageSize);

      return { rows, total };
    })
});
