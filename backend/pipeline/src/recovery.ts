import { Queue } from 'bullmq';
import { eq, inArray } from 'drizzle-orm';
import { createCatalogDb, createTenantDb } from '@mspbyte/drizzle-catalog';
import { organization } from '@mspbyte/drizzle-catalog/catalog';
import { syncRuns } from '@mspbyte/drizzle';
import { Encryption, QUEUES } from '@mspbyte/shared';
import { logger } from './logger.js';
import type { Redis } from 'ioredis';
import { env } from './env.js';

export async function recoverOrphanedRuns(redis: Redis): Promise<void> {
  const catalogDb = createCatalogDb();
  const allOrgs = await catalogDb
    .select()
    .from(organization)
    .where(eq(organization.status, 'active'));

  const alertsQueue = new Queue(QUEUES.ALERTS, { connection: redis });

  try {
    for (const org of allOrgs) {
      const mspDb = createTenantDb(org.serviceConnectionString, env.ENCRYPTION_KEY);

      const pendingRuns = await mspDb
        .select({ id: syncRuns.id, bullmqJobId: syncRuns.bullmqJobId, linkId: syncRuns.linkId })
        .from(syncRuns)
        .where(inArray(syncRuns.status, ['pending', 'running']));

      for (const run of pendingRuns) {
        const job = await alertsQueue.getJob(run.bullmqJobId);
        if (!job) {
          await mspDb
            .update(syncRuns)
            .set({ status: 'interrupted', finishedAt: new Date() })
            .where(eq(syncRuns.id, run.id));
          logger.info(
            { orgId: org.id, linkId: run.linkId, syncRunId: run.id, bullmqJobId: run.bullmqJobId },
            'Marked orphaned sync_run as interrupted'
          );
        }
      }
    }
  } finally {
    await alertsQueue.close();
  }
}
