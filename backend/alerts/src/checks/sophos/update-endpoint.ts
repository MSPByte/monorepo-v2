import { and, eq } from 'drizzle-orm';
import { sophosEndpoints } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from '../interface.js';
import { alertSeverity } from '../severity.js';

export const sophosEndpointNeedsUpdateCheck: CheckEvaluator = {
  checkId: 'sophos_endpoint_needs_update',
  definitionId: 'sophos.endpoint.needsUpdate',
  sourceTables: ['sophos_endpoints'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const conditions = [eq(sophosEndpoints.needsUpgrade, true)];
    if (linkId) conditions.push(eq(sophosEndpoints.linkId, linkId));

    const rows = await db
      .select()
      .from(sophosEndpoints)
      .where(and(...conditions));

    return rows.map((row) => ({
      checkId: 'sophos_endpoint_needs_update',
      definitionId: 'sophos.endpoint.needsUpdate',
      linkId: linkId ?? row.linkId,
      siteId: row.siteId ?? undefined,
      entityType: 'endpoint',
      entityRef: row.hostname,
      entityId: row.id,
      severity: alertSeverity('sophos.endpoint.needsUpdate'),
      detail: {
        hostname: row.hostname,
        type: row.type,
        platform: row.platform,
        osName: row.osName,
        health: row.health,
        online: row.online,
        currentCode: row.currentCode
      }
    }));
  }
};
