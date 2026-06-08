import { describe, expect, it, vi } from 'vitest';
import { licenseExpiringSoonCheck, licenseUnusedSeatsCheck } from './license-utilization.js';
import type { CheckInput } from '../interface.js';
import { alertSeverity } from '../severity.js';

function makeDb(licenses: unknown[]) {
  const where = vi.fn().mockResolvedValue(licenses);
  return {
    where,
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ where })
      })
    } as unknown as CheckInput['db']
  };
}

function license(overrides: Record<string, unknown>) {
  return {
    id: 'license-id',
    linkId: 'link-id',
    externalId: 'sku-external-id',
    skuId: 'sku-id',
    skuPartNumber: 'M365_BUSINESS_PREMIUM',
    friendlyName: 'Microsoft 365 Business Premium',
    enabled: true,
    totalUnits: 100,
    consumedUnits: 40,
    lockedOutUnits: 0,
    warningUnits: 0,
    suspendedUnits: 0,
    servicePlanNames: [],
    ...overrides
  };
}

describe('licenseUnusedSeatsCheck', () => {
  it('returns a detection when a license has unused seats below 70% utilization', async () => {
    const { db } = makeDb([license({ totalUnits: 100, consumedUnits: 40 })]);

    const results = await licenseUnusedSeatsCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(1);
    expect(results[0].checkId).toBe('license_unused_seats');
    expect(results[0].definitionId).toBe('microsoft-365.licenses.unusedSeats');
    expect(results[0].entityType).toBe('license');
    expect(results[0].entityRef).toBe('M365_BUSINESS_PREMIUM');
    expect(results[0].severity).toBe(alertSeverity('microsoft-365.licenses.unusedSeats'));
    expect(results[0].detail.unusedUnits).toBe(60);
    expect(results[0].detail.utilizationPct).toBe(40);
  });

  it('does not return a detection at or above 70% utilization', async () => {
    const { db } = makeDb([license({ totalUnits: 100, consumedUnits: 70 })]);

    const results = await licenseUnusedSeatsCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(0);
  });

  it('uses the exact utilization percentage instead of a rounded value for the threshold', async () => {
    const { db } = makeDb([license({ totalUnits: 1000, consumedUnits: 696 })]);

    const results = await licenseUnusedSeatsCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(1);
    expect(results[0].detail.utilizationPct).toBe(69.6);
  });

  it('does not return a detection when total units is zero', async () => {
    const { db } = makeDb([license({ totalUnits: 0, consumedUnits: 0 })]);

    const results = await licenseUnusedSeatsCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(0);
  });
});

describe('licenseExpiringSoonCheck', () => {
  it('returns a detection when warning units are present', async () => {
    const { db } = makeDb([license({ warningUnits: 3 })]);

    const results = await licenseExpiringSoonCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(1);
    expect(results[0].checkId).toBe('license_expiring_soon');
    expect(results[0].definitionId).toBe('microsoft-365.licenses.expiringSoon');
    expect(results[0].entityType).toBe('license');
    expect(results[0].severity).toBe(alertSeverity('microsoft-365.licenses.expiringSoon'));
    expect(results[0].detail.warningUnits).toBe(3);
  });

  it('does not return a detection when warning units are zero', async () => {
    const { db } = makeDb([license({ warningUnits: 0 })]);

    const results = await licenseExpiringSoonCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(0);
  });
});
