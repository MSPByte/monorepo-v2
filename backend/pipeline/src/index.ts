import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { scheduleIngestion } from './scheduler.js';
import { recoverOrphanedRuns } from './recovery.js';
import { env } from './env.js';
import { logger } from './logger.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Use BullMQ repeatable job scheduler so the schedule survives restarts
const schedulerQueue = new Queue('pipeline-scheduler', { connection: redis });

await schedulerQueue.upsertJobScheduler(
  'ingest-scheduler',
  { pattern: env.SCHEDULE_CRON },
  {
    name: 'schedule-ingestion',
    data: {},
    opts: { removeOnComplete: 5, removeOnFail: 10 }
  }
);

logger.info({ cron: env.SCHEDULE_CRON }, 'BullMQ repeatable job registered');

// Recover any sync_runs orphaned by a Redis reset or crash before scheduling
try {
  await recoverOrphanedRuns(redis);
  logger.info('Orphaned run recovery complete');
} catch (err) {
  logger.error({ err }, 'Orphaned run recovery failed — proceeding with scheduling');
}

// Also run immediately on startup
try {
  await scheduleIngestion(redis, 'scheduled');
  logger.info('Initial ingestion flows scheduled on startup');
} catch (err) {
  logger.error({ err }, 'Initial scheduling failed');
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  await schedulerQueue.close();
  await redis.quit();
  process.exit(0);
});

logger.info({ cron: env.SCHEDULE_CRON }, 'Pipeline scheduler started');
