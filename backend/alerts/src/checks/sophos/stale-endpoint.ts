import { and, eq, lt } from 'drizzle-orm';
import { sophosEndpoints } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from '../interface.js';
import { alertSeverity } from '../severity.js';

const STALE_ENDPOINT_DAYS = 60;

export const sophosStaleEndpointCheck: CheckEvaluator = {
  checkId: 'sophos_stale_endpoint',
  definitionId: 'sophos.endpoint.stale',
  sourceTables: ['sophos_endpoints'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const cutoff = new Date(Date.now() - STALE_ENDPOINT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const conditions = [lt(sophosEndpoints.lastHeartbeatAt, cutoff)];
    if (linkId) conditions.push(eq(sophosEndpoints.linkId, linkId));

    const rows = await db
      .select()
      .from(sophosEndpoints)
      .where(and(...conditions));

    return rows.map((row) => ({
      checkId: 'sophos_stale_endpoint',
      definitionId: 'sophos.endpoint.stale',
      linkId: linkId ?? row.linkId,
      siteId: row.siteId ?? undefined,
      entityType: 'endpoint',
      entityRef: row.hostname,
      entityId: row.id,
      severity: alertSeverity('sophos.endpoint.stale'),
      detail: {
        hostname: row.hostname,
        type: row.type,
        platform: row.platform,
        online: row.online,
        lastSeenAt: row.lastHeartbeatAt,
        staleDays: STALE_ENDPOINT_DAYS
      }
    }));
  }
};
