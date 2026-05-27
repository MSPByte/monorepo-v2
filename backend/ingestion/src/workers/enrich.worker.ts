import { Worker } from 'bullmq';
import { QUEUES } from '@mspbyte/shared';
import type { EnrichJobData } from '@mspbyte/shared';
import { enrichM365 } from '../adapters/m365/enricher.js';
import { logger } from '../logger.js';
import type { Redis } from 'ioredis';

export function createEnrichWorker(redis: Redis) {
  return new Worker<EnrichJobData>(
    QUEUES.ENRICH,
    async (job) => {
      const { data } = job;

      logger.info(
        { linkId: data.linkId, provider: data.provider, run: data.ingestRunId },
        'Enrich job started'
      );

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

      logger.info({ linkId: data.linkId, provider: data.provider }, 'Enrich job complete');
    },
    { connection: redis, concurrency: 2 }
  );
}
