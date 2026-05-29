import { eq, and, inArray, isNull, notInArray } from 'drizzle-orm';
import { alerts } from '@mspbyte/drizzle';
import type { TenantServiceDb } from '@mspbyte/drizzle-catalog';

export type Detection = {
  definitionId: string;
  linkId?: string;
  siteId?: string;
  entityType: string;
  entityRef: string;
  entityId: string;
  severity: number;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function upsertAlert(db: TenantServiceDb, detection: Detection): Promise<void> {
  const now = new Date();

  const scopeConditions = buildScopeConditions(detection);

  const existing = await db
    .select()
    .from(alerts)
    .where(
      and(
        ...scopeConditions,
        eq(alerts.definitionId, detection.definitionId),
        eq(alerts.entityRef, detection.entityRef),
        inArray(alerts.status, ['active', 'suppressed'])
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(alerts).values({
      definitionId: detection.definitionId,
      linkId: detection.linkId ?? null,
      siteId: detection.siteId ?? null,
      entityType: detection.entityType,
      entityRef: detection.entityRef,
      entityId: detection.entityId,
      severity: detection.severity,
      message: detection.message,
      metadata: detection.metadata ?? null,
      status: 'active',
      firstSeen: now,
      lastSeenAt: now,
      updatedAt: now
    });
    return;
  }

  // Active or suppressed → UPDATE lastSeenAt only; preserve suppression state
  await db
    .update(alerts)
    .set({ lastSeenAt: now, updatedAt: now })
    .where(eq(alerts.id, existing[0].id));
}

export async function resolveMissingAlerts(
  db: TenantServiceDb,
  params: {
    definitionIds: readonly string[];
    linkId?: string;
    siteId?: string;
    seenEntityRefs: readonly string[];
  }
): Promise<void> {
  if (params.definitionIds.length === 0) return;

  const now = new Date();
  const conditions = [
    ...buildScopeConditions(params),
    inArray(alerts.definitionId, [...params.definitionIds]),
    eq(alerts.status, 'active')
  ];

  if (params.seenEntityRefs.length > 0) {
    conditions.push(notInArray(alerts.entityRef, [...params.seenEntityRefs]));
  }

  await db
    .update(alerts)
    .set({ status: 'resolved', resolvedAt: now, updatedAt: now })
    .where(and(...conditions));
}

function buildScopeConditions(detection: { linkId?: string; siteId?: string }) {
  if (detection.linkId) return [eq(alerts.linkId, detection.linkId)];
  if (detection.siteId) return [eq(alerts.siteId, detection.siteId)];
  return [isNull(alerts.linkId), isNull(alerts.siteId)];
}
