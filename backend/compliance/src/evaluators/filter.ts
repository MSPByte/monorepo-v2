import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  m365Identities,
  m365Groups,
  m365Policies,
  m365Licenses,
  m365ExchangeConfigs,
  m365AuthMethods,
  m365Devices,
  m365OAuthGrants,
  m365DomainConfig,
  m365TeamsConfig,
  m365RiskyUsers,
  m365MailboxForwarding,
  m365InboxRules,
  sophosEndpoints,
  sophosFirewalls,
  sophosLicenses,
  dattoEndpoints,
  coveEndpoints
} from '@mspbyte/drizzle';
import type { MspServiceDb } from '@mspbyte/drizzle';
import type { ConditionOperator } from '@mspbyte/shared';

// ─── Table map (string name → Drizzle table) ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLE_MAP: Record<string, any> = {
  m365Identities,
  m365_identities: m365Identities,
  m365Groups,
  m365_groups: m365Groups,
  m365Policies,
  m365_policies: m365Policies,
  m365Licenses,
  m365_licenses: m365Licenses,
  m365ExchangeConfigs,
  m365_exchange_configs: m365ExchangeConfigs,
  m365AuthMethods,
  m365_auth_methods: m365AuthMethods,
  m365Devices,
  m365_devices: m365Devices,
  m365OAuthGrants,
  m365_oauth_grants: m365OAuthGrants,
  m365DomainConfig,
  m365_domain_config: m365DomainConfig,
  m365TeamsConfig,
  m365_teams_config: m365TeamsConfig,
  m365RiskyUsers,
  m365_risky_users: m365RiskyUsers,
  m365MailboxForwarding,
  m365_mailbox_forwarding: m365MailboxForwarding,
  m365InboxRules,
  m365_inbox_rules: m365InboxRules,
  sophosEndpoints,
  sophos_endpoints: sophosEndpoints,
  sophosFirewalls,
  sophos_firewalls: sophosFirewalls,
  sophosLicenses,
  sophos_licenses: sophosLicenses,
  dattoEndpoints,
  datto_endpoints: dattoEndpoints,
  coveEndpoints,
  cove_endpoints: coveEndpoints
};

// ─── Config schema ────────────────────────────────────────────────────────────

const ConditionOperatorEnum = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'size_eq',
  'size_gte',
  'size_lte',
  'is_null',
  'is_not_null'
]);

export const CheckConfigSchema = z.object({
  table: z.string(),
  filter: z
    .object({
      logic: z.enum(['AND', 'OR']),
      conditions: z.array(
        z.object({
          field: z.string(),
          op: ConditionOperatorEnum,
          value: z.unknown()
        })
      )
    })
    .optional(),
  threshold: z.number().optional().default(1),
  field: z.string().optional(),
  op: ConditionOperatorEnum.optional(),
  value: z.unknown().optional()
});

export type CheckConfig = z.infer<typeof CheckConfigSchema>;

// ─── Field helpers ─────────────────────────────────────────────────────────────

export function getNestedValue(row: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((obj, key) => {
    if (obj !== null && typeof obj === 'object') return (obj as Record<string, unknown>)[key];
    return undefined;
  }, row);
}

export function evalFieldOp(actual: unknown, op: ConditionOperator, expected: unknown): boolean {
  switch (op) {
    case 'eq':
      return actual == expected;
    case 'neq':
      return actual != expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'contains':
      return Array.isArray(actual) && actual.includes(expected);
    case 'not_contains':
      return !Array.isArray(actual) || !actual.includes(expected);
    case 'size_eq':
      return Array.isArray(actual) && actual.length === Number(expected);
    case 'size_gte':
      return Array.isArray(actual) && actual.length >= Number(expected);
    case 'size_lte':
      return Array.isArray(actual) && actual.length <= Number(expected);
    case 'is_null':
      return actual === null || actual === undefined;
    case 'is_not_null':
      return actual !== null && actual !== undefined;
    default:
      return false;
  }
}

export function buildJsFilter(
  filter: CheckConfig['filter']
): ((rows: Record<string, unknown>[]) => Record<string, unknown>[]) | undefined {
  if (!filter || filter.conditions.length === 0) return undefined;
  return (rows) =>
    rows.filter((row) => {
      const results = filter.conditions.map((c) =>
        evalFieldOp(getNestedValue(row, c.field), c.op, c.value)
      );
      return filter.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
    });
}

// ─── Row resolver ──────────────────────────────────────────────────────────────

export async function resolveRows(
  tableName: string,
  linkId: string,
  db: MspServiceDb
): Promise<Record<string, unknown>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = TABLE_MAP[tableName] as any;
  if (!table) throw new Error(`Unknown vendor table: ${tableName}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any).select().from(table).where(eq(table.linkId, linkId));

  if (tableName === 'm365Policies' || tableName === 'm365_policies') {
    return rows.map((row: Record<string, unknown>) => ({
      ...row,
      state: row.state ?? row.policyState,
      policy_state: row.policy_state ?? row.policyState
    }));
  }

  return rows;
}
