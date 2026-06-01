import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  unique
} from 'drizzle-orm/pg-core';
import { crudPolicy, authenticatedRole } from 'drizzle-orm/neon';
import { complianceSchema } from '../schemas.js';
import { sites, integrations, integrationLinks } from '../public/index.js';
import type { JsonValue } from '../../types.js';

export const complianceFrameworks = complianceSchema.table(
  'frameworks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    integrationId: text('integration_id').references(() => integrations.id),
    parentId: uuid('parent_id'),
    isManaged: boolean('is_managed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  () => [crudPolicy({ role: authenticatedRole, read: true, modify: true })]
);

// checkTypeId references definitions.alertDefinitions.id — stored as plain text
// to avoid circular import between compliance and definitions schemas
export const complianceFrameworkChecks = complianceSchema.table(
  'framework_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    frameworkId: uuid('framework_id')
      .notNull()
      .references(() => complianceFrameworks.id, { onDelete: 'cascade' }),
    checkTypeId: text('check_type_id'),
    name: text('name').notNull(),
    description: text('description'),
    checkConfig: jsonb('check_config').$type<JsonValue>().notNull(),
    severity: text('severity').notNull().default('warning'),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    onFailWorkflowId: uuid('on_fail_workflow_id'),
    onPassWorkflowId: uuid('on_pass_workflow_id'),
    onChangeWorkflowId: uuid('on_change_workflow_id'),
    siteId: uuid('site_id').references(() => sites.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique().on(t.frameworkId, t.checkTypeId),
    crudPolicy({ role: authenticatedRole, read: true, modify: true })
  ]
);

export const complianceAssignments = complianceSchema.table(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    frameworkId: uuid('framework_id')
      .notNull()
      .references(() => complianceFrameworks.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
    integrationId: text('integration_id').references(() => integrations.id),
    linkId: uuid('link_id').references(() => integrationLinks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique().on(t.frameworkId, t.siteId),
    crudPolicy({ role: authenticatedRole, read: true, modify: true })
  ]
);

export const complianceResults = complianceSchema.table(
  'results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    frameworkCheckId: uuid('framework_check_id').references(() => complianceFrameworkChecks.id),
    siteId: uuid('site_id').references(() => sites.id),
    linkId: uuid('link_id').references(() => integrationLinks.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pass', 'fail', 'suppressed', 'error'] }).notNull(),
    detail: jsonb('detail'),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique().on(t.frameworkCheckId, t.siteId, t.linkId),
    crudPolicy({ role: authenticatedRole, read: true, modify: false })
  ]
);

export type ComplianceFramework = typeof complianceFrameworks.$inferSelect;
export type ComplianceFrameworkCheck = typeof complianceFrameworkChecks.$inferSelect;
export type ComplianceAssignment = typeof complianceAssignments.$inferSelect;
export type ComplianceResult = typeof complianceResults.$inferSelect;
