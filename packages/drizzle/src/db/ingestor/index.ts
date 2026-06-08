import { uuid, text, integer, jsonb, timestamp, unique, check } from 'drizzle-orm/pg-core';
import { crudPolicy, authenticatedRole } from 'drizzle-orm/neon';
import { sql } from 'drizzle-orm';
import { ingestorSchema } from '../schemas.js';
import { integrationLinks } from '../public/index.js';

export const syncRuns = ingestorSchema.table(
  'sync_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    linkId: uuid('link_id').references(() => integrationLinks.id, { onDelete: 'cascade' }),
    integrationId: text('integration_id').notNull(),
    bullmqJobId: text('bullmq_job_id').notNull(),
    type: text('type').notNull(),
    status: text('status').notNull(),
    mode: text('mode').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  () => [
    check('valid_mode', sql`mode in ('full', 'incremental')`),
    crudPolicy({ role: authenticatedRole, read: true, modify: false })
  ]
);

export const syncRunStages = ingestorSchema.table(
  'sync_run_stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    syncRunId: uuid('sync_run_id')
      .notNull()
      .references(() => syncRuns.id, { onDelete: 'cascade' }),
    integrationId: text('integration_id').notNull(),
    bullmqJobId: text('bullmq_job_id').notNull(),
    type: text('type').notNull(),
    stage: text('stage').notNull(),
    status: text('status').notNull().default('pending'),
    recordsIn: integer('records_in').notNull().default(0),
    recordsOut: integer('records_out').notNull().default(0),
    createdCt: integer('created_ct').notNull().default(0),
    updatedCt: integer('updated_ct').notNull().default(0),
    failedCt: integer('failed_ct').notNull().default(0),
    metrics: jsonb('metrics'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  () => [crudPolicy({ role: authenticatedRole, read: true, modify: false })]
);

export const syncContext = ingestorSchema.table(
  'sync_context',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    linkId: uuid('link_id').references(() => integrationLinks.id, { onDelete: 'cascade' }),
    integrationId: text('integration_id').notNull(),
    type: text('type').notNull(),
    cursor: text('cursor'),
    fullSyncAt: timestamp('full_sync_at', { withTimezone: true, mode: 'string' }),
    incrementalSyncAt: timestamp('incremental_sync_at', { withTimezone: true, mode: 'string' }),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true, mode: 'string' }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true, mode: 'string' }),
    lastErrorClass: text('last_error_class'),
    lastErrorMessage: text('last_error_message'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique('unique_sync_context').on(t.linkId, t.integrationId, t.type),
    crudPolicy({ role: authenticatedRole, read: true, modify: false })
  ]
);

export const rawIngestLog = ingestorSchema.table(
  'raw_ingest_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    linkId: uuid('link_id').references(() => integrationLinks.id, { onDelete: 'cascade' }),
    syncRunId: uuid('sync_run_id')
      .notNull()
      .references(() => syncRuns.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    externalId: text('external_id').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  () => [crudPolicy({ role: authenticatedRole, read: true, modify: false })]
);

export type SyncRun = typeof syncRuns.$inferSelect;
export type SyncRunStage = typeof syncRunStages.$inferSelect;
export type SyncContext = typeof syncContext.$inferSelect;
export type RawIngestLog = typeof rawIngestLog.$inferSelect;
