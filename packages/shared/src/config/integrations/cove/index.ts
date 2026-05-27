import { ProviderFacet } from '../../../libs/provider.js';
import type { Integration } from '../../../types/integration.js';

export const COVE_CONFIG: Integration = {
  id: 'cove',
  name: 'Cove',
  category: 'recovery',
  scope: 'site',
  supportedFacets: [
    {
      facet: ProviderFacet.CoveEndpoints,
      scopeLevel: 'link',
      db: { table: 'coveEndpoints', shape: {} },
    },
  ],
  navigation: [
    { label: 'Endpoints', route: '/endpoints', isNullable: true },
  ],
};
