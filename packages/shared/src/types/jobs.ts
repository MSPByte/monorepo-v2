import type { ProviderFacet } from '../libs/provider.js';

export type FetchJobData = {
  linkId: string;
  siteId?: string;
  orgId: string;
  provider: string;
  facet: ProviderFacet;
  ingestRunId: string;
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
  rawRecords: unknown[];
};

export type AlertsJobData = {
  siteId?: string;
  linkId?: string;
  orgId: string;
  ingestRunId: string;
};

export type LinkJobData = {
  linkId: string;
  orgId: string;
  provider: string;
  ingestRunId: string;
  linkMeta?: Record<string, unknown>;
  integrationConfig?: Record<string, unknown>;
};

export type EnrichJobData = {
  linkId: string;
  orgId: string;
  provider: string;
  ingestRunId: string;
  linkMeta?: Record<string, unknown>;
  integrationConfig?: Record<string, unknown>;
};

export type ComplianceJobData = {
  siteId?: string;
  linkId?: string;
  orgId: string;
  frameworkId: string;
};
