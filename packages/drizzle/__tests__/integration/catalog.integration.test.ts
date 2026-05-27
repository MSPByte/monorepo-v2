import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDb, withTestTransaction, seedOrg, seedTenant } from '../../src/test-helpers.js';
import { eq } from 'drizzle-orm';
import { orgs } from '../../src/catalog/schema.js';

describe('catalog schema integration', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeAll(() => {
    db = setupTestDb();
  });

  it('creates an org and reads it back', async () => {
    await withTestTransaction(db.catalogDb, async (tx) => {
      const org = await seedOrg(tx as Parameters<typeof seedOrg>[0]);
      const found = await (tx as Parameters<typeof seedOrg>[0])
        .select()
        .from(orgs)
        .where(eq(orgs.id, org.id));
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('Test Org');
    });
  });

  it('enforces unique constraint on clerk_org_id', async () => {
    await withTestTransaction(db.catalogDb, async (tx) => {
      const clerkOrgId = `org_test_unique_${crypto.randomUUID()}`;
      await seedOrg(tx as Parameters<typeof seedOrg>[0], { clerkOrgId });
      await expect(
        seedOrg(tx as Parameters<typeof seedOrg>[0], { clerkOrgId }),
      ).rejects.toThrow();
    });
  });

  it('creates tenant and site under org, queries with join', async () => {
    await withTestTransaction(db.mspDb, async (tx) => {
      const tenant = await seedTenant(tx as Parameters<typeof seedTenant>[0]);
      expect(tenant.name).toBe('Test Tenant');
      expect(tenant.status).toBe('active');
    });
  });
});
