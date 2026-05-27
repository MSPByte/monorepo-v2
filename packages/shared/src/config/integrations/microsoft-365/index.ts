import { ProviderFacet } from '../../../libs/provider.js';
import type { Integration } from '../../../types/integration.js';
import { M365PoliciesShape } from './policies.js';

export const CONSENT_VERSION = 4;

export const REQUIRED_DIRECTORY_ROLES: Record<string, string> = {
  'Exchange Administrator': '29232cdf-9323-42fd-ade2-1d097af3e4de',
  'Teams Administrator': '69091246-20e8-4a56-aa4d-066075b2a7a8',
};

export const M365_INTEGRATION_CONFIG: Integration = {
  id: 'microsoft-365',
  name: 'Microsoft 365',
  category: 'security',
  scope: 'link',
  supportedFacets: [
    {
      facet: ProviderFacet.M365Identities,
      scopeLevel: 'link',
      db: { table: 'm365Identities', shape: {} },
    },
    {
      facet: ProviderFacet.M365AuthMethods,
      scopeLevel: 'link',
      db: { table: 'm365AuthMethods', shape: {} },
    },
    {
      facet: ProviderFacet.M365Groups,
      scopeLevel: 'link',
      db: { table: 'm365Groups', shape: {} },
    },
    {
      facet: ProviderFacet.M365Licenses,
      scopeLevel: 'link',
      db: { table: 'm365Licenses', shape: {} },
    },
    {
      facet: ProviderFacet.M365CAPolicies,
      scopeLevel: 'link',
      db: { table: 'm365Policies', shape: M365PoliciesShape },
    },
    {
      facet: ProviderFacet.M365ExchangeConfig,
      scopeLevel: 'link',
      db: { table: 'm365ExchangeConfigs', shape: {} },
    },
    {
      facet: ProviderFacet.M365Devices,
      scopeLevel: 'link',
      db: { table: 'm365Devices', shape: {} },
    },
    {
      facet: ProviderFacet.M365OAuthGrants,
      scopeLevel: 'link',
      db: { table: 'm365OAuthGrants', shape: {} },
    },
    {
      facet: ProviderFacet.M365DomainConfig,
      scopeLevel: 'link',
      db: { table: 'm365DomainConfig', shape: {} },
    },
    {
      facet: ProviderFacet.M365TeamsConfig,
      scopeLevel: 'link',
      db: { table: 'm365TeamsConfig', shape: {} },
    },
    {
      facet: ProviderFacet.M365RiskyUsers,
      scopeLevel: 'link',
      db: { table: 'm365RiskyUsers', shape: {} },
    },
    {
      facet: ProviderFacet.M365MailboxForwarding,
      scopeLevel: 'link',
      db: { table: 'm365MailboxForwarding', shape: {} },
    },
    {
      facet: ProviderFacet.M365InboxRules,
      scopeLevel: 'link',
      db: { table: 'm365InboxRules', shape: {} },
    },
  ],
  navigation: [
    { label: 'Identities', route: '/identities', isNullable: true },
    { label: 'Groups', route: '/groups', isNullable: true },
    { label: 'Devices', route: '/devices', isNullable: true },
    { label: 'Licenses', route: '/licenses', isNullable: true },
    { label: 'Policies', route: '/policies', isNullable: true },
    { label: 'OAuth Grants', route: '/oauth-grants', isNullable: true },
    { label: 'Domain Security', route: '/domain-security', isNullable: true },
    { label: 'Teams', route: '/teams', isNullable: true },
    { label: 'Exchange', route: '/exchange', isNullable: true },
    { label: 'Security', route: '/security', isNullable: true },
    { label: 'Compliance', route: '/compliance', isNullable: false },
  ],
};
