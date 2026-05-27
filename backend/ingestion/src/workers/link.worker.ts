import { Worker } from 'bullmq';
import { QUEUES } from '@mspbyte/shared';
import type { LinkJobData } from '@mspbyte/shared';
import { linkM365 } from '../adapters/m365/linker.js';
import { logger } from '../logger.js';
import type { Redis } from 'ioredis';

export function createLinkWorker(redis: Redis) {
  return new Worker<LinkJobData>(
    QUEUES.LINK,
    async (job) => {
      const { data } = job;

      logger.info(
        { linkId: data.linkId, provider: data.provider, run: data.ingestRunId },
        'Link job started'
      );

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

      logger.info({ linkId: data.linkId, provider: data.provider }, 'Link job complete');
    },
    { connection: redis, concurrency: 2 }
  );
}
