import { Worker } from 'bullmq';
import { QUEUES } from '@mspbyte/shared';
import type { AlertsJobData } from '@mspbyte/shared';
import { getTenantServiceDb } from '@mspbyte/drizzle-catalog';
import { checkRegistry } from '../checks/registry.js';
import { upsertAlert } from '../upsert.js';
import { logger } from '../logger.js';
import type { Redis } from 'ioredis';

export function createAlertsWorker(redis: Redis) {
  return new Worker<AlertsJobData>(
    QUEUES.ALERTS,
    async (job) => {
      const { siteId, linkId, orgId, ingestRunId } = job.data;

      let db: Awaited<ReturnType<typeof getTenantServiceDb>>['db'];
      try {
        ({ db } = await getTenantServiceDb(orgId));
      } catch (err) {
        logger.error({ orgId, err }, 'Org not found — skipping alerts job');
        return;
      }

      const checks = checkRegistry.getAll();
      logger.info(
        { orgId, siteId, linkId, run: ingestRunId, checks: checks.length },
        'Alerts job started'
      );

      for (const check of checks) {
        let detections;
        try {
          detections = await check.evaluate({ siteId, linkId, db });
        } catch (err) {
          logger.error({ checkId: check.checkId, orgId, err }, 'Check evaluation failed');
          continue;
        }

        for (const detection of detections) {
          try {
            await upsertAlert(db, {
              definitionId: detection.definitionId,
              siteId,
              linkId,
              entityType: detection.entityType,
              entityRef: detection.entityRef,
              entityId: detection.entityId,
              severity: detection.severity,
              message: `[${detection.checkId}] ${detection.entityRef}`,
              metadata: detection.detail
            });
          } catch (err) {
            logger.error(
              { checkId: check.checkId, entityRef: detection.entityRef, err },
              'Alert upsert failed'
            );
          }
        }

        logger.info(
          { checkId: check.checkId, orgId, detections: detections.length },
          'Check complete'
        );
      }

      logger.info({ orgId, siteId, linkId, run: ingestRunId }, 'Alerts job complete');
    },
    { connection: redis, concurrency: 3 }
  );
}
