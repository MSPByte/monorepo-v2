import { FlowProducer } from 'bullmq';
import { eq } from 'drizzle-orm';
import { createCatalogDb } from '@mspbyte/drizzle-catalog';
import { orgs } from '@mspbyte/drizzle-catalog/catalog';
import { createMspDb, integrationLinks, integrations } from '@mspbyte/drizzle';
import { QUEUES, PROVIDER_IDS, ProviderFacet } from '@mspbyte/shared';
import type { FetchJobData, AlertsJobData, LinkJobData, EnrichJobData } from '@mspbyte/shared';
import { logger } from './logger.js';
import type { Redis } from 'ioredis';

const PROVIDER_FACETS: Record<string, ProviderFacet[]> = {
  [PROVIDER_IDS.M365]: [
    ProviderFacet.M365Identities,
    ProviderFacet.M365Groups,
    ProviderFacet.M365Licenses,
    ProviderFacet.M365CAPolicies,
    ProviderFacet.M365AuthMethods,
    ProviderFacet.M365Devices,
    ProviderFacet.M365OAuthGrants,
    ProviderFacet.M365RiskyUsers,
    ProviderFacet.M365ExchangeConfig,
    ProviderFacet.M365DomainConfig,
    ProviderFacet.M365TeamsConfig,
    ProviderFacet.M365MailboxForwarding,
    ProviderFacet.M365InboxRules
  ],
  [PROVIDER_IDS.SOPHOS]: [
    ProviderFacet.SophosEndpoints,
    ProviderFacet.SophosFirewalls,
    ProviderFacet.SophosLicenses
  ],
  [PROVIDER_IDS.DATTO]: [ProviderFacet.DattoEndpoints],
  [PROVIDER_IDS.COVE]: [ProviderFacet.CoveEndpoints]
};

export async function scheduleIngestion(redis: Redis) {
  const flow = new FlowProducer({ connection: redis });
  const catalogDb = createCatalogDb();

  const allOrgs = await catalogDb.select().from(orgs).where(eq(orgs.status, 'active'));
  logger.info({ orgCount: allOrgs.length }, 'Scheduling ingestion flows');

  for (const org of allOrgs) {
    const mspDb = createMspDb(org.serviceConnectionString);

    // Fetch links with their integration config in one query
    const rows = await mspDb
      .select({
        link: integrationLinks,
        integrationConfig: integrations.config
      })
      .from(integrationLinks)
      .innerJoin(integrations, eq(integrations.id, integrationLinks.integrationId))
      .where(eq(integrationLinks.status, 'active'));

    for (const { link, integrationConfig } of rows) {
      const providerId = link.integrationId;
      const facets = PROVIDER_FACETS[providerId] ?? [];
      if (facets.length === 0) continue;

      const ingestRunId = crypto.randomUUID();
      const linkMeta = (link.meta as Record<string, unknown> | null) ?? {};
      const config = (integrationConfig as Record<string, unknown> | null) ?? {};

      const fetchChildren = facets.map((facet) => ({
        name: `fetch:${providerId}:${facet}:${ingestRunId}`,
        queueName: QUEUES.FETCH,
        data: {
          linkId: link.id,
          siteId: link.siteId ?? undefined,
          orgId: org.id,
          provider: providerId,
          facet,
          ingestRunId,
          linkMeta: { ...linkMeta, externalId: link.externalId },
          integrationConfig: config
        } satisfies FetchJobData
      }));

      const alertsData: AlertsJobData = {
        linkId: link.id ?? undefined,
        siteId: link.siteId ?? undefined,
        orgId: org.id,
        ingestRunId
      };

      // M365 needs LINK (Graph API relationship linking) then ENRICH (mfa_enforced computation) before ALERTS.
      // Flow executes bottom-up: FETCH → LINK → ENRICH → ALERTS.
      if (providerId === PROVIDER_IDS.M365) {
        await flow.add({
          name: `alerts:${org.id}:${link.id}:${ingestRunId}`,
          queueName: QUEUES.ALERTS,
          data: alertsData,
          children: [
            {
              name: `enrich:${providerId}:${link.id}:${ingestRunId}`,
              queueName: QUEUES.ENRICH,
              data: {
                linkId: link.id,
                orgId: org.id,
                provider: providerId,
                ingestRunId,
                linkMeta: { ...linkMeta, externalId: link.externalId },
                integrationConfig: config
              } satisfies EnrichJobData,
              children: [
                {
                  name: `link:${providerId}:${link.id}:${ingestRunId}`,
                  queueName: QUEUES.LINK,
                  data: {
                    linkId: link.id,
                    orgId: org.id,
                    provider: providerId,
                    ingestRunId,
                    linkMeta: { ...linkMeta, externalId: link.externalId },
                    integrationConfig: config
                  } satisfies LinkJobData,
                  children: fetchChildren
                }
              ]
            }
          ]
        });
      } else {
        await flow.add({
          name: `alerts:${org.id}:${link.id}:${ingestRunId}`,
          queueName: QUEUES.ALERTS,
          data: alertsData,
          children: fetchChildren
        });
      }

      logger.info(
        {
          orgId: org.id,
          linkId: link.id,
          provider: providerId,
          facets: facets.length,
          ingestRunId
        },
        'Ingestion flow enqueued'
      );
    }
  }
}
