import { Worker, Queue } from 'bullmq';
import { QUEUES } from '@mspbyte/shared';
import type { FetchJobData, NormalizeJobData } from '@mspbyte/shared';
import type { AdapterContext } from '@mspbyte/shared';
import {
  startStage,
  completeStage,
  failStage,
  recordFetchSuccess,
  recordFetchFailure,
  logRawRecords
} from '@mspbyte/shared';
import { getTenantServiceDb } from '@mspbyte/drizzle-catalog';
import { getAdapter } from '../adapters/registry.js';
import { logger } from '../logger.js';
import type { Redis } from 'ioredis';
import { env } from '../env.js';

const RAW_LOG_ENABLED = process.env.PIPELINE_RAW_LOG === 'true';
const PRE_FETCH_TIMEOUT_MS = 30_000;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function withTimeout<T>(
  label: string,
  promise: Promise<T>,
  timeoutMs = PRE_FETCH_TIMEOUT_MS
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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

      let tenant: Awaited<ReturnType<typeof getTenantServiceDb>>;
      try {
        tenant = await withTimeout(
          'Tenant service DB lookup',
          getTenantServiceDb(data.orgId, env.ENCRYPTION_KEY)
        );
      } catch (err) {
        logger.error(
          {
            linkId: data.linkId,
            provider: data.provider,
            facet: data.facet,
            orgId: data.orgId,
            err
          },
          'Fetch failed before tenant DB resolved'
        );
        throw err;
      }
      logger.info(
        { linkId: data.linkId, provider: data.provider, facet: data.facet, orgId: data.orgId },
        'Fetch tenant DB resolved'
      );

      const { db } = tenant;
      let stageId: string;
      try {
        stageId = await withTimeout(
          'Fetch stage start',
          startStage(
            db,
            data.syncRunId,
            data.provider,
            'fetch',
            data.facet,
            job.id ?? data.ingestRunId
          )
        );
      } catch (err) {
        logger.error(
          {
            linkId: data.linkId,
            provider: data.provider,
            facet: data.facet,
            syncRunId: data.syncRunId,
            err
          },
          'Fetch failed before stage started'
        );
        throw err;
      }
      logger.info(
        { linkId: data.linkId, provider: data.provider, facet: data.facet, stageId },
        'Fetch stage started'
      );

      let batchIndex = 0;
      let queuedRecords = 0;
      try {
        for await (const page of adapter.fetchFacet(data.linkId, data.facet, data.cursor, ctx)) {
          logger.info(
            {
              linkId: data.linkId,
              provider: data.provider,
              facet: data.facet,
              records: (page as unknown[]).length
            },
            'Fetch page received'
          );

          const batches = chunk(page as unknown[], 100);
          for (const batch of batches) {
            const normalizeJob = await normalizeQueue.add(
              `normalize:${data.provider}:${data.facet}:${data.ingestRunId}:${batchIndex}`,
              {
                linkId: data.linkId,
                siteId: data.siteId,
                orgId: data.orgId,
                provider: data.provider,
                facet: data.facet,
                ingestRunId: data.ingestRunId,
                syncRunId: data.syncRunId,
                rawRecords: batch
              }
            );
            queuedRecords += batch.length;
            logger.info(
              {
                linkId: data.linkId,
                provider: data.provider,
                facet: data.facet,
                batchIndex,
                normalizeJobId: normalizeJob.id,
                records: batch.length
              },
              'Normalize job queued'
            );
            batchIndex++;
          }

          if (RAW_LOG_ENABLED) {
            await logRawRecords(db, data.linkId, data.syncRunId, data.facet, page as unknown[]);
          }
        }

        if (data.mode !== 'replay') {
          await recordFetchSuccess(db, data.linkId, data.provider, data.facet);
        }

        await completeStage(db, stageId, { recordsIn: queuedRecords, recordsOut: batchIndex });

        logger.info(
          {
            linkId: data.linkId,
            provider: data.provider,
            facet: data.facet,
            batches: batchIndex,
            queuedRecords
          },
          'Fetch job completed'
        );
      } catch (err) {
        await failStage(db, stageId, err);

        if (data.mode !== 'replay') {
          await recordFetchFailure(db, data.linkId, data.provider, data.facet, err);
        }

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
          { linkId: data.linkId, provider: data.provider, facet: data.facet, err },
          'Retriable fetch error'
        );
        throw err;
      }
    },
    { connection: redis, concurrency: 5 }
  );
}
