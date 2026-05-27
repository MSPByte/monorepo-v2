import { Worker, Queue } from 'bullmq';
import { QUEUES } from '@mspbyte/shared';
import type { FetchJobData, NormalizeJobData } from '@mspbyte/shared';
import type { AdapterContext } from '@mspbyte/shared';
import { getAdapter } from '../adapters/registry.js';
import { logger } from '../logger.js';
import type { Redis } from 'ioredis';

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export function createFetchWorker(redis: Redis) {
  const normalizeQueue = new Queue<NormalizeJobData>(QUEUES.NORMALIZE, { connection: redis });

  return new Worker<FetchJobData>(
    QUEUES.FETCH,
    async (job) => {
      const { data } = job;
      const adapter = getAdapter(data.provider);

      const ctx: AdapterContext = {
        linkMeta: data.linkMeta,
        integrationConfig: data.integrationConfig,
        orgId: data.orgId
      };

      logger.info(
        { linkId: data.linkId, provider: data.provider, facet: data.facet, run: data.ingestRunId },
        'Fetch job started'
      );

      let batchIndex = 0;
      try {
        for await (const page of adapter.fetchFacet(data.linkId, data.facet, data.cursor, ctx)) {
          const batches = chunk(page as unknown[], 100);
          for (const batch of batches) {
            await normalizeQueue.add(
              `normalize:${data.provider}:${data.facet}:${data.ingestRunId}:${batchIndex}`,
              {
                linkId: data.linkId,
                siteId: data.siteId,
                orgId: data.orgId,
                provider: data.provider,
                facet: data.facet,
                ingestRunId: data.ingestRunId,
                rawRecords: batch
              }
            );
            batchIndex++;
          }
        }

        logger.info(
          { linkId: data.linkId, provider: data.provider, facet: data.facet, batches: batchIndex },
          'Fetch job completed'
        );
      } catch (err) {
        const ingestErr = err as { kind?: string; message?: string; retriable?: boolean };
        if (ingestErr?.kind === 'auth_failure' || ingestErr?.kind === 'schema_violation') {
          logger.error(
            {
              linkId: data.linkId,
              siteId: data.siteId,
              provider: data.provider,
              facet: data.facet,
              kind: ingestErr.kind,
              err
            },
            'Non-retriable fetch error'
          );
          await job.moveToFailed(
            new Error(ingestErr.message ?? 'Non-retriable error'),
            job.token ?? ''
          );
          return;
        }
        logger.warn(
          {
            linkId: data.linkId,
            provider: data.provider,
            facet: data.facet,
            err
          },
          'Retriable fetch error'
        );
        throw err;
      }
    },
    { connection: redis, concurrency: 5 }
  );
}
