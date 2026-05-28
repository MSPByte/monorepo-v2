import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { organization, orgs } from './catalog/schema.js';
import { users, integrations, integrationLinks } from '@mspbyte/drizzle';

export function setupTestDb() {
  const catalogUrl = process.env.TEST_CATALOG_DATABASE_URL;
  const mspUrl = process.env.TEST_MSP_DATABASE_URL;
  if (!catalogUrl) throw new Error('TEST_CATALOG_DATABASE_URL is not set');
  if (!mspUrl) throw new Error('TEST_MSP_DATABASE_URL is not set');

  const catalogClient = postgres(catalogUrl);
  const mspClient = postgres(mspUrl);

  const catalogDb = drizzle({ client: catalogClient });
  const mspDb = drizzle({ client: mspClient });

  return { catalogDb, mspDb };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { transaction: (fn: (tx: any) => Promise<any>) => Promise<any> };

export async function withTestTransaction<T>(
  db: AnyDb,
  fn: (tx: unknown) => Promise<T>
): Promise<T> {
  let result: T;
  try {
    await db.transaction(async (tx: unknown) => {
      result = await fn(tx);
      (tx as { rollback: () => never }).rollback();
    });
  } catch {
    // rollback throws — swallow it and return the result
  }
  return result!;
}

export async function seedOrg(
  db: ReturnType<typeof drizzle>,
  overrides: Partial<typeof orgs.$inferInsert> = {}
) {
  const authOrgId = overrides.authOrgId ?? `org_${crypto.randomUUID()}`;
  await (db as ReturnType<typeof drizzle>)
    .insert(organization)
    .values({
      id: authOrgId,
      name: overrides.name ?? 'Test Org',
      slug: overrides.slug ?? `test-org-${crypto.randomUUID().slice(0, 8)}`
    });

  const [org] = await (db as ReturnType<typeof drizzle>)
    .insert(orgs)
    .values({
      authOrgId,
      name: 'Test Org',
      slug: `test-org-${crypto.randomUUID().slice(0, 8)}`,
      neonProjectId: 'test-project',
      neonConnectionString: 'postgresql://test',
      serviceConnectionString: 'postgresql://test',
      ...overrides
    })
    .returning();
  return org;
}

export async function seedUser(
  db: ReturnType<typeof drizzle>,
  overrides: Partial<typeof users.$inferInsert> = {}
) {
  const [user] = await (db as ReturnType<typeof drizzle>)
    .insert(users)
    .values({
      authUserId: `user_test_${crypto.randomUUID()}`,
      email: 'test@example.com',
      name: 'Test User',
      ...overrides
    })
    .returning();
  return user;
}

export async function seedIntegration(
  db: ReturnType<typeof drizzle>,
  overrides: Partial<typeof integrations.$inferInsert> = {}
) {
  const [integration] = await (db as ReturnType<typeof drizzle>)
    .insert(integrations)
    .values({
      id: overrides.id ?? 'microsoft-365',
      config: {},
      ...overrides
    })
    .returning();
  return integration;
}

export async function seedIntegrationLink(
  db: ReturnType<typeof drizzle>,
  overrides: Partial<typeof integrationLinks.$inferInsert> = {}
) {
  const [link] = await (db as ReturnType<typeof drizzle>)
    .insert(integrationLinks)
    .values({
      integrationId: 'microsoft-365',
      ...overrides
    })
    .returning();
  return link;
}
