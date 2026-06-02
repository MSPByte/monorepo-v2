import { Redis } from 'ioredis';
import type { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { createCatalogDb } from '@mspbyte/drizzle-catalog';
import { organization } from '@mspbyte/drizzle-catalog/catalog';
import { QUEUES, orgQueueName } from '@mspbyte/shared';
import { createAlertsWorker } from './workers/alerts.worker.js';
import { env } from './env.js';
import { logger } from './logger.js';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  keepAlive: 10_000,
  connectTimeout: 15_000
});

const catalogDb = createCatalogDb();
const workersByOrg = new Map<string, Worker>();

async function syncOrgWorkers() {
  const activeOrgs = await catalogDb
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.status, 'active'));
  const activeOrgIds = new Set(activeOrgs.map((org) => org.id));

  for (const orgId of activeOrgIds) {
    if (workersByOrg.has(orgId)) continue;
    const worker = createAlertsWorker(redis, orgQueueName(QUEUES.ALERTS, orgId));
    workersByOrg.set(orgId, worker);
    logger.info({ orgId }, 'Started alerts worker for org');
  }

  for (const [orgId, worker] of workersByOrg) {
    if (activeOrgIds.has(orgId)) continue;
    workersByOrg.delete(orgId);
    await worker.close();
    logger.info({ orgId }, 'Closed alerts worker for org');
  }
}

await syncOrgWorkers();

const orgWorkerRefresh = setInterval(() => {
  void syncOrgWorkers().catch((err) => logger.error({ err }, 'Failed to sync alerts workers'));
}, 60_000);

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  clearInterval(orgWorkerRefresh);
  await Promise.all([...workersByOrg.values()].map((worker) => worker.close()));
  await redis.quit();
  process.exit(0);
});

logger.info({ orgs: workersByOrg.size }, 'Alerts org workers started');
