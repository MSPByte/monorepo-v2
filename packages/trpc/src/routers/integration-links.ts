import { z } from 'zod';
import { integrationLinks, integrations, syncRuns } from '@mspbyte/drizzle';
import { eq, and, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { FlowProducer } from 'bullmq';
import { buildLinkFlow, getProviderFacets, resolveFacetPlan } from '@mspbyte/shared';
import { t, authProcedure } from '../trpc.js';

type IntegrationLinkRow = typeof integrationLinks.$inferSelect;

export const integrationLinksRouter = t.router({
  list: authProcedure
    .input(
      z.object({
        integrationId: z.string().optional(),
        siteId: z.string().uuid().optional(),
        status: z.enum(['active', 'error', 'disabled']).optional(),
      }),
    )
    .query(async ({ ctx, input }): Promise<IntegrationLinkRow[]> => {
      const conditions = [];
      if (input.integrationId) conditions.push(eq(integrationLinks.integrationId, input.integrationId));
      if (input.siteId) conditions.push(eq(integrationLinks.siteId, input.siteId));
      if (input.status) conditions.push(eq(integrationLinks.status, input.status));
      return ctx.db
        .select()
        .from(integrationLinks)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(integrationLinks.name);
    }),

  create: authProcedure
    .input(
      z.object({
        integrationId: z.string(),
        siteId: z.string().uuid().optional(),
        externalId: z.string().optional(),
        name: z.string().optional(),
        status: z.enum(['active', 'error', 'disabled']).default('active'),
        disposition: z.enum(['managed', 'third_party', 'not_managed']).optional(),
        note: z.string().optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<IntegrationLinkRow> => {
      const [row] = await ctx.db
        .insert(integrationLinks)
        .values({
          integrationId: input.integrationId,
          siteId: input.siteId,
          externalId: input.externalId,
          name: input.name,
          status: input.status,
          disposition: input.disposition,
          note: input.note,
          meta: input.meta,
        })
        .returning();
      if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Event-driven scheduling: immediately enqueue a full sync for new active links
      if (row.status === 'active' && ctx.redis) {
        const redis = ctx.redis;
        void triggerLinkSync({ db: ctx.db, orgId: ctx.orgId, redis }, row.id, row.integrationId, row.siteId ?? undefined, row.externalId ?? undefined, row.meta as Record<string, unknown> | null);
      }

      return row;
    }),

  update: authProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        externalId: z.string().optional().nullable(),
        name: z.string().optional().nullable(),
        siteId: z.string().uuid().optional().nullable(),
        status: z.enum(['active', 'error', 'disabled']).optional(),
        disposition: z.enum(['managed', 'third_party', 'not_managed']).optional().nullable(),
        note: z.string().optional().nullable(),
        meta: z.record(z.string(), z.unknown()).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<IntegrationLinkRow> => {
      const { id, ...rest } = input;
      const [row] = await ctx.db
        .update(integrationLinks)
        .set({ ...rest, updatedAt: new Date() })
        .where(eq(integrationLinks.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return row;
    }),

  delete: authProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }): Promise<void> => {
      if (input.ids.length === 0) return;
      await ctx.db
        .delete(integrationLinks)
        .where(inArray(integrationLinks.id, input.ids));
    }),
});

import type { MspServiceDb } from '@mspbyte/drizzle';
import type { Redis } from 'ioredis';

async function triggerLinkSync(
  ctx: { db: MspServiceDb; orgId: string; redis: Redis },
  linkId: string,
  integrationId: string,
  siteId: string | undefined,
  externalId: string | undefined,
  meta: Record<string, unknown> | null
): Promise<void> {
  try {
    const providerFacets = getProviderFacets(integrationId);
    if (providerFacets.length === 0) return;

    const [integrationRow] = await ctx.db
      .select({ config: integrations.config })
      .from(integrations)
      .where(eq(integrations.id, integrationId))
      .limit(1);

    const integrationConfig = (integrationRow?.config as Record<string, unknown> | null) ?? {};
    const { facets } = resolveFacetPlan({
      providerId: integrationId,
      integrationConfig,
      linkMeta: meta ?? {},
      force: true,
    });
    if (facets.length === 0) return;

    const ingestRunId = crypto.randomUUID();

    const [syncRunRow] = await ctx.db
      .insert(syncRuns)
      .values({
        linkId,
        integrationId,
        bullmqJobId: `ingest:${linkId}`,
        type: 'manual',
        status: 'pending',
        mode: 'full',
        startedAt: new Date(),
      })
      .returning();

    if (!syncRunRow) return;

    const flowJob = buildLinkFlow({
      orgId: ctx.orgId,
      linkId,
      siteId,
      provider: integrationId,
      externalId,
      linkMeta: { ...((meta ?? {})), externalId },
      integrationConfig,
      facets,
      ingestRunId,
      syncRunId: syncRunRow.id,
      mode: 'full',
    });

    const flow = new FlowProducer({ connection: ctx.redis });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await flow.add(flowJob as any);
  } catch {
    // Fire-and-forget — the cron scheduler will catch it on next run
  }
}
