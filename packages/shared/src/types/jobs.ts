import type { ProviderFacet } from '../libs/provider.js';

export type SyncMode = 'full' | 'replay';

export type FetchJobData = {
  linkId: string;
  siteId?: string;
  orgId: string;
  provider: string;
  facet: ProviderFacet;
  ingestRunId: string;
  syncRunId: string;
  mode: SyncMode;
  cursor?: string;
  linkMeta?: Record<string, unknown>;
  integrationConfig?: Record<string, unknown>;
};

export type NormalizeJobData = {
  linkId: string;
  siteId?: string;
  orgId: string;
  provider: string;
  facet: ProviderFacet;
  ingestRunId: string;
  syncRunId: string;
  rawRecords: unknown[];
};

export type AlertsJobData = {
  siteId?: string;
  linkId?: string;
  orgId: string;
  ingestRunId: string;
  syncRunId: string;
  mode: SyncMode;
};

export type LinkJobData = {
  linkId: string;
  orgId: string;
  provider: string;
  facets?: ProviderFacet[];
  ingestRunId: string;
  syncRunId: string;
  linkMeta?: Record<string, unknown>;
  integrationConfig?: Record<string, unknown>;
};

export type EnrichJobData = {
  linkId: string;
  orgId: string;
  provider: string;
  facets?: ProviderFacet[];
  ingestRunId: string;
  syncRunId: string;
  linkMeta?: Record<string, unknown>;
  integrationConfig?: Record<string, unknown>;
};

export type ComplianceJobData = {
  siteId?: string;
  linkId?: string;
  orgId: string;
  frameworkId: string;
};
