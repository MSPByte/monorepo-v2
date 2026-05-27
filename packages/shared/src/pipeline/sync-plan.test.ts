import { describe, expect, it } from 'vitest';
import { ProviderFacet, resolveFacetPlan } from '../index.js';

describe('resolveFacetPlan', () => {
  it('schedules due facets and includes their dependencies', () => {
    const now = new Date('2026-05-27T12:00:00.000Z');

    const plan = resolveFacetPlan({
      providerId: 'microsoft-365',
      now,
      contexts: [
        {
          type: ProviderFacet.M365Identities,
          lastSuccessAt: new Date('2026-05-27T10:30:00.000Z'),
        },
        {
          type: ProviderFacet.M365TeamsConfig,
          lastSuccessAt: new Date('2026-05-27T10:30:00.000Z'),
        },
      ],
    });

    expect(plan.facets).toContain(ProviderFacet.M365Identities);
    expect(plan.facets).toContain(ProviderFacet.M365CAPolicies);
    expect(plan.facets).toContain(ProviderFacet.M365Groups);
    expect(plan.facets).not.toContain(ProviderFacet.M365TeamsConfig);
  });

  it('uses link-level facet interval overrides', () => {
    const now = new Date('2026-05-27T12:00:00.000Z');

    const plan = resolveFacetPlan({
      providerId: 'microsoft-365',
      now,
      contexts: [
        {
          type: ProviderFacet.M365Identities,
          lastSuccessAt: new Date('2026-05-27T11:30:00.000Z'),
        },
      ],
      linkMeta: {
        pipeline: {
          facets: {
            [ProviderFacet.M365Identities]: { intervalMs: 15 * 60 * 1000 },
          },
        },
      },
    });

    expect(plan.facets).toContain(ProviderFacet.M365Identities);
  });

  it('allows manual facet selection for development dashboard queueing', () => {
    const plan = resolveFacetPlan({
      providerId: 'microsoft-365',
      requestedFacets: [ProviderFacet.M365Identities],
      includeDependencies: true,
      force: true,
    });

    expect(plan.facets).toEqual([
      ProviderFacet.M365Identities,
      ProviderFacet.M365Groups,
      ProviderFacet.M365CAPolicies,
    ]);
  });
});
