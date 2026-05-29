import { Redis } from 'ioredis';
import { createAlertsWorker } from './workers/alerts.worker.js';
import { env } from './env.js';
import { logger } from './logger.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = createAlertsWorker(redis);

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  await worker.close();
  await redis.quit();
  process.exit(0);
});

logger.info('Alerts worker started');
