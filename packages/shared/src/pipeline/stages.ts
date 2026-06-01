import { eq, and } from 'drizzle-orm';
import type { PgAsyncDatabase } from 'drizzle-orm/pg-core';
import { syncRunStages, syncContext, entityChangeLog, rawIngestLog } from '@mspbyte/drizzle';

type Db = PgAsyncDatabase<any, any>;

export type StageMetrics = {
  recordsIn?: number;
  recordsOut?: number;
  createdCt?: number;
  updatedCt?: number;
  failedCt?: number;
  metrics?: Record<string, unknown>;
};

export async function startStage(
  db: Db,
  syncRunId: string,
  integrationId: string,
  stage: string,
  type: string,
  bullmqJobId: string
): Promise<string> {
  const [row] = await db
    .insert(syncRunStages)
    .values({
      syncRunId,
      integrationId,
      bullmqJobId,
      type,
      stage,
      status: 'running',
      startedAt: new Date().toISOString()
    })
    .returning();
  return row!.id;
}

export async function completeStage(db: Db, stageId: string, m: StageMetrics = {}): Promise<void> {
  await db
    .update(syncRunStages)
    .set({
      status: 'completed',
      finishedAt: new Date().toISOString(),
      recordsIn: m.recordsIn ?? 0,
      recordsOut: m.recordsOut ?? 0,
      createdCt: m.createdCt ?? 0,
      updatedCt: m.updatedCt ?? 0,
      failedCt: m.failedCt ?? 0,
      metrics: (m.metrics as Record<string, unknown>) ?? null
    })
    .where(eq(syncRunStages.id, stageId));
}

export async function failStage(db: Db, stageId: string, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  await db
    .update(syncRunStages)
    .set({
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: msg
    })
    .where(eq(syncRunStages.id, stageId));
}

export async function recordFetchSuccess(
  db: Db,
  linkId: string,
  integrationId: string,
  facet: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(syncContext)
    .values({
      linkId,
      integrationId,
      type: facet,
      consecutiveFailures: 0,
      lastSuccessAt: now,
      fullSyncAt: now,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: [syncContext.linkId, syncContext.integrationId, syncContext.type],
      set: { consecutiveFailures: 0, lastSuccessAt: now, fullSyncAt: now, updatedAt: now }
    });
}

export async function recordFetchFailure(
  db: Db,
  linkId: string,
  integrationId: string,
  facet: string,
  error: unknown
): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  const kind =
    (error as { kind?: string })?.kind ?? (error instanceof Error ? error.name : 'Error');
  const now = new Date().toISOString();

  const [existing] = await db
    .select({ failures: syncContext.consecutiveFailures })
    .from(syncContext)
    .where(
      and(
        eq(syncContext.linkId, linkId),
        eq(syncContext.integrationId, integrationId),
        eq(syncContext.type, facet)
      )
    )
    .limit(1);

  const newCount = (existing?.failures ?? 0) + 1;

  await db
    .insert(syncContext)
    .values({
      linkId,
      integrationId,
      type: facet,
      consecutiveFailures: newCount,
      lastFailureAt: now,
      lastErrorClass: kind,
      lastErrorMessage: msg,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: [syncContext.linkId, syncContext.integrationId, syncContext.type],
      set: {
        consecutiveFailures: newCount,
        lastFailureAt: now,
        lastErrorClass: kind,
        lastErrorMessage: msg,
        updatedAt: now
      }
    });
}

export type XmaxRow = { id: string; xmax: string };

export async function logEntityChanges(
  db: Db,
  linkId: string,
  syncRunId: string,
  integrationId: string,
  type: string,
  rows: XmaxRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const changes = rows.map((r) => ({
    linkId,
    syncRunId,
    integrationId,
    externalId: r.id,
    type,
    changeType: r.xmax === '0' ? 'created' : ('updated' as 'created' | 'updated')
  }));
  await db.insert(entityChangeLog).values(changes);
}

export async function logRawRecords(
  db: Db,
  linkId: string,
  syncRunId: string,
  facet: string,
  records: unknown[]
): Promise<void> {
  if (records.length === 0) return;
  const rows = records.map((payload, i) => ({
    linkId,
    syncRunId,
    type: facet,
    externalId: String(
      (payload as Record<string, unknown>)?.id ??
        (payload as Record<string, unknown>)?.externalId ??
        i
    ),
    payload: payload as Record<string, unknown>
  }));
  await db.insert(rawIngestLog).values(rows);
}
