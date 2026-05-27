import type { ZodSchema } from 'zod';

export type AdapterContext = {
  linkMeta?: Record<string, unknown>;
  integrationConfig?: Record<string, unknown>;
  orgId?: string;
};

export enum ProviderFacet {
  // Microsoft 365
  M365Identities        = 'm365_identities',
  M365Groups            = 'm365_groups',
  M365Licenses          = 'm365_licenses',
  M365CAPolicies        = 'm365_ca_policies',
  M365AuthMethods       = 'm365_auth_methods',
  M365Devices           = 'm365_devices',
  M365OAuthGrants       = 'm365_oauth_grants',
  M365DomainConfig      = 'm365_domain_config',
  M365TeamsConfig       = 'm365_teams_config',
  M365RiskyUsers        = 'm365_risky_users',
  M365MailboxForwarding = 'm365_mailbox_forwarding',
  M365InboxRules        = 'm365_inbox_rules',
  M365ExchangeConfig    = 'm365_exchange_config',
  // Sophos Partner
  SophosEndpoints       = 'sophos_endpoints',
  SophosFirewalls       = 'sophos_firewalls',
  SophosLicenses        = 'sophos_licenses',
  // Datto RMM
  DattoEndpoints        = 'datto_endpoints',
  // Cove
  CoveEndpoints         = 'cove_endpoints',
}

export interface ProviderAdapter<TRaw = unknown, TNormalized = unknown> {
  readonly providerId: string;
  readonly facets: ProviderFacet[];
  getAuthHeaders(linkId: string, ctx?: AdapterContext): Promise<Record<string, string>>;
  fetchFacet(
    linkId: string,
    facet: ProviderFacet,
    cursor?: string,
    ctx?: AdapterContext
  ): AsyncGenerator<TRaw[]>;
  normalize(raw: TRaw, facet: ProviderFacet): TNormalized;
  rawSchema: ZodSchema<TRaw>;
}
