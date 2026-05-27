import { Redis } from 'ioredis';
import { createComplianceWorker } from './workers/compliance.worker.js';
import { logger } from './logger.js';
import { env } from './env.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = createComplianceWorker(redis);

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  await worker.close();
  await redis.quit();
  process.exit(0);
});

logger.info('Compliance worker started');
