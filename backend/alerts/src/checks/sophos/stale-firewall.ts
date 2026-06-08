import { and, eq, lt } from 'drizzle-orm';
import { sophosFirewalls } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from '../interface.js';
import { alertSeverity } from '../severity.js';

const STALE_FIREWALL_DAYS = 30;

export const sophosStaleFirewallCheck: CheckEvaluator = {
  checkId: 'sophos_stale_firewall',
  definitionId: 'sophos.firewall.stale',
  sourceTables: ['sophos_firewalls'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const cutoff = new Date(Date.now() - STALE_FIREWALL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const conditions = [
      lt(sophosFirewalls.lastChangeAt, cutoff),
      eq(sophosFirewalls.connected, false)
    ];
    if (linkId) conditions.push(eq(sophosFirewalls.linkId, linkId));

    const rows = await db
      .select()
      .from(sophosFirewalls)
      .where(and(...conditions));

    return rows.map((row) => ({
      checkId: 'sophos_stale_firewall',
      definitionId: 'sophos.firewall.stale',
      linkId: linkId ?? row.linkId,
      siteId: row.siteId ?? undefined,
      entityType: 'firewall',
      entityRef: row.hostname || row.name,
      entityId: row.id,
      severity: alertSeverity('sophos.firewall.stale'),
      detail: {
        name: row.name,
        hostname: row.hostname,
        model: row.model,
        serialNumber: row.serialNumber,
        lastSeenAt: row.lastChangeAt,
        staleDays: STALE_FIREWALL_DAYS
      }
    }));
  }
};
