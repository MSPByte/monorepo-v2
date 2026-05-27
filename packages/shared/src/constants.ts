import { ProviderFacet } from './libs/index.js';

export const PROVIDER_IDS = {
  M365: 'microsoft-365',
  SOPHOS: 'sophos-partner',
  DATTO: 'dattormm',
  COVE: 'cove',
  MSPAGENT: 'mspagent',
  HALOPSA: 'halopsa',
} as const;

export type ProviderId = (typeof PROVIDER_IDS)[keyof typeof PROVIDER_IDS];

// Maps facet → drizzle vendorTableRegistry key — used in normalize.worker
export const FACET_TABLE_MAP: Partial<Record<ProviderFacet, string>> = {
  [ProviderFacet.M365Identities]:        'm365Identities',
  [ProviderFacet.M365Groups]:            'm365Groups',
  [ProviderFacet.M365Licenses]:          'm365Licenses',
  [ProviderFacet.M365CAPolicies]:        'm365Policies',
  [ProviderFacet.M365AuthMethods]:       'm365AuthMethods',
  [ProviderFacet.M365Devices]:           'm365Devices',
  [ProviderFacet.M365OAuthGrants]:       'm365OAuthGrants',
  [ProviderFacet.M365DomainConfig]:      'm365DomainConfig',
  [ProviderFacet.M365TeamsConfig]:       'm365TeamsConfig',
  [ProviderFacet.M365RiskyUsers]:        'm365RiskyUsers',
  [ProviderFacet.M365MailboxForwarding]: 'm365MailboxForwarding',
  [ProviderFacet.M365InboxRules]:        'm365InboxRules',
  [ProviderFacet.M365ExchangeConfig]:    'm365ExchangeConfigs',
  [ProviderFacet.SophosEndpoints]:       'sophosEndpoints',
  [ProviderFacet.SophosFirewalls]:       'sophosFirewalls',
  [ProviderFacet.SophosLicenses]:        'sophosLicenses',
  [ProviderFacet.DattoEndpoints]:        'dattoEndpoints',
  [ProviderFacet.CoveEndpoints]:         'coveEndpoints',
};
