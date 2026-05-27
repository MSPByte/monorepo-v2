import { eq, and, inArray } from 'drizzle-orm';
import { syncRuns, syncContext } from '@mspbyte/drizzle';
import { MAX_CONSECUTIVE_FAILURES, STALE_RUN_THRESHOLD_MS } from '@mspbyte/shared';
import type { MspDb } from '@mspbyte/drizzle';
import type { SyncContext } from '@mspbyte/drizzle';

export async function hasActiveRun(db: MspDb, linkId: string): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - STALE_RUN_THRESHOLD_MS);
  const rows = await db
    .select({ id: syncRuns.id })
    .from(syncRuns)
    .where(and(
      eq(syncRuns.linkId, linkId),
      inArray(syncRuns.status, ['pending', 'running']),
    ))
    .limit(1);

  if (rows.length === 0) return false;

  // Treat runs older than the stale threshold as dead — don't block re-scheduling
  const [run] = await db
    .select({ createdAt: syncRuns.createdAt })
    .from(syncRuns)
    .where(and(
      eq(syncRuns.linkId, linkId),
      inArray(syncRuns.status, ['pending', 'running']),
    ))
    .limit(1);

  if (!run) return false;
  return run.createdAt > staleThreshold;
}

export async function getSyncContexts(db: MspDb, linkId: string): Promise<SyncContext[]> {
  return db.select().from(syncContext).where(eq(syncContext.linkId, linkId));
}

export function isLinkHealthy(contexts: SyncContext[]): boolean {
  if (contexts.length === 0) return true;
  return contexts.every((c) => c.consecutiveFailures < MAX_CONSECUTIVE_FAILURES);
}

export function decideFacetMode(
  contexts: SyncContext[],
  facet: string
): { mode: 'full'; cursor?: string } {
  // Cursor/incremental is scaffolded but deferred — always full for now.
  void contexts;
  void facet;
  return { mode: 'full', cursor: undefined };
}
