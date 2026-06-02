import { Redis } from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { scheduleIngestion } from './scheduler.js';
import { recoverOrphanedRuns } from './recovery.js';
import { env } from './env.js';
import { logger } from './logger.js';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  keepAlive: 10_000,
  connectTimeout: 15_000
});

// TODO: Self-Scheduling + Event Triggers
// Right now the scheduler polls on a cron interval. Two improvements to make:
// 1. Jobs should re-schedule themselves on completion so facets run again as
//    soon as their interval elapses, without waiting for the next cron tick.
// 2. Event-driven triggers (e.g. new integration link created) should notify
//    the scheduler immediately instead of waiting for the next scan.

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

const schedulerWorker = new Worker(
  'pipeline-scheduler',
  async () => {
    logger.info('Scheduler cron fired — scanning for due ingestion work');
    await recoverOrphanedRuns(redis);
    await scheduleIngestion(redis, 'scheduled');
  },
  { connection: redis, concurrency: 1 }
);

schedulerWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Scheduled ingestion scan failed');
});

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
  await schedulerWorker.close();
  await schedulerQueue.close();
  await redis.quit();
  process.exit(0);
});

logger.info({ cron: env.SCHEDULE_CRON }, 'Pipeline scheduler started');
