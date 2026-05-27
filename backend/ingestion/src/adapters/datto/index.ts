import { z } from 'zod';
import { ProviderFacet, DattoConnector, Encryption } from '@mspbyte/shared';
import type { ProviderAdapter, AdapterContext } from '@mspbyte/shared';
import { logger } from '../../logger.js';
import { env } from '../../env.js';

// ─── Zod schema ──────────────────────────────────────────────────────────────

const DattoDeviceSchema = z
  .object({
    id: z.number(),
    uid: z.string(),
    online: z.boolean(),
    hostname: z.string(),
    operatingSystem: z.string().nullable().optional(),
    deviceType: z
      .object({
        category: z.string(),
        type: z.string()
      })
      .passthrough(),
    intIpAddress: z.string(),
    extIpAddress: z.string().nullable().optional(),
    lastSeen: z.number().nullable().optional(),
    lastReboot: z.number().nullable().optional(),
    udf: z.record(z.string().regex(/^udf\d+$/), z.string().nullable().optional())
  })
  .passthrough();

type DattoDevice = z.infer<typeof DattoDeviceSchema>;

export function getDattoFacetSchema(_facet: string) {
  return DattoDeviceSchema;
}

// ─── Category mapping ─────────────────────────────────────────────────────────

function mapDattoCategory(raw: string): 'workstation' | 'server' | 'other' {
  const lower = raw.toLowerCase();
  if (lower === 'server') return 'server';
  if (lower === 'desktop' || lower === 'laptop' || lower === 'workstation') return 'workstation';
  return 'other';
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export const dattoAdapter: ProviderAdapter<DattoDevice, Record<string, unknown>> = {
  providerId: 'dattormm',
  facets: [ProviderFacet.DattoEndpoints],

  async getAuthHeaders(_linkId: string, _ctx?: AdapterContext): Promise<Record<string, string>> {
    return {};
  },

  async *fetchFacet(linkId, facet, _cursor, ctx) {
    if (facet !== ProviderFacet.DattoEndpoints) {
      logger.warn({ linkId, facet }, 'DattoRMM adapter: unknown facet');
      return;
    }

    const url = ctx?.integrationConfig?.url as string | undefined;
    const apiKey = ctx?.integrationConfig?.apiKey as string | undefined;
    const apiSecretKey = ctx?.integrationConfig?.apiSecretKey as string | undefined;
    const siteUid = ctx?.linkMeta?.externalId as string | undefined;

    if (!url || !apiKey || !apiSecretKey) {
      throw Object.assign(
        new Error(`DattoRMM: missing url/apiKey/apiSecretKey for link ${linkId}`),
        { failParent: true }
      );
    }
    if (!siteUid) {
      throw new Error(`DattoRMM: missing linkMeta.externalId for link ${linkId}`);
    }

    const connector = new DattoConnector(
      url,
      apiKey,
      Encryption.decrypt(apiSecretKey, env.ENCRYPTION_KEY) ?? ''
    );

    logger.info({ linkId, siteUid }, 'DattoRMM devices fetch requested');
    const devices = await connector.site.devices(siteUid);

    logger.info({ linkId, count: devices.length }, 'DattoRMM devices fetched');
    yield devices as DattoDevice[];
  },

  normalize(raw, _facet): Record<string, unknown> {
    const d = raw as DattoDevice;
    return {
      externalId: d.uid,
      hostname: d.hostname,
      category: mapDattoCategory(d.deviceType.category),
      os: d.operatingSystem ?? 'Unknown',
      ipAddress: d.intIpAddress,
      extAddress: d.extIpAddress ?? '',
      online: d.online,
      udfs: d.udf ?? {},
      lastRebootAt: d.lastReboot ? new Date(d.lastReboot) : new Date(0),
      lastHeartbeatAt: d.lastSeen ? new Date(d.lastSeen) : null,
      lastSeenAt: new Date()
    };
  },

  rawSchema: DattoDeviceSchema
};
