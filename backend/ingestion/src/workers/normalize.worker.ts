import { Worker } from 'bullmq';
import { QUEUES, FACET_TABLE_MAP, ProviderFacet } from '@mspbyte/shared';
import type { NormalizeJobData } from '@mspbyte/shared';
import { vendorTableRegistry } from '@mspbyte/drizzle';
import type { VendorTableName } from '@mspbyte/drizzle';
import { startStage, completeStage, failStage } from '@mspbyte/shared';
import { getTenantServiceDbByOrgId } from '@mspbyte/drizzle-catalog';
import { getAdapter } from '../adapters/registry.js';
import { getM365FacetSchema } from '../adapters/m365/index.js';
import { getSophosFacetSchema } from '../adapters/sophos/index.js';
import { getDattoFacetSchema } from '../adapters/datto/index.js';
import { getCoveFacetSchema } from '../adapters/cove/index.js';
import { logger } from '../logger.js';
import { sql, getColumns } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { env } from '../env.js';

const SKIP_ON_CONFLICT = new Set(['id', 'linkId', 'externalId', 'createdAt']);
const MAX_LOGGED_FAILURES = 3;

function summarizeError(err: unknown): Record<string, unknown> {
  if (err instanceof z.ZodError) {
    return {
      name: err.name,
      issues: err.issues.slice(0, MAX_LOGGED_FAILURES).map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message
      })),
      issueCount: err.issues.length
    };
  }

  if (err instanceof Error) {
    const cause = 'cause' in err ? (err as Error & { cause?: unknown }).cause : undefined;

    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: cause ? summarizeError(cause) : undefined
    };
  }

  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;
    return {
      type: record['constructor'] ? String(record['constructor']) : 'Object',
      message: record['message'],
      code: record['code'],
      detail: record['detail'],
      constraint: record['constraint'],
      table: record['table'],
      column: record['column']
    };
  }

  return { value: String(err) };
}

function describeRawRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return { type: typeof raw };

  const record = raw as Record<string, unknown>;
  const settings = record.Settings;

  return {
    keys: Object.keys(record).slice(0, 20),
    externalId: record.id ?? record.uid ?? record.AccountId ?? record.externalId,
    partnerId: record.PartnerId,
    settingsKeys:
      settings && typeof settings === 'object' ? Object.keys(settings).slice(0, 20) : undefined
  };
}

function describeNormalizedRecord(row: Record<string, unknown>): Record<string, unknown> {
  return {
    keys: Object.keys(row).slice(0, 30),
    externalId: row.externalId,
    requiredIdentity: {
      externalId: row.externalId,
      linkId: row.linkId,
      siteId: row.siteId
    }
  };
}

function getFacetSchema(provider: string, facet: ProviderFacet) {
  switch (provider) {
    case 'microsoft-365':
      return getM365FacetSchema(facet);
    case 'sophos-partner':
      return getSophosFacetSchema(facet);
    case 'dattormm':
      return getDattoFacetSchema(facet);
    case 'cove':
      return getCoveFacetSchema(facet);
    default:
      return getAdapter(provider).rawSchema;
  }
}

export function createNormalizeWorker(redis: Redis, queueName: string = QUEUES.NORMALIZE) {
  const worker = new Worker<NormalizeJobData>(
    queueName,
    async (job) => {
      const { data } = job;
      const adapter = getAdapter(data.provider);
      const schema = getFacetSchema(data.provider, data.facet as ProviderFacet);

      logger.info(
        {
          linkId: data.linkId,
          provider: data.provider,
          facet: data.facet,
          normalizeJobId: job.id,
          rawRecords: data.rawRecords.length
        },
        'Normalize job started'
      );

      const normalized: Record<string, unknown>[] = [];
      const validationFailures: Array<Record<string, unknown>> = [];
      const normalizeFailures: Array<Record<string, unknown>> = [];
      let validationFailureCount = 0;
      let normalizeFailureCount = 0;

      for (const [index, raw] of data.rawRecords.entries()) {
        let parsed: unknown;
        try {
          parsed = schema.parse(raw);
        } catch (err) {
          validationFailureCount++;
          if (validationFailures.length < MAX_LOGGED_FAILURES) {
            validationFailures.push({
              index,
              raw: describeRawRecord(raw),
              err: summarizeError(err)
            });
          }
          continue;
        }

        try {
          normalized.push(adapter.normalize(parsed, data.facet) as Record<string, unknown>);
        } catch (err) {
          normalizeFailureCount++;
          if (normalizeFailures.length < MAX_LOGGED_FAILURES) {
            normalizeFailures.push({
              index,
              raw: describeRawRecord(raw),
              err: summarizeError(err)
            });
          }
        }
      }

      if (validationFailureCount > 0 || normalizeFailureCount > 0) {
        logger.warn(
          {
            linkId: data.linkId,
            provider: data.provider,
            facet: data.facet,
            normalizeJobId: job.id,
            rawRecords: data.rawRecords.length,
            validRecords: normalized.length,
            validationFailureCount,
            normalizeFailureCount,
            validationFailures,
            normalizeFailures
          },
          'Normalize skipped records before upsert'
        );
      }

      const { db } = await getTenantServiceDbByOrgId(data.orgId, env.ENCRYPTION_KEY);
      const stageId = await startStage(
        db,
        data.syncRunId,
        data.provider,
        'normalize',
        data.facet,
        job.id ?? data.ingestRunId
      );

      if (normalized.length === 0) {
        await completeStage(db, stageId, {
          recordsIn: data.rawRecords.length,
          recordsOut: 0,
          failedCt: data.rawRecords.length
        });
        logger.warn(
          {
            linkId: data.linkId,
            provider: data.provider,
            facet: data.facet,
            normalizeJobId: job.id,
            rawRecords: data.rawRecords.length,
            validationFailureCount,
            normalizeFailureCount,
            validationFailures,
            normalizeFailures
          },
          'No valid records to upsert'
        );
        return;
      }

      const tableName = FACET_TABLE_MAP[data.facet] as VendorTableName | undefined;

      if (!tableName || !vendorTableRegistry[tableName]) {
        await completeStage(db, stageId, {
          recordsIn: data.rawRecords.length,
          recordsOut: 0,
          failedCt: normalized.length
        });
        logger.warn(
          {
            linkId: data.linkId,
            provider: data.provider,
            facet: data.facet,
            normalizeJobId: job.id,
            tableName,
            registeredTables: Object.keys(vendorTableRegistry)
          },
          'No vendor table registered for this facet — skipping upsert'
        );
        return;
      }

      const { table, conflictTarget } = vendorTableRegistry[tableName];

      const now = new Date();
      const insertRows: Record<string, unknown>[] = normalized.map((row) => ({
        ...row,
        linkId: data.linkId,
        siteId: data.siteId,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: (row['lastSeenAt'] as Date | undefined) ?? now
      }));

      logger.info(
        {
          linkId: data.linkId,
          provider: data.provider,
          facet: data.facet,
          normalizeJobId: job.id,
          table: tableName,
          records: insertRows.length,
          sample: insertRows[0] ? describeNormalizedRecord(insertRows[0]) : undefined
        },
        'Normalize upsert starting'
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cols = getColumns(table as unknown as Parameters<typeof getColumns>[0]);
      const setClause = Object.fromEntries(
        Object.entries(cols)
          .filter(([key]) => !SKIP_ON_CONFLICT.has(key))
          .map(([key, col]) => [key, Object(col)])
          .map(([key, col]) => [key, sql.raw(`excluded.${col?.name}`)])
      );

      try {
        // RETURNING xmax lets us detect inserts (xmax='0') vs updates
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const returned = await (db.insert(table as any).values(insertRows) as any)
          .onConflictDoUpdate({ target: conflictTarget, set: setClause })
          .returning({ id: sql<string>`id::text`, xmax: sql<string>`xmax::text` });

        const xmaxRows = returned as { id: string; xmax: string }[];
        if (xmaxRows.length !== insertRows.length) {
          logger.warn(
            {
              linkId: data.linkId,
              provider: data.provider,
              facet: data.facet,
              normalizeJobId: job.id,
              table: tableName,
              attempted: insertRows.length,
              returned: xmaxRows.length,
              sampleExternalIds: insertRows.slice(0, 10).map((row) => row['externalId'])
            },
            'Normalize upsert returned fewer rows than attempted'
          );
        }

        const createdCt = xmaxRows.filter((r) => r.xmax === '0').length;
        const updatedCt = xmaxRows.length - createdCt;

        await completeStage(db, stageId, {
          recordsIn: data.rawRecords.length,
          recordsOut: xmaxRows.length,
          createdCt,
          updatedCt,
          failedCt: data.rawRecords.length - normalized.length
        });

        logger.info(
          {
            linkId: data.linkId,
            provider: data.provider,
            facet: data.facet,
            table: tableName,
            count: insertRows.length,
            created: createdCt,
            updated: updatedCt,
            skipped: data.rawRecords.length - normalized.length
          },
          'Normalize upsert complete'
        );
      } catch (err) {
        await failStage(db, stageId, err);
        logger.error(
          {
            linkId: data.linkId,
            provider: data.provider,
            facet: data.facet,
            normalizeJobId: job.id,
            table: tableName,
            records: insertRows.length,
            sampleExternalIds: insertRows.slice(0, 10).map((row) => row['externalId']),
            err: summarizeError(err)
          },
          'Normalize upsert failed'
        );
        throw err;
      }
    },
    { connection: redis, concurrency: 10 }
  );

  worker.on('failed', (job, err) => {
    const data = job?.data;
    logger.error(
      {
        normalizeJobId: job?.id,
        linkId: data?.linkId,
        provider: data?.provider,
        facet: data?.facet,
        rawRecords: data?.rawRecords?.length,
        err: summarizeError(err)
      },
      'Normalize job failed'
    );
  });

  return worker;
}
