import { ProviderFacet } from './libs/index.js';

export const PROVIDER_IDS = {
  M365: 'microsoft-365',
  SOPHOS: 'sophos-partner',
  DATTO: 'dattormm',
  COVE: 'cove',
  MSPAGENT: 'mspagent',
  HALOPSA: 'halopsa'
} as const;

export type ProviderId = (typeof PROVIDER_IDS)[keyof typeof PROVIDER_IDS];

export const PROVIDER_FACETS: Record<string, ProviderFacet[]> = {
  [PROVIDER_IDS.M365]: [
    ProviderFacet.M365Identities,
    ProviderFacet.M365Groups,
    ProviderFacet.M365Licenses,
    ProviderFacet.M365CAPolicies,
    ProviderFacet.M365AuthMethods,
    ProviderFacet.M365Devices,
    ProviderFacet.M365OAuthGrants,
    ProviderFacet.M365RiskyUsers,
    ProviderFacet.M365ExchangeConfig,
    ProviderFacet.M365DomainConfig,
    ProviderFacet.M365TeamsConfig,
    ProviderFacet.M365MailboxForwarding,
    ProviderFacet.M365InboxRules
  ],
  [PROVIDER_IDS.SOPHOS]: [
    ProviderFacet.SophosEndpoints,
    ProviderFacet.SophosFirewalls,
    ProviderFacet.SophosLicenses
  ],
  [PROVIDER_IDS.DATTO]: [ProviderFacet.DattoEndpoints],
  [PROVIDER_IDS.COVE]: [ProviderFacet.CoveEndpoints]
};

export const MAX_CONSECUTIVE_FAILURES = 10;
export const FULL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const STALE_RUN_THRESHOLD_MS = 4 * 60 * 60 * 1000;

// Maps facet → drizzle vendorTableRegistry key — used in normalize.worker
export const FACET_TABLE_MAP: Partial<Record<ProviderFacet, string>> = {
  [ProviderFacet.M365Identities]: 'm365Identities',
  [ProviderFacet.M365Groups]: 'm365Groups',
  [ProviderFacet.M365Licenses]: 'm365Licenses',
  [ProviderFacet.M365CAPolicies]: 'm365Policies',
  [ProviderFacet.M365AuthMethods]: 'm365AuthMethods',
  [ProviderFacet.M365Devices]: 'm365Devices',
  [ProviderFacet.M365OAuthGrants]: 'm365OAuthGrants',
  [ProviderFacet.M365DomainConfig]: 'm365DomainConfig',
  [ProviderFacet.M365TeamsConfig]: 'm365TeamsConfig',
  [ProviderFacet.M365RiskyUsers]: 'm365RiskyUsers',
  [ProviderFacet.M365MailboxForwarding]: 'm365MailboxForwarding',
  [ProviderFacet.M365InboxRules]: 'm365InboxRules',
  [ProviderFacet.M365ExchangeConfig]: 'm365ExchangeConfigs',
  [ProviderFacet.SophosEndpoints]: 'sophosEndpoints',
  [ProviderFacet.SophosFirewalls]: 'sophosFirewalls',
  [ProviderFacet.SophosLicenses]: 'sophosLicenses',
  [ProviderFacet.DattoEndpoints]: 'dattoEndpoints',
  [ProviderFacet.CoveEndpoints]: 'coveEndpoints'
};
