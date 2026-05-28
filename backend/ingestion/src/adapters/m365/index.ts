import { z } from 'zod';
import dns from 'node:dns';
import {
  ProviderFacet,
  M365Connector,
  SkuCatalogService,
  externalInboxRuleRecipients
} from '@mspbyte/shared';
import type { ProviderAdapter, AdapterContext } from '@mspbyte/shared';
import { logger } from '../../logger.js';
import { env } from '../../env.js';
import {
  runExchangeOnlineFull,
  runExchangeOnlineDomainConfig,
  runMicrosoftTeams,
  runMailboxForwardingFull,
  runInboxRules
} from './ps-runner.js';

function getConnector(gdapTenantId: string): M365Connector {
  const clientId = env.MICROSOFT_CLIENT_ID;
  const clientSecret = env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('M365 credentials not configured'), { failParent: true });
  }
  return new M365Connector(clientId, clientSecret, gdapTenantId);
}

// ─── Zod schemas ────────────────────────────────────────────────────────────

const M365UserSchema = z
  .object({
    id: z.string(),
    displayName: z.string().nullable().optional(),
    userType: z.string().nullable().optional(),
    userPrincipalName: z.string(),
    accountEnabled: z.boolean().optional(),
    assignedLicenses: z.array(z.object({ skuId: z.string() })).optional(),
    signInActivity: z
      .object({
        lastSignInDateTime: z.string().nullable().optional(),
        lastNonInteractiveSignInDateTime: z.string().nullable().optional()
      })
      .optional()
  })
  .passthrough();

const M365GroupSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    description: z.string().nullable().optional(),
    groupTypes: z.array(z.string()).optional(),
    mailEnabled: z.boolean(),
    securityEnabled: z.boolean().optional()
  })
  .passthrough();

const M365SubscribedSkuSchema = z
  .object({
    skuId: z.string(),
    skuPartNumber: z.string(),
    capabilityStatus: z.string(),
    consumedUnits: z.number().optional(),
    prepaidUnits: z
      .object({
        enabled: z.number().optional(),
        suspended: z.number().optional(),
        warning: z.number().optional(),
        lockedOut: z.number().optional()
      })
      .optional(),
    servicePlans: z
      .array(z.object({ servicePlanName: z.string() }))
      .optional()
      .default([]),
    _friendlyName: z.string().optional()
  })
  .passthrough();

const M365CAPolicySchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    state: z.enum(['enabled', 'disabled', 'enabledForReportingButNotEnforced']),
    conditions: z.record(z.string(), z.unknown()).optional(),
    grantControls: z.record(z.string(), z.unknown()).nullable().optional(),
    sessionControls: z.record(z.string(), z.unknown()).nullable().optional()
  })
  .passthrough();

const M365AuthMethodSchema = z
  .object({
    id: z.string(),
    '@odata.type': z.string(),
    createdDateTime: z.string().nullable().optional(),
    _identity_external_id: z.string(),
    _method_type: z.string()
  })
  .passthrough();

const M365DeviceSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    operatingSystem: z.string().nullable().optional(),
    operatingSystemVersion: z.string().nullable().optional(),
    isCompliant: z.boolean().nullable().optional(),
    isManaged: z.boolean().nullable().optional(),
    deviceOwnership: z.string().nullable().optional(),
    approximateLastSignInDateTime: z.string().nullable().optional(),
    registrationDateTime: z.string().nullable().optional()
  })
  .passthrough();

const M365OAuthGrantSchema = z
  .object({
    id: z.string(),
    clientId: z.string(),
    consentType: z.string(),
    principalId: z.string().nullable().optional(),
    resourceId: z.string(),
    scope: z.string().nullable().optional(),
    clientDisplayName: z.string().nullable().optional(),
    resourceDisplayName: z.string().nullable().optional()
  })
  .passthrough();

const M365RiskyUserSchema = z
  .object({
    id: z.string(),
    userPrincipalName: z.string(),
    userDisplayName: z.string().nullable().optional(),
    riskLevel: z.string(),
    riskState: z.string(),
    riskDetail: z.string().nullable().optional(),
    riskLastUpdatedDateTime: z.string().nullable().optional()
  })
  .passthrough();

export type M365User = z.infer<typeof M365UserSchema>;
export type M365Group = z.infer<typeof M365GroupSchema>;

// ─── PowerShell result schemas ───────────────────────────────────────────────

const PSExchangeConfigSchema = z.object({
  OrgConfig: z.object({ RejectDirectSend: z.boolean() }).nullable().optional(),
  AutoForwardingMode: z.string().nullable().optional(),
  AuthPolicies: z
    .array(z.object({ Name: z.string(), AllowBasicAuthSmtp: z.boolean().nullable().optional() }))
    .default([]),
  ForwardingMailboxes: z
    .array(
      z.object({
        UserPrincipalName: z.string(),
        ForwardingSmtpAddress: z.string().nullable().optional()
      })
    )
    .default([])
});

const PSDomainItemSchema = z.object({
  domainName: z.string(),
  spfRecord: z.string().nullable().optional(),
  spfIsPermissive: z.boolean().nullable().optional(),
  dmarcRecord: z.string().nullable().optional(),
  dmarcPolicy: z.string().nullable().optional(),
  dkimEnabled: z.boolean().nullable().optional(),
  dkimSelector1Present: z.boolean().nullable().optional(),
  dkimSelector2Present: z.boolean().nullable().optional()
});

const PSTeamsConfigSchema = z.object({
  MeetingPolicy: z
    .object({
      AllowAnonymousUsersToJoinMeeting: z.boolean().nullable().optional(),
      AllowExternalParticipantGiveRequestControl: z.boolean().nullable().optional(),
      AllowPSTNUsersToBypassLobby: z.boolean().nullable().optional(),
      AutoAdmittedUsers: z.string().nullable().optional()
    })
    .nullable()
    .optional(),
  FederationConfig: z
    .object({
      AllowFederatedUsers: z.boolean().nullable().optional(),
      AllowPublicUsers: z.boolean().nullable().optional(),
      AllowTeamsConsumer: z.boolean().nullable().optional(),
      AllowedDomains: z
        .union([z.array(z.string().nullable()), z.unknown()])
        .nullable()
        .optional()
    })
    .nullable()
    .optional()
});

const PSMailboxItemSchema = z.object({
  UserPrincipalName: z.string(),
  ForwardingAddress: z.string().nullable().optional(),
  ForwardingSmtpAddress: z.string().nullable().optional(),
  DeliverToMailboxAndForward: z.boolean().nullable().optional()
});

const PSInboxRuleItemSchema = z.object({
  Name: z.string(),
  Identity: z.string().nullable().optional(),
  MailboxUserPrincipalName: z.string(),
  Enabled: z.boolean().nullable().optional(),
  DeleteMessage: z.boolean().nullable().optional(),
  MoveToFolder: z.string().nullable().optional(),
  ForwardTo: z.array(z.string()).nullable().optional(),
  ForwardAsAttachmentTo: z.array(z.string()).nullable().optional(),
  RedirectTo: z.array(z.string()).nullable().optional(),
  MarkAsRead: z.boolean().nullable().optional(),
  SubjectContainsWords: z.array(z.string()).nullable().optional()
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

type DnsResult = {
  spfRecord?: string;
  spfIsPermissive?: boolean;
  dmarcRecord?: string;
  dmarcPolicy?: string;
};

async function resolveDomainDns(domains: string[]): Promise<Record<string, DnsResult>> {
  const results: Record<string, DnsResult> = {};
  await Promise.all(
    domains.map(async (domain) => {
      const entry: DnsResult = {};
      try {
        const chunks = await dns.promises.resolveTxt(domain);
        const spf = chunks.map((c) => c.join('')).find((r) => r.startsWith('v=spf1'));
        if (spf) {
          entry.spfRecord = spf;
          entry.spfIsPermissive = !spf.includes('-all');
        }
      } catch {
        /* no SPF or DNS failure */
      }
      try {
        const chunks = await dns.promises.resolveTxt(`_dmarc.${domain}`);
        const dmarc = chunks.map((c) => c.join('')).find((r) => r.startsWith('v=DMARC1'));
        if (dmarc) {
          entry.dmarcRecord = dmarc;
          const match = dmarc.match(/\bp=(\w+)/);
          entry.dmarcPolicy = match?.[1]?.toLowerCase();
        }
      } catch {
        /* no DMARC or DNS failure */
      }
      results[domain] = entry;
    })
  );
  return results;
}

function getCertPem(): string | null {
  const raw = env.MICROSOFT_CERT_PEM;
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.includes('-----BEGIN')) return decoded;
  } catch {
    /* not base64 */
  }
  return raw;
}

// ─── Normalize helpers ───────────────────────────────────────────────────────

function normalizeIdentity(raw: M365User) {
  return {
    externalId: raw.id,
    name: raw.displayName ?? raw.userPrincipalName,
    email: raw.userPrincipalName,
    type: (raw.userType?.toLowerCase() === 'guest'
      ? 'guest'
      : raw.userType?.toLowerCase() === 'member'
        ? 'member'
        : 'service') as 'member' | 'guest' | 'service',
    enabled: raw.accountEnabled ?? true,
    mfaEnforced: false, // updated by auth_methods facet
    assignedLicenses: raw.assignedLicenses?.map((l) => l.skuId) ?? [],
    lastSignInAt: raw.signInActivity?.lastSignInDateTime
      ? new Date(raw.signInActivity.lastSignInDateTime)
      : null,
    lastNonInteractiveSignInAt: raw.signInActivity?.lastNonInteractiveSignInDateTime
      ? new Date(raw.signInActivity.lastNonInteractiveSignInDateTime)
      : null
  };
}

function normalizeGroup(raw: z.infer<typeof M365GroupSchema>) {
  return {
    externalId: raw.id,
    name: raw.displayName,
    description: raw.description ?? null,
    mailEnabled: raw.mailEnabled,
    securityEnabled: raw.securityEnabled ?? false
  };
}

function normalizeLicense(raw: z.infer<typeof M365SubscribedSkuSchema>) {
  return {
    externalId: raw.skuId,
    skuId: raw.skuId,
    skuPartNumber: raw.skuPartNumber,
    friendlyName: raw._friendlyName ?? raw.skuPartNumber,
    enabled: raw.capabilityStatus === 'Enabled',
    totalUnits: raw.prepaidUnits?.enabled ?? 0,
    consumedUnits: raw.consumedUnits ?? 0,
    suspendedUnits: raw.prepaidUnits?.suspended ?? 0,
    warningUnits: raw.prepaidUnits?.warning ?? 0,
    lockedOutUnits: raw.prepaidUnits?.lockedOut ?? 0,
    servicePlanNames: raw.servicePlans?.map((s) => s.servicePlanName) ?? []
  };
}

function normalizePolicy(raw: z.infer<typeof M365CAPolicySchema>) {
  return {
    externalId: raw.id,
    name: raw.displayName,
    description: null,
    policyState: raw.state,
    conditions: raw.conditions ?? null,
    grantControls: raw.grantControls ?? null,
    sessionControls: raw.sessionControls ?? null
  };
}

function normalizeAuthMethod(raw: z.infer<typeof M365AuthMethodSchema>) {
  return {
    externalId: `${raw._identity_external_id}_${raw.id}`,
    identityExternalId: raw._identity_external_id,
    type: raw._method_type,
    creationDateAt: raw.createdDateTime ? new Date(raw.createdDateTime) : null,
    meta: raw
  };
}

function normalizeDevice(raw: z.infer<typeof M365DeviceSchema>) {
  return {
    externalId: raw.id,
    displayName: raw.displayName,
    operatingSystem: raw.operatingSystem ?? null,
    operatingSystemVersion: raw.operatingSystemVersion ?? null,
    isCompliant: raw.isCompliant ?? null,
    isManaged: raw.isManaged ?? null,
    deviceOwnership: raw.deviceOwnership ?? null,
    approximateLastSignInAt: raw.approximateLastSignInDateTime
      ? new Date(raw.approximateLastSignInDateTime)
      : null,
    registeredAt: raw.registrationDateTime ? new Date(raw.registrationDateTime) : null
  };
}

function normalizeOAuthGrant(raw: z.infer<typeof M365OAuthGrantSchema>) {
  return {
    externalId: raw.id,
    clientId: raw.clientId,
    clientDisplayName: raw.clientDisplayName ?? null,
    consentType: raw.consentType,
    principalId: raw.principalId ?? null,
    resourceId: raw.resourceId,
    resourceDisplayName: raw.resourceDisplayName ?? null,
    scope: raw.scope ?? null
  };
}

function normalizeRiskyUser(raw: z.infer<typeof M365RiskyUserSchema>) {
  return {
    externalId: raw.id,
    userPrincipalName: raw.userPrincipalName,
    userDisplayName: raw.userDisplayName ?? null,
    riskLevel: raw.riskLevel,
    riskState: raw.riskState,
    riskDetail: raw.riskDetail ?? null,
    riskLastUpdatedAt: raw.riskLastUpdatedDateTime ? new Date(raw.riskLastUpdatedDateTime) : null
  };
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export const m365Adapter: ProviderAdapter = {
  providerId: 'microsoft-365',
  facets: [
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

  async getAuthHeaders(_linkId: string, _ctx?: AdapterContext): Promise<Record<string, string>> {
    return {};
  },

  async *fetchFacet(
    linkId: string,
    facet: ProviderFacet,
    _cursor?: string,
    ctx?: AdapterContext
  ): AsyncGenerator<unknown[]> {
    const gdapTenantId = (ctx?.linkMeta?.externalId as string | undefined) ?? '';
    if (!gdapTenantId) {
      throw Object.assign(
        new Error(`M365: linkMeta.externalId (GDAP tenant ID) missing for link ${linkId}`),
        { failParent: true }
      );
    }
    const connector = getConnector(gdapTenantId);

    switch (facet) {
      case ProviderFacet.M365Identities: {
        const select =
          'id,displayName,userType,userPrincipalName,accountEnabled,assignedLicenses,signInActivity';
        const users = await connector.users.listAll(select);
        if (users.length > 0) yield users;
        break;
      }

      case ProviderFacet.M365Groups: {
        const groups = await connector.groups.listAll(
          'id,displayName,description,groupTypes,mailEnabled,securityEnabled'
        );
        if (groups.length > 0) yield groups;
        break;
      }

      case ProviderFacet.M365Licenses: {
        const [skus, skuNames] = await Promise.all([
          connector.subscribedSkus.listAll(),
          SkuCatalogService.resolve()
        ]);
        if (skus.length > 0) {
          yield skus.map((sku) => {
            const record = sku as Record<string, unknown>;
            const skuPartNumber =
              typeof record.skuPartNumber === 'string' ? record.skuPartNumber : undefined;
            return {
              ...record,
              _friendlyName: skuPartNumber
                ? (skuNames.get(skuPartNumber) ?? skuPartNumber)
                : record.skuId
            };
          });
        }
        break;
      }

      case ProviderFacet.M365CAPolicies: {
        const capabilities = (ctx?.linkMeta?.capabilities ?? {}) as Record<string, unknown>;
        if (!capabilities.conditionalAccess) {
          logger.warn(
            { linkId },
            'Skipping policies: conditionalAccess capability not enabled (requires Azure AD P1)'
          );
          return;
        }
        const policies = await connector.conditionalAccess.policies();
        if (policies.length > 0) yield policies;
        break;
      }

      case ProviderFacet.M365AuthMethods: {
        const allUsers = await connector.users.listIdsAll();

        const convertType = (odata: string): string => {
          const typeMap: Record<string, string> = {
            '#microsoft.graph.emailAuthenticationMethod': 'Email',
            '#microsoft.graph.fido2AuthenticationMethod': 'FIDO2',
            '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod':
              'Microsoft Authenticator',
            '#microsoft.graph.phoneAuthenticationMethod': 'Phone',
            '#microsoft.graph.softwareOathAuthenticationMethod': 'Software OAuth',
            '#microsoft.graph.windowsHelloForBusinessAuthenticationMethod': 'Windows Hello',
            '#microsoft.graph.temporaryAccessPassAuthenticationMethod': 'Temporary Pass',
            '#microsoft.graph.passwordAuthenticationMethod': 'Password'
          };
          return typeMap[odata] ?? 'Unknown';
        };

        const BATCH_SIZE = 20;
        for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
          const batch = allUsers.slice(i, i + BATCH_SIZE);
          const rows: unknown[] = [];
          for (const user of batch) {
            try {
              const data = await connector.users.authMethods(user.id);
              for (const method of data.value) {
                const odataType = (method['@odata.type'] as string) ?? '';
                if (odataType === '#microsoft.graph.passwordAuthenticationMethod') continue;
                rows.push({
                  ...method,
                  _identity_external_id: user.id,
                  _method_type: convertType(odataType)
                });
              }
            } catch {
              logger.warn({ linkId, userId: user.id }, 'Failed to fetch auth methods for user');
            }
          }
          if (rows.length > 0) yield rows;
        }
        break;
      }

      case ProviderFacet.M365Devices: {
        const select =
          'id,displayName,operatingSystem,operatingSystemVersion,isCompliant,isManaged,deviceOwnership,approximateLastSignInDateTime,registrationDateTime';
        const devices = await connector.devices.listAll(select);
        if (devices.length > 0) yield devices;
        break;
      }

      case ProviderFacet.M365OAuthGrants: {
        const allGrants = (await connector.oauthGrants.listAll()) as Array<Record<string, unknown>>;
        const spIds = new Set<string>();
        for (const g of allGrants) {
          if (typeof g.clientId === 'string') spIds.add(g.clientId);
          if (typeof g.resourceId === 'string') spIds.add(g.resourceId);
        }

        const displayNames = new Map<string, string>();
        if (spIds.size > 0) {
          try {
            const sps = await connector.directoryObjects.getByIds([...spIds], ['servicePrincipal']);
            for (const sp of sps) displayNames.set(sp.id, sp.displayName ?? '');
          } catch {
            logger.warn(
              { linkId },
              'Failed to resolve service principal display names for oauth_grants'
            );
          }
        }

        yield allGrants.map((g) => ({
          ...g,
          clientDisplayName:
            typeof g.clientId === 'string' ? (displayNames.get(g.clientId) ?? null) : null,
          resourceDisplayName:
            typeof g.resourceId === 'string' ? (displayNames.get(g.resourceId) ?? null) : null
        }));
        break;
      }

      case ProviderFacet.M365RiskyUsers: {
        const capabilities = (ctx?.linkMeta?.capabilities ?? {}) as Record<string, unknown>;
        if (!capabilities.identityProtection) {
          logger.warn(
            { linkId },
            'Skipping risky_users: identityProtection capability not enabled (requires Azure AD P2)'
          );
          return;
        }
        try {
          const filter =
            "riskState ne 'none' and riskState ne 'confirmedSafe' and riskState ne 'remediated' and riskState ne 'dismissed'";
          const users = await connector.identityProtection.riskyUsers(filter);
          if (users.length > 0) yield users;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('403')) {
            logger.warn(
              { linkId },
              'Skipping risky_users: missing IdentityRiskyUser.Read.All permission (403)'
            );
            return;
          }
          throw err;
        }
        break;
      }

      case ProviderFacet.M365ExchangeConfig: {
        const defaultDomain = (ctx?.linkMeta?.defaultDomain as string | undefined) ?? '';
        const roles = (ctx?.linkMeta?.roles as string[] | undefined) ?? [];
        const clientId = env.MICROSOFT_CLIENT_ID ?? '';
        const certPem = getCertPem();

        if (!roles.includes('Exchange Administrator')) {
          logger.warn({ linkId }, 'Skipping exchange_config: Exchange Administrator role required');
          return;
        }
        if (!certPem) {
          logger.warn({ linkId }, 'Skipping exchange_config: MICROSOFT_CERT_PEM not configured');
          return;
        }

        const result = await runExchangeOnlineFull(
          clientId,
          certPem,
          defaultDomain || gdapTenantId
        );
        if (result != null) yield [result];
        break;
      }

      case ProviderFacet.M365DomainConfig: {
        const defaultDomain = (ctx?.linkMeta?.defaultDomain as string | undefined) ?? '';
        const roles = (ctx?.linkMeta?.roles as string[] | undefined) ?? [];
        const clientId = env.MICROSOFT_CLIENT_ID ?? '';
        const certPem = getCertPem();

        if (!roles.includes('Exchange Administrator')) {
          logger.warn({ linkId }, 'Skipping domain_config: Exchange Administrator role required');
          return;
        }
        if (!certPem) {
          logger.warn({ linkId }, 'Skipping domain_config: MICROSOFT_CERT_PEM not configured');
          return;
        }

        const psResult = await runExchangeOnlineDomainConfig(
          clientId,
          certPem,
          defaultDomain || gdapTenantId
        );
        const psRecord = psResult as Record<string, unknown>;

        const acceptedDomains: string[] = Array.isArray(psRecord?.AcceptedDomains)
          ? (psRecord.AcceptedDomains as Array<Record<string, unknown>>)
              .map((d) => (typeof d.DomainName === 'string' ? d.DomainName.toLowerCase() : ''))
              .filter(Boolean)
          : [];

        const dkimMap = new Map<string, Record<string, unknown>>();
        if (Array.isArray(psRecord?.DkimConfigs)) {
          for (const d of psRecord.DkimConfigs as Array<Record<string, unknown>>) {
            if (typeof d.Domain === 'string') dkimMap.set(d.Domain.toLowerCase(), d);
          }
        }

        const dnsResults = await resolveDomainDns(acceptedDomains);

        const domainItems = acceptedDomains.map((domainName) => {
          const dkim = dkimMap.get(domainName);
          const dns = dnsResults[domainName] ?? {};
          return {
            domainName,
            spfRecord: dns.spfRecord ?? null,
            spfIsPermissive: dns.spfIsPermissive ?? null,
            dmarcRecord: dns.dmarcRecord ?? null,
            dmarcPolicy: dns.dmarcPolicy ?? null,
            dkimEnabled: dkim ? ((dkim.Enabled as boolean | null) ?? null) : null,
            dkimSelector1Present: dkim ? !!dkim.Selector1PublicKey : null,
            dkimSelector2Present: dkim ? !!dkim.Selector2PublicKey : null
          };
        });

        if (domainItems.length > 0) yield domainItems;
        break;
      }

      case ProviderFacet.M365TeamsConfig: {
        const roles = (ctx?.linkMeta?.roles as string[] | undefined) ?? [];
        const clientId = env.MICROSOFT_CLIENT_ID ?? '';
        const certPem = getCertPem();

        if (!roles.includes('Teams Administrator') && !roles.includes('Global Administrator')) {
          logger.warn(
            { linkId },
            'Skipping teams_config: Teams Administrator or Global Administrator role required'
          );
          return;
        }
        if (!certPem) {
          logger.warn({ linkId }, 'Skipping teams_config: MICROSOFT_CERT_PEM not configured');
          return;
        }

        const result = await runMicrosoftTeams(clientId, certPem, gdapTenantId);
        if (result != null) yield [result];
        break;
      }

      case ProviderFacet.M365MailboxForwarding: {
        const defaultDomain = (ctx?.linkMeta?.defaultDomain as string | undefined) ?? '';
        const roles = (ctx?.linkMeta?.roles as string[] | undefined) ?? [];
        const clientId = env.MICROSOFT_CLIENT_ID ?? '';
        const certPem = getCertPem();

        if (!roles.includes('Exchange Administrator')) {
          logger.warn(
            { linkId },
            'Skipping mailbox_forwarding: Exchange Administrator role required'
          );
          return;
        }
        if (!certPem) {
          logger.warn({ linkId }, 'Skipping mailbox_forwarding: MICROSOFT_CERT_PEM not configured');
          return;
        }

        const result = await runMailboxForwardingFull(
          clientId,
          certPem,
          defaultDomain || gdapTenantId
        );
        const forwardingMailboxes = ((result as Record<string, unknown>)?.ForwardingMailboxes ??
          []) as unknown[];
        if (forwardingMailboxes.length > 0) yield forwardingMailboxes;
        break;
      }

      case ProviderFacet.M365InboxRules: {
        const defaultDomain = (ctx?.linkMeta?.defaultDomain as string | undefined) ?? '';
        const roles = (ctx?.linkMeta?.roles as string[] | undefined) ?? [];
        const clientId = env.MICROSOFT_CLIENT_ID ?? '';
        const certPem = getCertPem();

        if (!roles.includes('Exchange Administrator')) {
          logger.warn({ linkId }, 'Skipping inbox_rules: Exchange Administrator role required');
          return;
        }
        if (!certPem) {
          logger.warn({ linkId }, 'Skipping inbox_rules: MICROSOFT_CERT_PEM not configured');
          return;
        }

        let activeUpns: string[] = [];
        try {
          const allUsers = await connector.users.listForInboxRules();
          activeUpns = allUsers.filter((u) => u.accountEnabled).map((u) => u.userPrincipalName);
        } catch (err) {
          logger.warn({ linkId, err }, 'Failed to fetch UPN list for inbox_rules; skipping');
          return;
        }

        if (activeUpns.length === 0) {
          logger.warn({ linkId }, 'Skipping inbox_rules: no active identities found');
          return;
        }

        const result = await runInboxRules(
          clientId,
          certPem,
          defaultDomain || gdapTenantId,
          activeUpns
        );
        const inboxRules = ((result as Record<string, unknown>)?.InboxRules ?? []) as unknown[];
        if (inboxRules.length > 0) yield inboxRules;
        break;
      }

      default:
        throw new Error(`m365Adapter: unknown facet "${facet}"`);
    }
  },

  normalize(raw: unknown, facet: ProviderFacet): unknown {
    switch (facet) {
      case ProviderFacet.M365Identities: {
        const parsed = M365UserSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 identity schema violation: ${parsed.error.message}`);
        return normalizeIdentity(parsed.data);
      }
      case ProviderFacet.M365Groups: {
        const parsed = M365GroupSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 group schema violation: ${parsed.error.message}`);
        return normalizeGroup(parsed.data);
      }
      case ProviderFacet.M365Licenses: {
        const parsed = M365SubscribedSkuSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 license schema violation: ${parsed.error.message}`);
        return normalizeLicense(parsed.data);
      }
      case ProviderFacet.M365CAPolicies: {
        const parsed = M365CAPolicySchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 policy schema violation: ${parsed.error.message}`);
        return normalizePolicy(parsed.data);
      }
      case ProviderFacet.M365AuthMethods: {
        const parsed = M365AuthMethodSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 auth_method schema violation: ${parsed.error.message}`);
        return normalizeAuthMethod(parsed.data);
      }
      case ProviderFacet.M365Devices: {
        const parsed = M365DeviceSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 device schema violation: ${parsed.error.message}`);
        return normalizeDevice(parsed.data);
      }
      case ProviderFacet.M365OAuthGrants: {
        const parsed = M365OAuthGrantSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 oauth_grant schema violation: ${parsed.error.message}`);
        return normalizeOAuthGrant(parsed.data);
      }
      case ProviderFacet.M365RiskyUsers: {
        const parsed = M365RiskyUserSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 risky_user schema violation: ${parsed.error.message}`);
        return normalizeRiskyUser(parsed.data);
      }
      case ProviderFacet.M365ExchangeConfig: {
        const parsed = PSExchangeConfigSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(
            `microsoft-365 exchange_config schema violation: ${parsed.error.message}`
          );
        const c = parsed.data;
        const allowBasicAuthSmtp =
          c.AuthPolicies.length > 0
            ? c.AuthPolicies.some((p) => p.AllowBasicAuthSmtp === true)
            : null;
        const forwardingMailboxes = c.ForwardingMailboxes.filter(
          (m) => !!m.ForwardingSmtpAddress
        ).map((m) => {
          const raw = m.ForwardingSmtpAddress!;
          return {
            upn: m.UserPrincipalName,
            forwardingAddress: raw.toLowerCase().startsWith('smtp:') ? raw.slice(5) : raw
          };
        });
        return {
          externalId: 'org-config',
          rejectDirectSend: c.OrgConfig?.RejectDirectSend ?? false,
          autoForwardingMode: c.AutoForwardingMode ?? null,
          allowBasicAuthSmtp,
          forwardingMailboxes: forwardingMailboxes.length > 0 ? forwardingMailboxes : null
        };
      }
      case ProviderFacet.M365DomainConfig: {
        const parsed = PSDomainItemSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 domain_config schema violation: ${parsed.error.message}`);
        const d = parsed.data;
        return {
          externalId: d.domainName,
          domainName: d.domainName,
          spfRecord: d.spfRecord ?? null,
          spfIsPermissive: d.spfIsPermissive ?? null,
          dmarcRecord: d.dmarcRecord ?? null,
          dmarcPolicy: d.dmarcPolicy ?? null,
          dkimEnabled: d.dkimEnabled ?? null,
          dkimSelector1Present: d.dkimSelector1Present ?? null,
          dkimSelector2Present: d.dkimSelector2Present ?? null
        };
      }
      case ProviderFacet.M365TeamsConfig: {
        const parsed = PSTeamsConfigSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 teams_config schema violation: ${parsed.error.message}`);
        const c = parsed.data;
        const mp = c.MeetingPolicy;
        const fed = c.FederationConfig;
        let allowedDomains: string[] | null = null;
        if (fed?.AllowedDomains != null) {
          if (Array.isArray(fed.AllowedDomains)) {
            allowedDomains = (fed.AllowedDomains as Array<string | null>).filter(
              (d): d is string => d !== null
            );
          }
        }
        return {
          externalId: 'teams-config',
          allowAnonymousUsersToJoinMeeting: mp?.AllowAnonymousUsersToJoinMeeting ?? null,
          allowExternalParticipantGiveRequestControl:
            mp?.AllowExternalParticipantGiveRequestControl ?? null,
          allowPSTNUsersToBypassLobby: mp?.AllowPSTNUsersToBypassLobby ?? null,
          autoAdmittedUsers: mp?.AutoAdmittedUsers ?? null,
          allowFederatedUsers: fed?.AllowFederatedUsers ?? null,
          allowPublicUsers: fed?.AllowPublicUsers ?? null,
          allowTeamsConsumer: fed?.AllowTeamsConsumer ?? null,
          allowedDomains
        };
      }
      case ProviderFacet.M365MailboxForwarding: {
        const parsed = PSMailboxItemSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(
            `microsoft-365 mailbox_forwarding schema violation: ${parsed.error.message}`
          );
        const m = parsed.data;
        const rawSmtp = m.ForwardingSmtpAddress ?? null;
        const smtpAddress = rawSmtp?.toLowerCase().startsWith('smtp:') ? rawSmtp.slice(5) : rawSmtp;
        return {
          externalId: m.UserPrincipalName.toLowerCase(),
          userPrincipalName: m.UserPrincipalName,
          forwardingAddress: m.ForwardingAddress ?? null,
          forwardingSmtpAddress: smtpAddress ?? null,
          deliverToMailboxAndForward: m.DeliverToMailboxAndForward ?? null
        };
      }
      case ProviderFacet.M365InboxRules: {
        const parsed = PSInboxRuleItemSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error(`microsoft-365 inbox_rules schema violation: ${parsed.error.message}`);
        const rule = parsed.data;
        const JUNK_FOLDERS = ['Deleted Items', 'Junk Email', 'RSS Feeds', 'Trash'];
        const suspicionReasons: string[] = [];
        if (rule.DeleteMessage === true) suspicionReasons.push('deletesMessages');
        const forwardTo = rule.ForwardTo?.filter(Boolean) ?? null;
        const forwardAsAttachmentTo = rule.ForwardAsAttachmentTo?.filter(Boolean) ?? null;
        const externalForwardTo = externalInboxRuleRecipients(
          forwardTo,
          rule.MailboxUserPrincipalName
        );
        const externalForwardAsAttachmentTo = externalInboxRuleRecipients(
          forwardAsAttachmentTo,
          rule.MailboxUserPrincipalName
        );
        if (externalForwardTo.length > 0 || externalForwardAsAttachmentTo.length > 0)
          suspicionReasons.push('forwardsExternally');
        if ((rule.RedirectTo?.filter(Boolean).length ?? 0) > 0)
          suspicionReasons.push('redirectsMessages');
        if (rule.MoveToFolder && JUNK_FOLDERS.includes(rule.MoveToFolder))
          suspicionReasons.push('movesToJunk');
        return {
          externalId: `${rule.MailboxUserPrincipalName.toLowerCase()}::${rule.Name}`,
          mailboxUpn: rule.MailboxUserPrincipalName,
          ruleName: rule.Name,
          ruleIdentity: rule.Identity ?? null,
          enabled: rule.Enabled ?? null,
          deleteMessage: rule.DeleteMessage ?? null,
          moveToFolder: rule.MoveToFolder ?? null,
          forwardTo,
          forwardAsAttachmentTo,
          redirectTo: rule.RedirectTo?.filter(Boolean) ?? null,
          markAsRead: rule.MarkAsRead ?? null,
          subjectContainsWords: rule.SubjectContainsWords?.filter(Boolean) ?? null,
          isSuspicious: suspicionReasons.length > 0,
          suspicionReasons: [...new Set(suspicionReasons)]
        };
      }
      default:
        throw new Error(`m365Adapter.normalize: unsupported facet "${facet}"`);
    }
  },

  rawSchema: M365UserSchema
};

export function getM365FacetSchema(facet: ProviderFacet): z.ZodSchema<unknown> {
  const schemas: Partial<Record<ProviderFacet, z.ZodSchema<unknown>>> = {
    [ProviderFacet.M365Identities]: M365UserSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365Groups]: M365GroupSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365Licenses]: M365SubscribedSkuSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365CAPolicies]: M365CAPolicySchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365AuthMethods]: M365AuthMethodSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365Devices]: M365DeviceSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365OAuthGrants]: M365OAuthGrantSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365RiskyUsers]: M365RiskyUserSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365ExchangeConfig]: PSExchangeConfigSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365DomainConfig]: PSDomainItemSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365TeamsConfig]: PSTeamsConfigSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365MailboxForwarding]: PSMailboxItemSchema as z.ZodSchema<unknown>,
    [ProviderFacet.M365InboxRules]: PSInboxRuleItemSchema as z.ZodSchema<unknown>
  };
  return schemas[facet] ?? (M365UserSchema as z.ZodSchema<unknown>);
}
