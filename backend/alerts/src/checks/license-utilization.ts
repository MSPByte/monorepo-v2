import { and, eq } from 'drizzle-orm';
import { m365Licenses } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from './interface.js';

function licenseDetail(license: typeof m365Licenses.$inferSelect) {
  const totalUnits = license.totalUnits ?? 0;
  const consumedUnits = license.consumedUnits ?? 0;
  const unusedUnits = Math.max(0, totalUnits - consumedUnits);
  const utilizationPct = totalUnits > 0 ? (consumedUnits / totalUnits) * 100 : 0;
  const skuName = license.friendlyName || license.skuPartNumber;

  return {
    skuId: license.skuId,
    skuName,
    skuPartNumber: license.skuPartNumber,
    friendlyName: license.friendlyName,
    totalUnits,
    consumedUnits,
    unusedUnits,
    warningUnits: license.warningUnits ?? 0,
    utilizationPct
  };
}

function licenseEntityRef(license: typeof m365Licenses.$inferSelect): string {
  return license.skuPartNumber || license.skuId || license.friendlyName || license.id;
}

export const licenseUnusedSeatsCheck: CheckEvaluator = {
  checkId: 'license_unused_seats',
  definitionId: 'microsoft-365.licenses.unusedSeats',
  sourceTables: ['m365_licenses'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const conditions = [];
    if (linkId) conditions.push(eq(m365Licenses.linkId, linkId));

    const rows = await db
      .select()
      .from(m365Licenses)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return rows
      .map((license) => ({ license, detail: licenseDetail(license) }))
      .filter(
        ({ detail }) =>
          detail.totalUnits > 0 && detail.unusedUnits > 0 && detail.utilizationPct < 70
      )
      .map(({ license, detail }) => ({
        checkId: 'license_unused_seats',
        definitionId: 'microsoft-365.licenses.unusedSeats',
        linkId: linkId ?? license.linkId,
        entityType: 'license',
        entityRef: licenseEntityRef(license),
        entityId: license.id,
        severity: 2,
        detail
      }));
  }
};

export const licenseExpiringSoonCheck: CheckEvaluator = {
  checkId: 'license_expiring_soon',
  definitionId: 'microsoft-365.licenses.expiringSoon',
  sourceTables: ['m365_licenses'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const conditions = [];
    if (linkId) conditions.push(eq(m365Licenses.linkId, linkId));

    const rows = await db
      .select()
      .from(m365Licenses)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return rows
      .map((license) => ({ license, detail: licenseDetail(license) }))
      .filter(({ detail }) => detail.warningUnits > 0)
      .map(({ license, detail }) => ({
        checkId: 'license_expiring_soon',
        definitionId: 'microsoft-365.licenses.expiringSoon',
        linkId: linkId ?? license.linkId,
        entityType: 'license',
        entityRef: licenseEntityRef(license),
        entityId: license.id,
        severity: 1,
        detail
      }));
  }
};
