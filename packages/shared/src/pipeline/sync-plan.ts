import { FULL_SYNC_INTERVAL_MS } from '../constants.js';
import { INTEGRATIONS } from '../config/integrations/index.js';
import type { ProviderFacet } from '../libs/provider.js';
import type { ProviderId } from '../constants.js';
import type { FacetSyncConfig } from '../types/integration.js';

export type SyncContextLike = {
  type: string;
  lastSuccessAt: Date | string | null;
  consecutiveFailures?: number;
};

export type PipelineOverrideConfig = {
  pipeline?: {
    enabled?: boolean;
    facets?: Record<string, FacetSyncConfig>;
  };
  sync?: {
    enabled?: boolean;
    facets?: Record<string, FacetSyncConfig>;
  };
};

export type ResolveFacetPlanParams = {
  providerId: string;
  contexts?: SyncContextLike[];
  integrationConfig?: Record<string, unknown>;
  linkMeta?: Record<string, unknown>;
  requestedFacets?: ProviderFacet[];
  includeDependencies?: boolean;
  force?: boolean;
  now?: Date;
};

export type ResolvedFacetPlan = {
  facets: ProviderFacet[];
  skipped: Array<{ facet: ProviderFacet; reason: 'disabled' | 'not_due' | 'unknown' }>;
};

function providerConfig(providerId: string) {
  return INTEGRATIONS[providerId as ProviderId];
}

export function getProviderFacets(providerId: string): ProviderFacet[] {
  return providerConfig(providerId)?.supportedFacets.map((f) => f.facet) ?? [];
}

function baseFacetConfig(providerId: string, facet: ProviderFacet): FacetSyncConfig {
  const facetConfig = providerConfig(providerId)?.supportedFacets.find((f) => f.facet === facet);
  return {
    enabled: true,
    intervalMs: FULL_SYNC_INTERVAL_MS,
    dependencies: [],
    ...facetConfig?.sync,
  };
}

function readOverrides(config?: Record<string, unknown>): PipelineOverrideConfig['pipeline'] {
  const typed = config as PipelineOverrideConfig | undefined;
  return typed?.pipeline ?? typed?.sync;
}

function mergeFacetConfig(providerId: string, facet: ProviderFacet, ...sources: Array<Record<string, unknown> | undefined>): FacetSyncConfig {
  let merged = baseFacetConfig(providerId, facet);

  for (const source of sources) {
    const overrides = readOverrides(source);
    if (overrides?.enabled === false) {
      merged = { ...merged, enabled: false };
    }
    const facetOverride = overrides?.facets?.[facet];
    if (facetOverride) {
      merged = { ...merged, ...facetOverride };
    }
  }

  return merged;
}

function lastSuccess(contexts: SyncContextLike[], facet: ProviderFacet): Date | undefined {
  const value = contexts.find((c) => c.type === facet)?.lastSuccessAt;
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function addWithDependencies(
  providerId: string,
  facet: ProviderFacet,
  selected: Set<ProviderFacet>,
  known: Set<ProviderFacet>,
  contexts: SyncContextLike[],
  now: Date,
  force: boolean,
  integrationConfig?: Record<string, unknown>,
  linkMeta?: Record<string, unknown>,
) {
  if (!known.has(facet) || selected.has(facet)) return;
  selected.add(facet);

  const cfg = mergeFacetConfig(providerId, facet, integrationConfig, linkMeta);
  for (const dependency of cfg.dependencies ?? []) {
    if (!force) {
      const { due } = isFacetDue(providerId, dependency, contexts, now, integrationConfig, linkMeta);
      if (!due) continue;
    }
    addWithDependencies(providerId, dependency, selected, known, contexts, now, force, integrationConfig, linkMeta);
  }
}

function isFacetDue(
  providerId: string,
  facet: ProviderFacet,
  contexts: SyncContextLike[],
  now: Date,
  integrationConfig?: Record<string, unknown>,
  linkMeta?: Record<string, unknown>,
): { due: boolean; disabled: boolean } {
  const cfg = mergeFacetConfig(providerId, facet, integrationConfig, linkMeta);
  if (cfg.enabled === false) return { due: false, disabled: true };

  const last = lastSuccess(contexts, facet);
  const intervalMs = cfg.intervalMs ?? FULL_SYNC_INTERVAL_MS;
  return { due: !last || now.getTime() - last.getTime() >= intervalMs, disabled: false };
}

export function resolveFacetPlan(params: ResolveFacetPlanParams): ResolvedFacetPlan {
  const {
    providerId,
    contexts = [],
    integrationConfig,
    linkMeta,
    requestedFacets,
    includeDependencies = true,
    force = false,
    now = new Date(),
  } = params;

  const providerFacets = getProviderFacets(providerId);
  const known = new Set(providerFacets);
  const sourceFacets = requestedFacets?.length ? requestedFacets : providerFacets;
  const selected = new Set<ProviderFacet>();
  const skipped: ResolvedFacetPlan['skipped'] = [];
  const requested = new Set(requestedFacets ?? []);

  for (const facet of sourceFacets) {
    if (!known.has(facet)) {
      skipped.push({ facet, reason: 'unknown' });
      continue;
    }

    if (!force && requested.size === 0) {
      const dueState = isFacetDue(providerId, facet, contexts, now, integrationConfig, linkMeta);
      if (dueState.disabled) {
        skipped.push({ facet, reason: 'disabled' });
        continue;
      }
      if (!dueState.due) {
        skipped.push({ facet, reason: 'not_due' });
        continue;
      }
    }

    if (includeDependencies) {
      addWithDependencies(providerId, facet, selected, known, contexts, now, force, integrationConfig, linkMeta);
    } else {
      selected.add(facet);
    }
  }

  const facets = providerFacets.filter((facet) => {
    if (!selected.has(facet)) return false;

    const cfg = mergeFacetConfig(providerId, facet, integrationConfig, linkMeta);
    if (cfg.enabled === false) {
      skipped.push({ facet, reason: 'disabled' });
      return false;
    }

    if (force || requested.size > 0) return true;
    return true;
  });

  return { facets, skipped };
}
