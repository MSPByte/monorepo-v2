import { randomUUID } from 'node:crypto';
import { FlowProducer } from 'bullmq';
import { eq, and, isNull } from 'drizzle-orm';
import { createCatalogDb, createTenantDb } from '@mspbyte/drizzle-catalog';
import { organization } from '@mspbyte/drizzle-catalog/catalog';
import { integrationLinks, integrations, syncRuns } from '@mspbyte/drizzle';
import {
  buildLinkFlow,
  getProviderFacets,
  ingestionRootJobId,
  resolveFacetPlan
} from '@mspbyte/shared';
import type { PipelineFlowJob, ProviderFacet } from '@mspbyte/shared';
import { logger } from './logger.js';
import { hasActiveRun, getSyncContexts, isLinkHealthy, decideFacetMode } from './sync-context.js';
import type { Redis } from 'ioredis';
import { env } from './env.js';

export async function scheduleIngestion(
  redis: Redis,
  triggerType: 'scheduled' | 'manual' = 'scheduled'
) {
  const flow = new FlowProducer({ connection: redis });
  const catalogDb = createCatalogDb();

  const allOrgs = await catalogDb
    .select()
    .from(organization)
    .where(eq(organization.status, 'active'));
  logger.info({ orgCount: allOrgs.length }, 'Scheduling ingestion flows');

  for (const org of allOrgs) {
    const mspDb = createTenantDb(org.serviceConnectionString, env.ENCRYPTION_KEY);

    const rows = await mspDb
      .select({
        link: integrationLinks,
        integrationConfig: integrations.config,
        credentialExpiration: integrations.credentialExpiration
      })
      .from(integrationLinks)
      .innerJoin(integrations, eq(integrations.id, integrationLinks.integrationId))
      .where(and(eq(integrationLinks.status, 'active'), isNull(integrations.deletedAt)));

    for (const { link, integrationConfig, credentialExpiration } of rows) {
      const providerId = link.integrationId;
      const providerFacets = getProviderFacets(providerId);
      if (providerFacets.length === 0) continue;

      // Skip if credentials are expired
      if (credentialExpiration && credentialExpiration < new Date().toISOString()) {
        logger.warn(
          { orgId: org.id, linkId: link.id, provider: providerId },
          'Skipping link: credentials expired'
        );
        continue;
      }

      // Skip if a run is already in-progress for this link
      if (await hasActiveRun(mspDb, link.id)) {
        logger.info(
          { orgId: org.id, linkId: link.id },
          'Skipping link: active run already in progress'
        );
        continue;
      }

      // Check sync_context for health and decide mode per-facet
      const contexts = await getSyncContexts(mspDb, link.id);

      if (!isLinkHealthy(contexts)) {
        logger.warn(
          { orgId: org.id, linkId: link.id },
          'Skipping link: too many consecutive failures'
        );
        await mspDb
          .update(integrationLinks)
          .set({ status: 'error', updatedAt: new Date().toISOString() })
          .where(eq(integrationLinks.id, link.id));
        continue;
      }

      const ingestRunId = randomUUID();
      const linkMeta = (link.meta as Record<string, unknown> | null) ?? {};
      const config = (integrationConfig as Record<string, unknown> | null) ?? {};
      const { facets, skipped } = resolveFacetPlan({
        providerId,
        contexts,
        integrationConfig: config,
        linkMeta
      });

      if (facets.length === 0) {
        logger.debug(
          { orgId: org.id, linkId: link.id, provider: providerId, skipped },
          'Skipping link: no facets due'
        );
        continue;
      }

      const facetCursors: Record<string, string | undefined> = {};
      for (const facet of facets) {
        const { cursor } = decideFacetMode(contexts, facet);
        facetCursors[facet] = cursor;
      }

      // Create a sync_runs record before enqueuing so workers can reference it
      const bullmqJobId = ingestionRootJobId(link.id, ingestRunId);
      const [syncRunRow] = await mspDb
        .insert(syncRuns)
        .values({
          linkId: link.id,
          integrationId: providerId,
          bullmqJobId,
          type: triggerType,
          status: 'pending',
          mode: 'full',
          startedAt: new Date().toISOString()
        })
        .returning();

      if (!syncRunRow) {
        logger.error(
          { orgId: org.id, linkId: link.id },
          'Failed to create sync_run record — skipping'
        );
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
        facetCursors
      });

      try {
        await flow.add(flowJob as Parameters<typeof flow.add>[0]);
        await mspDb
          .update(syncRuns)
          .set({ status: 'queued' })
          .where(eq(syncRuns.id, syncRunRow.id));
      } catch (err) {
        await mspDb
          .update(syncRuns)
          .set({ status: 'enqueue_failed', finishedAt: new Date().toISOString() })
          .where(eq(syncRuns.id, syncRunRow.id));
        logger.error(
          { orgId: org.id, linkId: link.id, syncRunId: syncRunRow.id, bullmqJobId, err },
          'Failed to enqueue ingestion flow'
        );
        continue;
      }

      logger.info(
        {
          orgId: org.id,
          linkId: link.id,
          provider: providerId,
          facets: facets.length,
          ingestRunId,
          syncRunId: syncRunRow.id
        },
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
  mode: 'full' | 'replay' = 'full',
  options: { facets?: ProviderFacet[]; includeDependencies?: boolean; force?: boolean } = {}
) {
  const mspDb = createTenantDb(mspConnectionString, env.ENCRYPTION_KEY);
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
  const providerFacets = getProviderFacets(providerId);
  if (providerFacets.length === 0)
    throw new Error(`No facets registered for provider: ${providerId}`);

  const ingestRunId = randomUUID();
  const linkMeta = (row.link.meta as Record<string, unknown> | null) ?? {};
  const config = (row.integrationConfig as Record<string, unknown> | null) ?? {};
  const { facets } = resolveFacetPlan({
    providerId,
    integrationConfig: config,
    linkMeta,
    requestedFacets: options.facets,
    includeDependencies: options.includeDependencies,
    force: options.force ?? true
  });
  if (facets.length === 0)
    throw new Error(`No enabled facets selected for provider: ${providerId}`);

  const bullmqJobId = ingestionRootJobId(linkId, ingestRunId);
  const [syncRunRow] = await mspDb
    .insert(syncRuns)
    .values({
      linkId,
      integrationId: providerId,
      bullmqJobId,
      type: mode === 'replay' ? 'replay' : 'manual',
      status: 'pending',
      mode: 'full',
      startedAt: new Date().toISOString()
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
    mode
  });

  try {
    await flow.add(flowJob as Parameters<typeof flow.add>[0]);
    await mspDb.update(syncRuns).set({ status: 'queued' }).where(eq(syncRuns.id, syncRunRow.id));
  } catch (err) {
    await mspDb
      .update(syncRuns)
      .set({ status: 'enqueue_failed', finishedAt: new Date().toISOString() })
      .where(eq(syncRuns.id, syncRunRow.id));
    throw err;
  }

  return { syncRunId: syncRunRow.id, ingestRunId };
}
