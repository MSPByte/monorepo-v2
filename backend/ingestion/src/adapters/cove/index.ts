import { z } from 'zod';
import { ProviderFacet, CoveConnector, Encryption } from '@mspbyte/shared';
import type { CoveAccountStatistics } from '@mspbyte/shared';
import type { ProviderAdapter, AdapterContext } from '@mspbyte/shared';
import { logger } from '../../logger.js';
import { env } from '../../env.js';

// ─── Zod schema ──────────────────────────────────────────────────────────────

const CoveAccountStatisticsSchema = z
  .object({
    AccountId: z.number(),
    PartnerId: z.number(),
    Flags: z.array(z.string()).nullable(),
    Settings: z.record(z.string(), z.string())
  })
  .passthrough();

export function getCoveFacetSchema(_facet: string) {
  return CoveAccountStatisticsSchema;
}

// ─── Normalize helpers ────────────────────────────────────────────────────────

const BACKUP_STATUS: Record<string, string> = {
  '1': 'In Process',
  '2': 'Failed',
  '5': 'Completed',
  '6': 'Interrupted',
  '7': 'Not Started',
  '8': 'Completed with Errors'
};

const DEVICE_TYPE: Record<string, string> = {
  '1': 'workstation',
  '2': 'server'
};

function mapCoveStatus(raw: string | undefined): 'active' | 'inactive' | 'error' {
  const status = BACKUP_STATUS[raw ?? ''] ?? raw ?? '';
  if (status === 'Completed' || status === 'In Process') return 'active';
  if (status === 'Not Started') return 'inactive';
  return 'error';
}

function mapCoveType(raw: string | undefined): 'workstation' | 'server' {
  return DEVICE_TYPE[raw ?? ''] === 'server' ? 'server' : 'workstation';
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export const coveAdapter: ProviderAdapter<CoveAccountStatistics, Record<string, unknown>> = {
  providerId: 'cove',
  facets: [ProviderFacet.CoveEndpoints],

  async getAuthHeaders(_linkId: string, _ctx?: AdapterContext): Promise<Record<string, string>> {
    return {};
  },

  async *fetchFacet(linkId, facet, _cursor, ctx) {
    if (facet !== ProviderFacet.CoveEndpoints) {
      logger.warn({ linkId, facet }, 'Cove adapter: unknown facet');
      return;
    }

    const server = ctx?.integrationConfig?.server as string | undefined;
    const clientId = ctx?.integrationConfig?.clientId as string | undefined;
    const clientSecret = ctx?.integrationConfig?.clientSecret as string | undefined;
    const partnerId = ctx?.linkMeta?.externalId ? Number(ctx.linkMeta.externalId) : undefined;

    if (!server || !clientId || !clientSecret || !partnerId) {
      throw Object.assign(
        new Error(`Cove: missing credentials or linkMeta.externalId for link ${linkId}`),
        { failParent: true }
      );
    }

    const connector = new CoveConnector(
      server,
      clientId,
      Encryption.decrypt(clientSecret, env.ENCRYPTION_KEY) ?? ''
    );
    const rows = await connector.account.statistics(partnerId);

    logger.info({ linkId, count: rows.length }, 'Cove endpoints fetched');
    yield rows;
  },

  normalize(raw, _facet): Record<string, unknown> {
    const r = raw as CoveAccountStatistics;
    const s = r.Settings;

    const rawLastSuccess = s['lastSuccessfulSession'];
    let lastSuccessAt: Date | null = null;
    if (rawLastSuccess) {
      const ts = parseInt(rawLastSuccess, 10);
      if (!isNaN(ts) && ts > 0) lastSuccessAt = new Date(ts * 1000);
    }

    return {
      externalId: String(r.AccountId),
      endpointName: s['deviceName'] ?? '',
      hostname: s['computerName'] ?? '',
      type: mapCoveType(s['deviceType']),
      profile: s['profile'] ?? '',
      retentionPolicy: s['retentionPolicy'] ?? '',
      status: mapCoveStatus(s['backupStatus']),
      lsvStatus: s['lsvStatus'] ?? null,
      errors: parseInt(s['errors'] ?? '0', 10) || 0,
      selectedSize: Math.round(parseFloat(s['selectedSize'] ?? '0')) || 0,
      usedStorage: Math.round(parseFloat(s['usedStorage'] ?? '0')) || 0,
      last28Days: s['last28Days'] ?? '',
      lastSuccessAt,
      lastSeenAt: new Date()
    };
  },

  rawSchema: CoveAccountStatisticsSchema
};
