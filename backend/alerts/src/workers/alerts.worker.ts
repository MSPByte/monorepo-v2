import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { QUEUES, MAX_CONSECUTIVE_FAILURES } from '@mspbyte/shared';
import type { AlertsJobData } from '@mspbyte/shared';
import { getTenantServiceDb } from '@mspbyte/drizzle-catalog';
import { syncRuns, syncContext, integrationLinks, startStage, completeStage, failStage } from '@mspbyte/drizzle';
import { checkRegistry } from '../checks/registry.js';
import { upsertAlert } from '../upsert.js';
import { logger } from '../logger.js';
import type { Redis } from 'ioredis';

export function createAlertsWorker(redis: Redis) {
  return new Worker<AlertsJobData>(
    QUEUES.ALERTS,
    async (job) => {
      const { siteId, linkId, orgId, ingestRunId, syncRunId, mode } = job.data;

      let db: Awaited<ReturnType<typeof getTenantServiceDb>>['db'];
      try {
        ({ db } = await getTenantServiceDb(orgId));
      } catch (err) {
        logger.error({ orgId, err }, 'Org not found — skipping alerts job');
        return;
      }

      const stageId = await startStage(db, syncRunId, 'alerts', 'alerts', 'all', job.id ?? ingestRunId);

      const checks = checkRegistry.getAll();
      logger.info({ orgId, siteId, linkId, run: ingestRunId, checks: checks.length }, 'Alerts job started');

      let detectionCount = 0;
      try {
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
              detectionCount++;
            } catch (err) {
              logger.error({ checkId: check.checkId, entityRef: detection.entityRef, err }, 'Alert upsert failed');
            }
          }

          logger.info({ checkId: check.checkId, orgId, detections: detections.length }, 'Check complete');
        }

        await completeStage(db, stageId, { recordsOut: detectionCount });

        // Finalize the sync_run
        await db.update(syncRuns).set({ status: 'completed', finishedAt: new Date() }).where(eq(syncRuns.id, syncRunId));

        // Link-health feedback loop: if mode is not replay, check consecutive failures
        if (mode !== 'replay' && linkId) {
          const contexts = await db.select().from(syncContext).where(eq(syncContext.linkId, linkId));
          const unhealthy = contexts.some((c) => c.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES);

          if (unhealthy) {
            await db.update(integrationLinks).set({ status: 'error', updatedAt: new Date() }).where(eq(integrationLinks.id, linkId));
            logger.warn({ orgId, linkId }, 'Link marked error: consecutive failure threshold reached');
          } else {
            // Auto-recover: reset to active if it was previously in error
            const [link] = await db.select({ status: integrationLinks.status }).from(integrationLinks).where(eq(integrationLinks.id, linkId)).limit(1);
            if (link?.status === 'error') {
              await db.update(integrationLinks).set({ status: 'active', updatedAt: new Date() }).where(eq(integrationLinks.id, linkId));
              logger.info({ orgId, linkId }, 'Link auto-recovered to active');
            }
          }
        }

        logger.info({ orgId, siteId, linkId, run: ingestRunId }, 'Alerts job complete');
      } catch (err) {
        await failStage(db, stageId, err);
        await db.update(syncRuns).set({ status: 'failed', finishedAt: new Date() }).where(eq(syncRuns.id, syncRunId));
        throw err;
      }
    },
    { connection: redis, concurrency: 3 }
  );
}
