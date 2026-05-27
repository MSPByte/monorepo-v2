import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDb, withTestTransaction, seedIntegration } from '@mspbyte/drizzle-catalog/test-helpers';
import { upsertAlert } from '../../src/upsert.js';
import { alerts } from '@mspbyte/drizzle/msp';
import { eq, and } from 'drizzle-orm';

describe('upsertAlert integration', () => {
  let db: ReturnType<typeof setupTestDb>['mspDb'];

  beforeAll(() => {
    if (!process.env.TEST_MSP_DATABASE_URL) {
      console.warn('TEST_MSP_DATABASE_URL not set — skipping integration tests');
      return;
    }
    db = setupTestDb().mspDb;
  });

  it('same check + entity → updates lastSeenAt, does not create duplicate', async () => {
    if (!process.env.TEST_MSP_DATABASE_URL) return;

    await withTestTransaction(db as Parameters<typeof withTestTransaction>[0], async (tx) => {
      const txDb = tx as typeof db;

      const detection = {
        definitionId: 'mfa_enforced',
        entityType: 'identity',
        entityRef: 'test@example.com',
        severity: 2,
        message: 'MFA not enforced',
      };

      await upsertAlert(txDb, detection);
      await upsertAlert(txDb, detection);

      const rows = await txDb
        .select()
        .from(alerts)
        .where(eq(alerts.entityRef, 'test@example.com'));

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('active');
    });
  });

  it('resolved alert + new detection → creates new active alert', async () => {
    if (!process.env.TEST_MSP_DATABASE_URL) return;

    await withTestTransaction(db as Parameters<typeof withTestTransaction>[0], async (tx) => {
      const txDb = tx as typeof db;

      const detection = {
        definitionId: 'mfa_enforced',
        entityType: 'identity',
        entityRef: 'resolved@example.com',
        severity: 2,
        message: 'MFA not enforced',
      };

      await upsertAlert(txDb, detection);
      await txDb
        .update(alerts)
        .set({ status: 'resolved', resolvedAt: new Date() })
        .where(eq(alerts.entityRef, 'resolved@example.com'));

      await upsertAlert(txDb, detection);

      const rows = await txDb
        .select()
        .from(alerts)
        .where(eq(alerts.entityRef, 'resolved@example.com'));

      expect(rows).toHaveLength(2);
      const active = rows.filter((r) => r.status === 'active');
      expect(active).toHaveLength(1);
    });
  });
});
