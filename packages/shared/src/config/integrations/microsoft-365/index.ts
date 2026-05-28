import { ProviderFacet } from '../../../libs/provider.js';
import type { Integration } from '../../../types/integration.js';
import { M365PoliciesShape } from './policies.js';

export const CONSENT_VERSION = 4;

export const REQUIRED_DIRECTORY_ROLES: Record<string, string> = {
  'Exchange Administrator': '29232cdf-9323-42fd-ade2-1d097af3e4de',
  'Teams Administrator': '69091246-20e8-4a56-aa4d-066075b2a7a8'
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
      db: { table: 'm365Identities', name: 'M365 Identities', shape: {} },
      sync: {
        intervalMs: 60 * 60 * 1000,
        dependencies: [ProviderFacet.M365CAPolicies, ProviderFacet.M365Groups]
      }
    },
    {
      facet: ProviderFacet.M365AuthMethods,
      scopeLevel: 'link',
      db: { table: 'm365AuthMethods', name: 'M365 Auth Methods', shape: {} }
    },
    {
      facet: ProviderFacet.M365Groups,
      scopeLevel: 'link',
      db: { table: 'm365Groups', name: 'M365 Groups', shape: {} }
    },
    {
      facet: ProviderFacet.M365Licenses,
      scopeLevel: 'link',
      db: { table: 'm365Licenses', name: 'M365 Roles', shape: {} }
    },
    {
      facet: ProviderFacet.M365CAPolicies,
      scopeLevel: 'link',
      db: { table: 'm365Policies', name: 'M365 CA Policies', shape: M365PoliciesShape }
    },
    {
      facet: ProviderFacet.M365ExchangeConfig,
      scopeLevel: 'link',
      db: { table: 'm365ExchangeConfigs', name: 'M365 Exchange', shape: {} }
    },
    {
      facet: ProviderFacet.M365Devices,
      scopeLevel: 'link',
      db: { table: 'm365Devices', name: 'M365 Devices', shape: {} }
    },
    {
      facet: ProviderFacet.M365OAuthGrants,
      scopeLevel: 'link',
      db: { table: 'm365OAuthGrants', name: 'M365 OAuth Grants', shape: {} }
    },
    {
      facet: ProviderFacet.M365DomainConfig,
      scopeLevel: 'link',
      db: { table: 'm365DomainConfig', name: 'M365 Domains', shape: {} }
    },
    {
      facet: ProviderFacet.M365TeamsConfig,
      scopeLevel: 'link',
      db: { table: 'm365TeamsConfig', name: 'M365 Teams', shape: {} },
      sync: { intervalMs: 24 * 60 * 60 * 1000 }
    },
    {
      facet: ProviderFacet.M365RiskyUsers,
      scopeLevel: 'link',
      db: { table: 'm365RiskyUsers', name: 'M365 Risky Users', shape: {} }
    },
    {
      facet: ProviderFacet.M365MailboxForwarding,
      scopeLevel: 'link',
      db: { table: 'm365MailboxForwarding', name: 'M365 Mailbox Forwarding', shape: {} }
    },
    {
      facet: ProviderFacet.M365InboxRules,
      scopeLevel: 'link',
      db: { table: 'm365InboxRules', name: 'M365 Inbox Rules', shape: {} }
    }
  ],
  navigation: [
    { label: 'Identities', route: '/identities', isNullable: false },
    { label: 'Groups', route: '/groups', isNullable: false },
    { label: 'Devices', route: '/devices', isNullable: false },
    { label: 'Licenses', route: '/licenses', isNullable: false },
    { label: 'Roles', route: '/roles', isNullable: true },
    { label: 'Policies', route: '/policies', isNullable: false },
    { label: 'OAuth Grants', route: '/oauth-grants', isNullable: false },
    { label: 'Domain Security', route: '/domain-security', isNullable: false },
    { label: 'Teams', route: '/teams', isNullable: false },
    { label: 'Exchange', route: '/exchange', isNullable: false },
    { label: 'Security', route: '/security', isNullable: false },
    { label: 'Compliance', route: '/compliance', isNullable: false }
  ]
};
