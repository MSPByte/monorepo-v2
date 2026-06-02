import './adapters/registry.js'; // registers all adapters at import time
import { Redis } from 'ioredis';
import type { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { createCatalogDb } from '@mspbyte/drizzle-catalog';
import { organization } from '@mspbyte/drizzle-catalog/catalog';
import { QUEUES, orgQueueName } from '@mspbyte/shared';
import { createFetchWorker } from './workers/fetch.worker.js';
import { createNormalizeWorker } from './workers/normalize.worker.js';
import { createLinkWorker } from './workers/link.worker.js';
import { createEnrichWorker } from './workers/enrich.worker.js';
import { env } from './env.js';
import { logger } from './logger.js';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  keepAlive: 10_000,
  connectTimeout: 15_000
});

type OrgWorkers = {
  fetch: Worker;
  normalize: Worker;
  link: Worker;
  enrich: Worker;
};

const catalogDb = createCatalogDb();
const workersByOrg = new Map<string, OrgWorkers>();

async function closeOrgWorkers(orgId: string, workers: OrgWorkers) {
  await Promise.all([
    workers.fetch.close(),
    workers.normalize.close(),
    workers.link.close(),
    workers.enrich.close()
  ]);
  logger.info({ orgId }, 'Closed ingestion workers for org');
}

async function syncOrgWorkers() {
  const activeOrgs = await catalogDb
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.status, 'active'));
  const activeOrgIds = new Set(activeOrgs.map((org) => org.id));

  for (const orgId of activeOrgIds) {
    if (workersByOrg.has(orgId)) continue;

    const workers = {
      fetch: createFetchWorker(redis, orgQueueName(QUEUES.FETCH, orgId)),
      normalize: createNormalizeWorker(redis, orgQueueName(QUEUES.NORMALIZE, orgId)),
      link: createLinkWorker(redis, orgQueueName(QUEUES.LINK, orgId)),
      enrich: createEnrichWorker(redis, orgQueueName(QUEUES.ENRICH, orgId))
    };
    workersByOrg.set(orgId, workers);
    logger.info({ orgId }, 'Started ingestion workers for org');
  }

  for (const [orgId, workers] of workersByOrg) {
    if (activeOrgIds.has(orgId)) continue;
    workersByOrg.delete(orgId);
    await closeOrgWorkers(orgId, workers);
  }
}

await syncOrgWorkers();

const orgWorkerRefresh = setInterval(() => {
  void syncOrgWorkers().catch((err) => logger.error({ err }, 'Failed to sync org workers'));
}, 60_000);

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  clearInterval(orgWorkerRefresh);
  await Promise.all(
    [...workersByOrg.entries()].map(([orgId, workers]) => closeOrgWorkers(orgId, workers))
  );
  await redis.quit();
  process.exit(0);
});

logger.info({ orgs: workersByOrg.size }, 'Fetch + normalize + link + enrich org workers started');
