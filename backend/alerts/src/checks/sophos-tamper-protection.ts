import { eq, and } from 'drizzle-orm';
import { sophosEndpoints } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from './interface.js';

export const sophosTamperProtectionCheck: CheckEvaluator = {
  checkId: 'sophos_tamper_protection',
  definitionId: 'sophos.endpoint.tamper_protection',

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const conditions = [eq(sophosEndpoints.tamperProtectionEnabled, false)];
    if (linkId) conditions.push(eq(sophosEndpoints.linkId, linkId));

    const rows = await db
      .select()
      .from(sophosEndpoints)
      .where(and(...conditions));

    return rows.map((row) => ({
      checkId: 'sophos_tamper_protection',
      definitionId: 'sophos.endpoint.tamper_protection',
      linkId,
      siteId: row.siteId ?? undefined,
      entityType: 'endpoint',
      entityRef: row.hostname,
      entityId: row.id,
      severity: 2,
      detail: {
        hostname: row.hostname,
        type: row.type,
        platform: row.platform,
        online: row.online
      }
    }));
  }
};
