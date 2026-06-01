import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { coveEndpoints } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from './interface.js';

const STALE_SUCCESS_HOURS = 48;

function endpointRef(endpoint: typeof coveEndpoints.$inferSelect): string {
  return endpoint.endpointName || endpoint.hostname || endpoint.externalId || endpoint.id;
}

function endpointDetail(endpoint: typeof coveEndpoints.$inferSelect) {
  return {
    endpointName: endpoint.endpointName,
    hostname: endpoint.hostname,
    type: endpoint.type,
    status: endpoint.status,
    errors: endpoint.errors,
    lastSuccessAt: endpoint.lastSuccessAt,
    last28Days: endpoint.last28Days,
    selectedSize: endpoint.selectedSize,
    usedStorage: endpoint.usedStorage
  };
}

export const coveEndpointErrorsCheck: CheckEvaluator = {
  checkId: 'cove_endpoint_errors',
  definitionId: 'cove.endpoint.errors',
  sourceTables: ['cove_endpoints'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const conditions = [gt(coveEndpoints.errors, 0)];
    if (linkId) conditions.push(eq(coveEndpoints.linkId, linkId));

    const rows = await db
      .select()
      .from(coveEndpoints)
      .where(and(...conditions));

    return rows.map((endpoint) => ({
      checkId: 'cove_endpoint_errors',
      definitionId: 'cove.endpoint.errors',
      linkId: linkId ?? endpoint.linkId,
      siteId: endpoint.siteId ?? undefined,
      entityType: 'endpoint',
      entityRef: endpointRef(endpoint),
      entityId: endpoint.id,
      severity: 2,
      detail: endpointDetail(endpoint)
    }));
  }
};

export const coveEndpointLastSuccessStaleCheck: CheckEvaluator = {
  checkId: 'cove_endpoint_last_success_stale',
  definitionId: 'cove.endpoint.lastSuccessStale',
  sourceTables: ['cove_endpoints'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const cutoff = new Date(Date.now() - STALE_SUCCESS_HOURS * 60 * 60 * 1000).toISOString();
    const staleCondition = or(
      isNull(coveEndpoints.lastSuccessAt),
      lt(coveEndpoints.lastSuccessAt, cutoff)
    );
    const conditions = [staleCondition];
    if (linkId) conditions.push(eq(coveEndpoints.linkId, linkId));

    const rows = await db
      .select()
      .from(coveEndpoints)
      .where(and(...conditions));

    return rows.map((endpoint) => ({
      checkId: 'cove_endpoint_last_success_stale',
      definitionId: 'cove.endpoint.lastSuccessStale',
      linkId: linkId ?? endpoint.linkId,
      siteId: endpoint.siteId ?? undefined,
      entityType: 'endpoint',
      entityRef: endpointRef(endpoint),
      entityId: endpoint.id,
      severity: 1,
      detail: {
        ...endpointDetail(endpoint),
        staleHours: STALE_SUCCESS_HOURS
      }
    }));
  }
};
