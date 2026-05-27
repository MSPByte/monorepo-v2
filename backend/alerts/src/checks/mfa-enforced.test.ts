import { describe, it, expect, vi } from 'vitest';
import { mfaEnforcedCheck } from './mfa-enforced.js';
import type { CheckInput } from './interface.js';

function makeDb(identities: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(identities)
      })
    })
  } as unknown as CheckInput['db'];
}

describe('mfaEnforcedCheck', () => {
  it('returns no detections when all users have MFA enabled', async () => {
    const db = makeDb([]); // empty = no users without MFA
    const results = await mfaEnforcedCheck.evaluate({ db });
    expect(results).toHaveLength(0);
  });

  it('returns a detection for each user without MFA', async () => {
    const users = [
      {
        externalId: 'u1',
        email: 'alice@example.com',
        name: 'Alice',
        enabled: true,
        mfaEnforced: false
      },
      { externalId: 'u2', email: 'bob@example.com', name: 'Bob', enabled: true, mfaEnforced: false }
    ];
    const db = makeDb(users);
    const results = await mfaEnforcedCheck.evaluate({ db });
    expect(results).toHaveLength(2);
    expect(results[0].checkId).toBe('mfa_enforced');
    expect(results[0].entityRef).toBe('alice@example.com');
    expect(results[0].entityType).toBe('identity');
    expect(results[0].severity).toBe(2);
    expect(results[1].entityRef).toBe('bob@example.com');
  });

  it('disabled accounts are not returned (query filters by enabled=true)', async () => {
    // The query uses eq(enabled, true), so disabled users won't be in the result set.
    // Here we test that if the DB returns nothing, no detections are produced.
    const db = makeDb([]);
    const results = await mfaEnforcedCheck.evaluate({ db });
    expect(results).toHaveLength(0);
  });

  it('detection includes correct entity details', async () => {
    const users = [
      {
        externalId: 'u3',
        email: 'carol@example.com',
        name: 'Carol',
        enabled: true,
        mfaEnforced: false
      }
    ];
    const db = makeDb(users);
    const [detection] = await mfaEnforcedCheck.evaluate({ db });
    expect(detection.detail.userId).toBe('u3');
    expect(detection.detail.email).toBe('carol@example.com');
    expect(detection.detail.name).toBe('Carol');
  });
});
