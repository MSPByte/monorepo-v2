import { pgTable, text, timestamp, index, uuid } from 'drizzle-orm/pg-core';

export const orgs = pgTable(
  'orgs',
  {
    id: uuid().primaryKey().defaultRandom(),
    clerkOrgId: text('clerk_org_id').notNull().unique(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    neonProjectId: text('neon_project_id').notNull(),
    neonConnectionString: text('neon_connection_string').notNull(),
    serviceConnectionString: text('service_connection_string').notNull(),
    status: text('status', { enum: ['pending', 'active', 'suspended'] })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('orgs_clerk_org_id_idx').on(t.clerkOrgId)]
);

export type Org = typeof orgs.$inferSelect;
export type NewOrg = typeof orgs.$inferInsert;
