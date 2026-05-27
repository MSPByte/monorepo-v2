import { z } from 'zod';
import { Encryption, ProviderFacet, SophosConnector } from '@mspbyte/shared';
import type { ProviderAdapter, AdapterContext } from '@mspbyte/shared';
import { logger } from '../../logger.js';
import { env } from '../../env.js';

// ─── Zod schemas ────────────────────────────────────────────────────────────

// TODO: Ingestion failing
const SophosEndpointSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    online: z.boolean(),
    hostname: z.string(),
    mdrManaged: z.boolean(),
    tamperProtectionEnabled: z.boolean(),
    lastSeenAt: z.string().nullable().optional(),
    os: z.object({ name: z.string(), platform: z.string() }).passthrough(),
    health: z.object({ overall: z.string() }).passthrough(),
    lockdown: z.object({ status: z.string() }).passthrough(),
    packages: z
      .object({
        protection: z.object({ status: z.string() }).passthrough().nullable().optional()
      })
      .passthrough()
      .nullable()
      .optional()
  })
  .passthrough();
export type SophosEndpoint = z.infer<typeof SophosEndpointSchema>;

const SophosFirewallSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    hostname: z.string(),
    serialNumber: z.string(),
    model: z.string().nullable().optional(),
    firmwareVersion: z.string().nullable().optional(),
    externalIpv4Addresses: z.array(z.string()).nullable().optional(),
    stateChangedAt: z.string().nullable().optional(),
    status: z
      .object({
        managingStatus: z.string().nullable().optional(),
        reportingStatus: z.string().nullable().optional(),
        connected: z.boolean().nullable().optional(),
        suspended: z.boolean().nullable().optional()
      })
      .passthrough()
      .nullable()
      .optional(),
    _upgrade_to_version: z.string().nullable().optional()
  })
  .passthrough();
export type SophosFirewall = z.infer<typeof SophosFirewallSchema>;

const SophosLicenseSchema = z
  .object({
    id: z.string(),
    licenseIdentifier: z.string(),
    product: z.object({ code: z.string(), name: z.string().nullable().optional() }).passthrough(),
    type: z.string(),
    perpetual: z.boolean(),
    unlimited: z.boolean(),
    quantity: z.number().nullable().optional().default(0),
    startDate: z.string(),
    endDate: z.string().nullable().optional(),
    usage: z
      .object({
        current: z
          .object({ count: z.number().nullable().optional() })
          .passthrough()
          .nullable()
          .optional()
      })
      .passthrough()
      .nullable()
      .optional()
  })
  .passthrough();
export type SophosLicense = z.infer<typeof SophosLicenseSchema>;

type SophosRaw = SophosEndpoint | SophosFirewall | SophosLicense;

const SOPHOS_FACET_SCHEMAS: Partial<
  Record<
    ProviderFacet,
    typeof SophosEndpointSchema | typeof SophosFirewallSchema | typeof SophosLicenseSchema
  >
> = {
  [ProviderFacet.SophosEndpoints]: SophosEndpointSchema,
  [ProviderFacet.SophosFirewalls]: SophosFirewallSchema,
  [ProviderFacet.SophosLicenses]: SophosLicenseSchema
};

export function getSophosFacetSchema(facet: ProviderFacet) {
  return SOPHOS_FACET_SCHEMAS[facet] ?? SophosEndpointSchema;
}

// ─── Normalize helpers ────────────────────────────────────────────────────────

function mapSophosType(raw: string): 'computer' | 'server' {
  return raw === 'server' ? 'server' : 'computer';
}

function mapSophosHealth(raw: string): 'good' | 'suspicious' | 'bad' | 'unknown' {
  if (raw === 'good' || raw === 'suspicious' || raw === 'bad') return raw;
  return 'unknown';
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export const sophosAdapter: ProviderAdapter<SophosRaw, Record<string, unknown>> = {
  providerId: 'sophos-partner',
  facets: [
    ProviderFacet.SophosEndpoints,
    ProviderFacet.SophosFirewalls,
    ProviderFacet.SophosLicenses
  ],

  async getAuthHeaders(_linkId: string, _ctx?: AdapterContext): Promise<Record<string, string>> {
    return {};
  },

  async *fetchFacet(linkId, facet, _cursor, ctx) {
    const clientId = ctx?.integrationConfig?.clientId as string | undefined;
    const clientSecret = ctx?.integrationConfig?.clientSecret as string | undefined;
    const sophosTenantId = ctx?.linkMeta?.externalId as string | undefined;
    const apiHost = ctx?.linkMeta?.apiHost as string | undefined;

    if (!clientId || !clientSecret) {
      throw Object.assign(new Error(`Sophos: missing clientId/clientSecret for link ${linkId}`), {
        failParent: true
      });
    }

    const connector = new SophosConnector(
      clientId,
      Encryption.decrypt(clientSecret, env.ENCRYPTION_KEY) ?? ''
    );

    switch (facet) {
      case ProviderFacet.SophosEndpoints: {
        if (!apiHost) throw new Error(`Sophos: missing apiHost in linkMeta for link ${linkId}`);
        const endpoints = await connector.endpoint.list(apiHost, sophosTenantId);
        logger.info({ linkId, count: endpoints.length }, 'Sophos endpoints fetched');
        yield endpoints as SophosRaw[];
        break;
      }

      case ProviderFacet.SophosFirewalls: {
        if (!apiHost) throw new Error(`Sophos: missing apiHost in linkMeta for link ${linkId}`);
        const firewalls = (await connector.firewall.list(
          apiHost,
          sophosTenantId
        )) as SophosFirewall[];

        // Firmware upgrade check — best-effort, don't fail the fetch if it errors
        const upgradeMap = new Map<string, string | null>();
        if (firewalls.length > 0 && sophosTenantId) {
          try {
            const fwIds = firewalls.map((fw) => fw.id);
            const results = await connector.firewall.firmwareUpgradeCheck(
              apiHost,
              sophosTenantId,
              fwIds
            );
            for (const fw of results) {
              if (fw.id) upgradeMap.set(fw.id, fw.upgradeToVersion?.[0] ?? null);
            }
          } catch {
            logger.warn(
              { linkId },
              'Sophos firmware upgrade check failed, continuing without upgrade info'
            );
          }
        }

        const payload = firewalls.map((fw) => ({
          ...fw,
          _upgrade_to_version: upgradeMap.get(fw.id) ?? null
        }));
        logger.info({ linkId, count: payload.length }, 'Sophos firewalls fetched');
        yield payload as SophosRaw[];
        break;
      }

      case ProviderFacet.SophosLicenses: {
        const licenses = await connector.license.list(sophosTenantId);
        logger.info({ linkId, count: licenses.length }, 'Sophos licenses fetched');
        yield licenses as SophosRaw[];
        break;
      }

      default:
        logger.warn({ linkId, facet }, 'Sophos adapter: unknown facet');
        return;
    }
  },

  normalize(raw, facet): Record<string, unknown> {
    const now = new Date();

    if (facet === ProviderFacet.SophosEndpoints) {
      const ep = raw as SophosEndpoint;
      return {
        externalId: ep.id,
        hostname: ep.hostname,
        type: mapSophosType(ep.type),
        platform: ep.os.platform,
        osName: ep.os.name,
        health: mapSophosHealth(ep.health.overall),
        online: ep.online,
        needsUpgrade: ep.packages?.protection?.status === 'upgradable',
        hasMdr: ep.mdrManaged,
        tamperProtectionEnabled: ep.tamperProtectionEnabled === true,
        lockdown: ep.lockdown.status,
        currentCode: '',
        previousCodes: [],
        lastHeartbeatAt: ep.lastSeenAt ? new Date(ep.lastSeenAt) : null,
        lastSeenAt: now
      };
    }

    if (facet === ProviderFacet.SophosFirewalls) {
      const fw = raw as SophosFirewall;
      return {
        externalId: fw.id,
        name: fw.name,
        hostname: fw.hostname,
        model: fw.model ?? '',
        serialNumber: fw.serialNumber,
        firmwareVersion: fw.firmwareVersion ?? '',
        externalIp: fw.externalIpv4Addresses?.[0] ?? '',
        connected: fw.status?.connected === true,
        suspended: fw.status?.suspended === true,
        managing: fw.status?.managingStatus ?? 'Unknown',
        reporting: fw.status?.reportingStatus ?? 'Unknown',
        upgradeToVersion:
          typeof fw._upgrade_to_version === 'string' ? fw._upgrade_to_version : null,
        lastChangeAt: fw.stateChangedAt ? new Date(fw.stateChangedAt) : now,
        lastSeenAt: now
      };
    }

    if (facet === ProviderFacet.SophosLicenses) {
      const lic = raw as SophosLicense;
      return {
        externalId: lic.id,
        licenseId: lic.licenseIdentifier,
        code: lic.product.code,
        name: lic.product.name ?? 'Unknown',
        type: lic.type,
        perpetual: lic.perpetual,
        unlimited: lic.unlimited,
        quantity: lic.quantity ?? null,
        usageCount: lic.usage?.current?.count ?? null,
        startedAt: new Date(lic.startDate),
        endsAt: lic.endDate ? new Date(lic.endDate) : null,
        lastSeenAt: now
      };
    }

    return {};
  },

  rawSchema: SophosEndpointSchema
};
