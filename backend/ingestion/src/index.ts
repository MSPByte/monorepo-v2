import './adapters/registry.js'; // registers all adapters at import time
import { Redis } from 'ioredis';
import { createFetchWorker } from './workers/fetch.worker.js';
import { createNormalizeWorker } from './workers/normalize.worker.js';
import { createLinkWorker } from './workers/link.worker.js';
import { createEnrichWorker } from './workers/enrich.worker.js';
import { env } from './env.js';
import { logger } from './logger.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const fetchWorker = createFetchWorker(redis);
const normalizeWorker = createNormalizeWorker(redis);
const linkWorker = createLinkWorker(redis);
const enrichWorker = createEnrichWorker(redis);

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  await Promise.all([
    fetchWorker.close(),
    normalizeWorker.close(),
    linkWorker.close(),
    enrichWorker.close()
  ]);
  await redis.quit();
  process.exit(0);
});

logger.info('Fetch + normalize + link + enrich workers started');
