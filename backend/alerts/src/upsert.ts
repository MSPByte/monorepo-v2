import { eq, and, inArray, isNull } from 'drizzle-orm';
import { alerts } from '@mspbyte/drizzle';
import type { MspServiceDb } from '@mspbyte/drizzle';

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

export async function upsertAlert(db: MspServiceDb, detection: Detection): Promise<void> {
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

function buildScopeConditions(detection: Detection) {
  if (detection.linkId) return [eq(alerts.linkId, detection.linkId)];
  if (detection.siteId) return [eq(alerts.siteId, detection.siteId)];
  return [isNull(alerts.linkId), isNull(alerts.siteId)];
}
