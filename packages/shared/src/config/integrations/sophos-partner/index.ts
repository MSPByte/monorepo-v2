import { ProviderFacet } from '../../../libs/provider.js';
import type { Integration } from '../../../types/integration.js';

export const SOPHOS_PARTNER_CONFIG: Integration = {
  id: 'sophos-partner',
  name: 'Sophos Partner',
  category: 'security',
  scope: 'site',
  supportedFacets: [
    {
      facet: ProviderFacet.SophosEndpoints,
      scopeLevel: 'link',
      db: { table: 'sophosEndpoints', shape: {} },
    },
    {
      facet: ProviderFacet.SophosFirewalls,
      scopeLevel: 'link',
      db: { table: 'sophosFirewalls', shape: {} },
    },
    {
      facet: ProviderFacet.SophosLicenses,
      scopeLevel: 'link',
      db: { table: 'sophosLicenses', shape: {} },
    },
  ],
  navigation: [
    { label: 'Endpoints', route: '/endpoints', isNullable: true },
    { label: 'Firewalls', route: '/firewalls', isNullable: true },
    { label: 'Licenses', route: '/licenses', isNullable: true },
  ],
};
