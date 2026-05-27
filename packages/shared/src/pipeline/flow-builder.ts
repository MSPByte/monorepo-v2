import { QUEUES } from '../types/queues.js';
import { PROVIDER_IDS } from '../constants.js';
import { ProviderFacet } from '../libs/provider.js';
import type {
  FetchJobData,
  AlertsJobData,
  LinkJobData,
  EnrichJobData,
  SyncMode
} from '../types/jobs.js';

// Plain BullMQ-compatible flow job descriptor — no bullmq import needed in shared.
export type PipelineFlowJob = {
  name: string;
  data: Record<string, unknown>;
  opts?: { jobId?: string; removeOnComplete?: number | boolean; removeOnFail?: number | boolean };
  queueName: string;
  children?: PipelineFlowJob[];
};

export type BuildLinkFlowParams = {
  orgId: string;
  linkId: string;
  siteId?: string;
  provider: string;
  externalId?: string;
  linkMeta?: Record<string, unknown>;
  integrationConfig?: Record<string, unknown>;
  facets: ProviderFacet[];
  ingestRunId: string;
  syncRunId: string;
  mode: SyncMode;
  facetCursors?: Record<string, string | undefined>;
};

export function buildLinkFlow(params: BuildLinkFlowParams): PipelineFlowJob {
  const {
    orgId, linkId, siteId, provider, externalId, linkMeta = {}, integrationConfig = {},
    facets, ingestRunId, syncRunId, mode, facetCursors = {}
  } = params;

  const resolvedMeta = { ...linkMeta, externalId };

  const fetchChildren: PipelineFlowJob[] = facets.map((facet) => ({
    name: `fetch:${provider}:${facet}:${ingestRunId}`,
    queueName: QUEUES.FETCH,
    data: {
      linkId,
      siteId,
      orgId,
      provider,
      facet,
      ingestRunId,
      syncRunId,
      mode,
      cursor: facetCursors[facet],
      linkMeta: resolvedMeta,
      integrationConfig,
    } satisfies FetchJobData as Record<string, unknown>
  }));

  const alertsData: AlertsJobData = {
    linkId,
    siteId,
    orgId,
    ingestRunId,
    syncRunId,
    mode,
  };

  const rootOpts = { jobId: `ingest_${linkId}`, removeOnComplete: 5, removeOnFail: 10 };

  const needsM365IdentityPostProcess =
    provider === PROVIDER_IDS.M365 &&
    facets.some((facet) => [
      ProviderFacet.M365Identities,
      ProviderFacet.M365Groups,
      ProviderFacet.M365CAPolicies,
    ].includes(facet));

  if (needsM365IdentityPostProcess) {
    const linkData: LinkJobData = {
      linkId,
      orgId,
      provider,
      facets,
      ingestRunId,
      syncRunId,
      linkMeta: resolvedMeta,
      integrationConfig,
    };
    const enrichData: EnrichJobData = {
      linkId,
      orgId,
      provider,
      facets,
      ingestRunId,
      syncRunId,
      linkMeta: resolvedMeta,
      integrationConfig,
    };
    return {
      name: `alerts:${orgId}:${linkId}:${ingestRunId}`,
      queueName: QUEUES.ALERTS,
      data: alertsData as Record<string, unknown>,
      opts: rootOpts,
      children: [
        {
          name: `enrich:${provider}:${linkId}:${ingestRunId}`,
          queueName: QUEUES.ENRICH,
          data: enrichData as Record<string, unknown>,
          children: [
            {
              name: `link:${provider}:${linkId}:${ingestRunId}`,
              queueName: QUEUES.LINK,
              data: linkData as Record<string, unknown>,
              children: fetchChildren,
            }
          ],
        }
      ],
    };
  }

  return {
    name: `alerts:${orgId}:${linkId}:${ingestRunId}`,
    queueName: QUEUES.ALERTS,
    data: alertsData as Record<string, unknown>,
    opts: rootOpts,
    children: fetchChildren,
  };
}
