import { Worker } from 'bullmq';
import { QUEUES } from '@mspbyte/shared';
import type { LinkJobData } from '@mspbyte/shared';
import { startStage, completeStage, failStage } from '@mspbyte/shared';
import { getTenantServiceDbByOrgId } from '@mspbyte/drizzle-catalog';
import { linkM365 } from '../adapters/m365/linker.js';
import { logger } from '../logger.js';
import type { Redis } from 'ioredis';
import { env } from '../env.js';

export function createLinkWorker(redis: Redis) {
  return new Worker<LinkJobData>(
    QUEUES.LINK,
    async (job) => {
      const { data } = job;

      logger.info(
        { linkId: data.linkId, provider: data.provider, run: data.ingestRunId },
        'Link job started'
      );

      const { db } = await getTenantServiceDbByOrgId(data.orgId, env.ENCRYPTION_KEY);
      const stageId = await startStage(
        db,
        data.syncRunId,
        data.provider,
        'link',
        data.provider,
        job.id ?? data.ingestRunId
      );

      try {
        switch (data.provider) {
          case 'microsoft-365':
            await linkM365(data.linkId, data.linkMeta ?? {}, data.orgId);
            break;
          default:
            logger.info(
              { linkId: data.linkId, provider: data.provider },
              'No linking logic for provider'
            );
        }

        await completeStage(db, stageId);
        logger.info({ linkId: data.linkId, provider: data.provider }, 'Link job complete');
      } catch (err) {
        await failStage(db, stageId, err);
        throw err;
      }
    },
    { connection: redis, concurrency: 2 }
  );
}
