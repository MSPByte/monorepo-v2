import { FlowProducer } from 'bullmq';
import { eq, and, isNull } from 'drizzle-orm';
import { createCatalogDb } from '@mspbyte/drizzle-catalog';
import { orgs } from '@mspbyte/drizzle-catalog/catalog';
import { createMspDb, integrationLinks, integrations, syncRuns } from '@mspbyte/drizzle';
import { PROVIDER_FACETS } from '@mspbyte/shared';
import { buildLinkFlow } from '@mspbyte/shared';
import type { PipelineFlowJob } from '@mspbyte/shared';
import { logger } from './logger.js';
import { hasActiveRun, getSyncContexts, isLinkHealthy, decideFacetMode } from './sync-context.js';
import type { Redis } from 'ioredis';

export async function scheduleIngestion(redis: Redis, triggerType: 'scheduled' | 'manual' = 'scheduled') {
  const flow = new FlowProducer({ connection: redis });
  const catalogDb = createCatalogDb();

  const allOrgs = await catalogDb.select().from(orgs).where(eq(orgs.status, 'active'));
  logger.info({ orgCount: allOrgs.length }, 'Scheduling ingestion flows');

  for (const org of allOrgs) {
    const mspDb = createMspDb(org.serviceConnectionString);

    const rows = await mspDb
      .select({ link: integrationLinks, integrationConfig: integrations.config, credentialExpiration: integrations.credentialExpiration })
      .from(integrationLinks)
      .innerJoin(integrations, eq(integrations.id, integrationLinks.integrationId))
      .where(and(
        eq(integrationLinks.status, 'active'),
        isNull(integrations.deletedAt),
      ));

    for (const { link, integrationConfig, credentialExpiration } of rows) {
      const providerId = link.integrationId;
      const facets = PROVIDER_FACETS[providerId] ?? [];
      if (facets.length === 0) continue;

      // Skip if credentials are expired
      if (credentialExpiration && credentialExpiration < new Date()) {
        logger.warn({ orgId: org.id, linkId: link.id, provider: providerId }, 'Skipping link: credentials expired');
        continue;
      }

      // Skip if a run is already in-progress for this link
      if (await hasActiveRun(mspDb, link.id)) {
        logger.info({ orgId: org.id, linkId: link.id }, 'Skipping link: active run already in progress');
        continue;
      }

      // Check sync_context for health and decide mode per-facet
      const contexts = await getSyncContexts(mspDb, link.id);

      if (!isLinkHealthy(contexts)) {
        logger.warn({ orgId: org.id, linkId: link.id }, 'Skipping link: too many consecutive failures');
        await mspDb.update(integrationLinks).set({ status: 'error', updatedAt: new Date() }).where(eq(integrationLinks.id, link.id));
        continue;
      }

      const facetCursors: Record<string, string | undefined> = {};
      for (const facet of facets) {
        const { cursor } = decideFacetMode(contexts, facet);
        facetCursors[facet] = cursor;
      }

      const ingestRunId = crypto.randomUUID();
      const linkMeta = (link.meta as Record<string, unknown> | null) ?? {};
      const config = (integrationConfig as Record<string, unknown> | null) ?? {};

      // Create a sync_runs record before enqueuing so workers can reference it
      const [syncRunRow] = await mspDb
        .insert(syncRuns)
        .values({
          linkId: link.id,
          integrationId: providerId,
          bullmqJobId: `ingest:${link.id}`,
          type: triggerType,
          status: 'pending',
          mode: 'full',
          startedAt: new Date(),
        })
        .returning();

      if (!syncRunRow) {
        logger.error({ orgId: org.id, linkId: link.id }, 'Failed to create sync_run record — skipping');
        continue;
      }

      const flowJob: PipelineFlowJob = buildLinkFlow({
        orgId: org.id,
        linkId: link.id,
        siteId: link.siteId ?? undefined,
        provider: providerId,
        externalId: link.externalId ?? undefined,
        linkMeta,
        integrationConfig: config,
        facets,
        ingestRunId,
        syncRunId: syncRunRow.id,
        mode: 'full',
        facetCursors,
      });

      await flow.add(flowJob as Parameters<typeof flow.add>[0]);

      logger.info(
        { orgId: org.id, linkId: link.id, provider: providerId, facets: facets.length, ingestRunId, syncRunId: syncRunRow.id },
        'Ingestion flow enqueued'
      );
    }
  }
}

export async function scheduleLink(
  redis: Redis,
  mspConnectionString: string,
  orgId: string,
  linkId: string,
  mode: 'full' | 'replay' = 'full'
) {
  const mspDb = createMspDb(mspConnectionString);
  const flow = new FlowProducer({ connection: redis });

  const rows = await mspDb
    .select({ link: integrationLinks, integrationConfig: integrations.config })
    .from(integrationLinks)
    .innerJoin(integrations, eq(integrations.id, integrationLinks.integrationId))
    .where(eq(integrationLinks.id, linkId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error(`Integration link not found: ${linkId}`);

  const providerId = row.link.integrationId;
  const facets = PROVIDER_FACETS[providerId] ?? [];
  if (facets.length === 0) throw new Error(`No facets registered for provider: ${providerId}`);

  const ingestRunId = crypto.randomUUID();
  const linkMeta = (row.link.meta as Record<string, unknown> | null) ?? {};
  const config = (row.integrationConfig as Record<string, unknown> | null) ?? {};

  const [syncRunRow] = await mspDb
    .insert(syncRuns)
    .values({
      linkId,
      integrationId: providerId,
      bullmqJobId: `ingest:${linkId}`,
      type: mode === 'replay' ? 'replay' : 'manual',
      status: 'pending',
      mode: 'full',
      startedAt: new Date(),
    })
    .returning();

  if (!syncRunRow) throw new Error('Failed to create sync_run record');

  const flowJob: PipelineFlowJob = buildLinkFlow({
    orgId,
    linkId,
    siteId: row.link.siteId ?? undefined,
    provider: providerId,
    externalId: row.link.externalId ?? undefined,
    linkMeta,
    integrationConfig: config,
    facets,
    ingestRunId,
    syncRunId: syncRunRow.id,
    mode,
  });

  await flow.add(flowJob as Parameters<typeof flow.add>[0]);

  return { syncRunId: syncRunRow.id, ingestRunId };
}
