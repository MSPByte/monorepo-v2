import { eq, type EmptyRelations } from 'drizzle-orm';
import { createCatalogDb } from './clients.js';
import { createMspDb, createMspServiceDb } from '@mspbyte/drizzle/clients';
import type { MspDb, MspServiceDb } from '@mspbyte/drizzle/clients';
import { orgs } from './catalog/schema.js';
import type { Org } from './catalog/schema.js';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

let _catalogDb:
  | (NeonHttpDatabase<EmptyRelations> & {
      $client: NeonQueryFunction<false, false>;
    })
  | undefined = undefined;

export const getCatalogDb = (connectionString?: string) => {
  if (!_catalogDb) {
    _catalogDb = createCatalogDb(connectionString);
  }

  return _catalogDb;
};

export async function getTenantDb(orgId: string): Promise<{ org: Org; db: MspDb }> {
  const catalogDb = getCatalogDb();

  const [org] = await catalogDb.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!org) throw new Error(`Org not found: ${orgId}`);
  return { org, db: createMspDb(org.neonConnectionString) };
}

export async function getTenantServiceDbByAuthOrg(
  authOrgId: string,
  connectionString?: string
): Promise<{ org: Org; db: MspServiceDb }> {
  const catalogDb = getCatalogDb(connectionString);

  const [org] = await catalogDb.select().from(orgs).where(eq(orgs.authOrgId, authOrgId)).limit(1);
  if (!org) throw new Error(`Org not found for auth org: ${authOrgId}`);
  return { org, db: await createMspServiceDb(org.serviceConnectionString) };
}

export async function getTenantServiceDb(orgId: string) {
  const catalogDb = getCatalogDb();

  const [org] = await catalogDb.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!org) throw new Error(`Org not found: ${orgId}`);
  return { org, db: await createMspServiceDb(org.serviceConnectionString) };
}
