import type { ProviderFacet } from '../libs/provider.js';
import type { ProviderId } from '../constants.js';
import type { SchemaFields } from './schema-registry.js';

export type IntegrationCategory = 'psa' | 'rmm' | 'recovery' | 'security' | 'identity' | 'other';
export type IntegrationScope = 'site' | 'link';

export type DbRoute = {
  table: string;
  name: string;
  shape: SchemaFields;
};

export type FacetSyncConfig = {
  enabled?: boolean;
  intervalMs?: number;
  dependencies?: ProviderFacet[];
};

export type IngestTypeConfig = {
  facet: ProviderFacet;
  scopeLevel: IntegrationScope;
  db?: DbRoute;
  sync?: FacetSyncConfig;
};

export type IntegrationNavItem = {
  label: string;
  route: string;
  isNullable: boolean;
};

export type Integration = {
  id: ProviderId;
  name: string;
  category: IntegrationCategory;
  scope: IntegrationScope;
  supportedFacets: IngestTypeConfig[];
  navigation: IntegrationNavItem[];
};
