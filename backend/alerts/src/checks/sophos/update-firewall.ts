import { and, eq, isNotNull } from 'drizzle-orm';
import { sophosFirewalls } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from '../interface.js';
import { alertSeverity } from '../severity.js';

export const sophosFirewallNeedsUpdateCheck: CheckEvaluator = {
  checkId: 'sophos_firewall_needs_update',
  definitionId: 'sophos.firewall.needsUpdate',
  sourceTables: ['sophos_firewalls'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const conditions = [isNotNull(sophosFirewalls.upgradeToVersion)];
    if (linkId) conditions.push(eq(sophosFirewalls.linkId, linkId));

    const rows = await db
      .select()
      .from(sophosFirewalls)
      .where(and(...conditions));

    return rows.map((row) => ({
      checkId: 'sophos_firewall_needs_update',
      definitionId: 'sophos.firewall.needsUpdate',
      linkId: linkId ?? row.linkId,
      siteId: row.siteId ?? undefined,
      entityType: 'firewall',
      entityRef: row.hostname || row.name,
      entityId: row.id,
      severity: alertSeverity('sophos.firewall.needsUpdate'),
      detail: {
        name: row.name,
        hostname: row.hostname,
        model: row.model,
        serialNumber: row.serialNumber,
        firmwareVersion: row.firmwareVersion,
        upgradeToVersion: row.upgradeToVersion,
        connected: row.connected
      }
    }));
  }
};
