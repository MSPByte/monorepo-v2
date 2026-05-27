import { Worker } from 'bullmq';
import { QUEUES, FACET_TABLE_MAP, ProviderFacet } from '@mspbyte/shared';
import type { NormalizeJobData } from '@mspbyte/shared';
import { vendorTableRegistry } from '@mspbyte/drizzle';
import type { VendorTableName } from '@mspbyte/drizzle';
import { getTenantServiceDb } from '@mspbyte/drizzle-catalog';
import { getAdapter } from '../adapters/registry.js';
import { getM365FacetSchema } from '../adapters/m365/index.js';
import { getSophosFacetSchema } from '../adapters/sophos/index.js';
import { getDattoFacetSchema } from '../adapters/datto/index.js';
import { getCoveFacetSchema } from '../adapters/cove/index.js';
import { logger } from '../logger.js';
import { sql, getColumns } from 'drizzle-orm';
import type { Redis } from 'ioredis';

const SKIP_ON_CONFLICT = new Set(['id', 'linkId', 'externalId', 'createdAt']);

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

export function createNormalizeWorker(redis: Redis) {
  return new Worker<NormalizeJobData>(
    QUEUES.NORMALIZE,
    async (job) => {
      const { data } = job;
      const adapter = getAdapter(data.provider);
      const schema = getFacetSchema(data.provider, data.facet as ProviderFacet);

      // Parse and normalize each raw record
      const normalized: Record<string, unknown>[] = [];
      for (const raw of data.rawRecords) {
        let parsed: unknown;
        try {
          parsed = schema.parse(raw);
        } catch (err) {
          logger.warn(
            { provider: data.provider, facet: data.facet, err },
            'Skipping record: schema validation failed'
          );
          continue;
        }
        normalized.push(adapter.normalize(parsed, data.facet) as Record<string, unknown>);
      }

      if (normalized.length === 0) {
        logger.info(
          { linkId: data.linkId, provider: data.provider, facet: data.facet },
          'No valid records to upsert'
        );
        return;
      }

      // Resolve target vendor table
      const tableName = FACET_TABLE_MAP[data.facet] as VendorTableName | undefined;

      if (!tableName || !vendorTableRegistry[tableName]) {
        logger.warn(
          { provider: data.provider, facet: data.facet, tableName },
          'No vendor table registered for this facet — skipping upsert'
        );
        return;
      }

      const { table, conflictTarget } = vendorTableRegistry[tableName];

      // Attach linkId, siteId + timestamps to each normalized row
      const now = new Date();
      const insertRows = normalized.map((row) => ({
        ...row,
        linkId: data.linkId,
        siteId: data.siteId,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: (row['lastSeenAt'] as Date | undefined) ?? now
      }));

      // Build ON CONFLICT DO UPDATE set clause from table column definitions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cols = getColumns(table as unknown as Parameters<typeof getColumns>[0]);
      const setClause = Object.fromEntries(
        Object.entries(cols)
          .filter(([key]) => !SKIP_ON_CONFLICT.has(key))
          .map(([key, col]) => [key, Object(col)])
          .map(([key, col]) => [key, sql.raw(`excluded.${col?.name}`)])
      );

      // Resolve MSP service DB for this org
      const { db } = await getTenantServiceDb(data.orgId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.insert(table as any).values(insertRows) as any).onConflictDoUpdate({
        target: conflictTarget,
        set: setClause
      });

      logger.info(
        {
          linkId: data.linkId,
          provider: data.provider,
          facet: data.facet,
          table: tableName,
          count: insertRows.length,
          skipped: data.rawRecords.length - normalized.length
        },
        'Normalize upsert complete'
      );
    },
    { connection: redis, concurrency: 10 }
  );
}
