import { Worker } from 'bullmq';
import { QUEUES } from '@mspbyte/shared';
import type { EnrichJobData } from '@mspbyte/shared';
import { startStage, completeStage, failStage } from '@mspbyte/shared';
import { getTenantServiceDbByOrgId } from '@mspbyte/drizzle-catalog';
import { enrichM365 } from '../adapters/m365/enricher.js';
import { logger } from '../logger.js';
import type { Redis } from 'ioredis';
import { env } from '../env.js';

export function createEnrichWorker(redis: Redis) {
  return new Worker<EnrichJobData>(
    QUEUES.ENRICH,
    async (job) => {
      const { data } = job;

      logger.info(
        { linkId: data.linkId, provider: data.provider, run: data.ingestRunId },
        'Enrich job started'
      );

      const { db } = await getTenantServiceDbByOrgId(data.orgId, env.ENCRYPTION_KEY);
      const stageId = await startStage(
        db,
        data.syncRunId,
        data.provider,
        'enrich',
        data.provider,
        job.id ?? data.ingestRunId
      );

      try {
        switch (data.provider) {
          case 'microsoft-365':
            await enrichM365(data.linkId, data.orgId);
            break;
          default:
            logger.info(
              { linkId: data.linkId, provider: data.provider },
              'No enrichment logic for provider'
            );
        }

        await completeStage(db, stageId);
        logger.info({ linkId: data.linkId, provider: data.provider }, 'Enrich job complete');
      } catch (err) {
        await failStage(db, stageId, err);
        throw err;
      }
    },
    { connection: redis, concurrency: 2 }
  );
}
