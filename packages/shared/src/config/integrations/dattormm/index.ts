import { ProviderFacet } from '../../../libs/provider.js';
import type { Integration } from '../../../types/integration.js';

export const DATTO_RMM_CONFIG: Integration = {
  id: 'dattormm',
  name: 'DattoRMM',
  category: 'rmm',
  scope: 'site',
  supportedFacets: [
    {
      facet: ProviderFacet.DattoEndpoints,
      scopeLevel: 'link',
      db: { table: 'dattoEndpoints', shape: {} },
    },
  ],
  navigation: [
    { label: 'Endpoints', route: '/endpoints', isNullable: true },
  ],
};
