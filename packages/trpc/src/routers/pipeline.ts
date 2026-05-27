import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { FlowProducer } from 'bullmq';
import { syncRuns, syncContext, syncRunStages, integrationLinks, integrations } from '@mspbyte/drizzle';
import { PROVIDER_FACETS, buildLinkFlow } from '@mspbyte/shared';
import { t, authProcedure } from '../trpc.js';

export const pipelineRouter = t.router({
  replay: authProcedure
    .input(z.object({ linkId: z.string().uuid(), mode: z.enum(['full', 'replay']).default('replay') }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.redis) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Redis not available' });

      const rows = await ctx.db
        .select({ link: integrationLinks, integrationConfig: integrations.config })
        .from(integrationLinks)
        .innerJoin(integrations, eq(integrations.id, integrationLinks.integrationId))
        .where(eq(integrationLinks.id, input.linkId))
        .limit(1);

      const row = rows[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Integration link not found' });

      const providerId = row.link.integrationId;
      const facets = PROVIDER_FACETS[providerId] ?? [];
      if (facets.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: `No facets for provider: ${providerId}` });

      const ingestRunId = crypto.randomUUID();
      const linkMeta = (row.link.meta as Record<string, unknown> | null) ?? {};
      const config = (row.integrationConfig as Record<string, unknown> | null) ?? {};

      const [syncRunRow] = await ctx.db
        .insert(syncRuns)
        .values({
          linkId: input.linkId,
          integrationId: providerId,
          bullmqJobId: `ingest:${input.linkId}`,
          type: input.mode === 'replay' ? 'replay' : 'manual',
          status: 'pending',
          mode: 'full',
          startedAt: new Date(),
        })
        .returning();

      if (!syncRunRow) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create sync run' });

      const flowJob = buildLinkFlow({
        orgId: ctx.orgId,
        linkId: input.linkId,
        siteId: row.link.siteId ?? undefined,
        provider: providerId,
        externalId: row.link.externalId ?? undefined,
        linkMeta,
        integrationConfig: config,
        facets,
        ingestRunId,
        syncRunId: syncRunRow.id,
        mode: input.mode,
      });

      const flow = new FlowProducer({ connection: ctx.redis });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await flow.add(flowJob as any);

      return { syncRunId: syncRunRow.id, ingestRunId };
    }),

  syncStatus: authProcedure
    .input(z.object({ linkId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [contexts, runs] = await Promise.all([
        ctx.db.select().from(syncContext).where(eq(syncContext.linkId, input.linkId)),
        ctx.db.select().from(syncRuns).where(eq(syncRuns.linkId, input.linkId)).orderBy(desc(syncRuns.createdAt)).limit(5),
      ]);
      return { contexts, recentRuns: runs };
    }),

  recentRuns: authProcedure
    .input(z.object({ linkId: z.string().uuid().optional(), limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const conditions = input.linkId ? [eq(syncRuns.linkId, input.linkId)] : [];
      return ctx.db
        .select()
        .from(syncRuns)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(syncRuns.createdAt))
        .limit(input.limit);
    }),

  failedStages: authProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(syncRunStages)
        .where(eq(syncRunStages.status, 'failed'))
        .orderBy(desc(syncRunStages.createdAt))
        .limit(input.limit);
    }),
});
