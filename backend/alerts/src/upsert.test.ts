import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveMissingAlerts, upsertAlert, type Detection } from './upsert.js';

const detection: Detection = {
  definitionId: 'microsoft-365.identities.noMfa',
  entityType: 'identity',
  entityRef: 'user-alice@example.com',
  entityId: '0000-0000-0000-0000-0000',
  severity: 2,
  message: 'MFA not enforced for user'
};

function makeDb(existingAlerts: unknown[]) {
  const insertedRows: unknown[] = [];
  const updatedRows: { id: string; set: unknown }[] = [];

  const selectBuilder = {
    _alerts: existingAlerts,
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(existingAlerts))
  };

  return {
    __inserted: insertedRows,
    __updated: updatedRows,
    select: vi.fn().mockReturnValue(selectBuilder),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((row) => {
        insertedRows.push(row);
        return Promise.resolve();
      })
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((_, set) => {
          updatedRows.push({ id: 'mock-id', set });
          return Promise.resolve();
        })
      })
    })
  };
}

// We test upsertAlert by observing whether insert or update is called

describe('upsertAlert state machine', () => {
  it('no existing alert → inserts new active alert', async () => {
    const db = makeDb([]) as unknown as Parameters<typeof upsertAlert>[0];
    // Override select to return [] for both queries
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi
        .fn()
        .mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })
        })
    });

    let inserted = false;
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockImplementation(() => {
        inserted = true;
        return Promise.resolve();
      })
    });

    await upsertAlert(db, detection);
    expect(inserted).toBe(true);
  });

  it('existing active alert → updates lastSeenAt only, no insert', async () => {
    const existingActive = [
      {
        id: 'alert-1',
        status: 'active',
        definitionId: 'mfa_enforced',
        entityRef: 'user-alice@example.com'
      }
    ];

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(existingActive) })
        })
      }),
      insert: vi.fn(),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      })
    } as unknown as Parameters<typeof upsertAlert>[0];

    await upsertAlert(db, detection);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it('existing suppressed alert → updates lastSeenAt only, suppressedUntil unchanged', async () => {
    const existingSuppressed = [
      { id: 'alert-2', status: 'suppressed', suppressedUntil: new Date('2099-01-01') }
    ];

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(existingSuppressed) })
        })
      }),
      insert: vi.fn(),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
      })
    } as unknown as Parameters<typeof upsertAlert>[0];

    await upsertAlert(db, detection);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it('only resolved alert exists → inserts new active alert', async () => {
    let callCount = 0;
    // First select (active/suppressed) returns []
    // Second select (resolved) returns resolved alert
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve([]); // no active/suppressed
              return Promise.resolve([{ id: 'alert-3', status: 'resolved' }]);
            })
          })
        })
      }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
      update: vi.fn()
    } as unknown as Parameters<typeof upsertAlert>[0];

    await upsertAlert(db, detection);
    expect(db.insert).toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('resolves active alerts missing from the latest check detections', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const set = vi.fn().mockReturnValue({ where });
    const db = {
      update: vi.fn().mockReturnValue({ set })
    } as unknown as Parameters<typeof resolveMissingAlerts>[0];

    await resolveMissingAlerts(db, {
      definitionIds: ['microsoft-365.licenses.unusedSeats'],
      linkId: 'link-1',
      seenEntityRefs: ['Business Premium']
    });

    expect(db.update).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'resolved',
        resolvedAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    );
    expect(where).toHaveBeenCalled();
  });
});
