import { z } from 'zod';
import { eq, and, ne, gt, lt, isNull, isNotNull, ilike, asc, desc, count, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  m365Identities,
  m365Groups,
  m365Policies,
  m365PolicyIdentities,
  m365PolicyGroups,
  m365PolicyRoles,
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
  m365Roles,
  m365IdentityRoles,
  m365IdentityGroups,
  sophosEndpoints,
  sophosFirewalls,
  sophosLicenses,
  sophosSiteOverview,
  m365TenantOverview,
  sophosEndpointsWithSite,
  sophosFirewallsWithSite,
  sophosLicensesWithSite,
  coveSiteOverview,
  coveEndpointsWithSite,
  dattoEndpoints,
  coveEndpoints
} from '@mspbyte/drizzle';
import { t, authProcedure } from '../trpc.js';

const VENDOR_TABLE_MAP = {
  m365_identities: m365Identities,
  m365_groups: m365Groups,
  m365_policies: m365Policies,
  m365_licenses: m365Licenses,
  m365_exchange_configs: m365ExchangeConfigs,
  m365_auth_methods: m365AuthMethods,
  m365_devices: m365Devices,
  m365_oauth_grants: m365OAuthGrants,
  m365_domain_config: m365DomainConfig,
  m365_teams_config: m365TeamsConfig,
  m365_risky_users: m365RiskyUsers,
  m365_mailbox_forwarding: m365MailboxForwarding,
  m365_inbox_rules: m365InboxRules,
  sophos_endpoints: sophosEndpoints,
  sophos_firewalls: sophosFirewalls,
  sophos_licenses: sophosLicenses,
  sophos_endpoints_with_site: sophosEndpointsWithSite,
  sophos_firewalls_with_site: sophosFirewallsWithSite,
  sophos_licenses_with_site: sophosLicensesWithSite,
  datto_endpoints: dattoEndpoints,
  cove_endpoints: coveEndpoints,
  cove_endpoints_with_site: coveEndpointsWithSite
} as const;

type VendorTableKey = keyof typeof VENDOR_TABLE_MAP;

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function normalizeColumnIdentifier(column: string): string | null {
  const normalized = camelToSnake(column);
  return /^[a-z][a-z0-9_]*$/.test(normalized) ? normalized : null;
}

function buildFilterCondition(column: string, operator: string, value: string | undefined) {
  const normalizedColumn = normalizeColumnIdentifier(column);
  if (!normalizedColumn) return null;

  const col = sql.identifier(normalizedColumn);
  switch (operator) {
    case 'eq':
      return sql`${col} = ${value ?? null}`;
    case 'neq':
      return sql`${col} != ${value ?? null}`;
    case 'contains':
      return sql`${col} ilike ${'%' + (value ?? '') + '%'}`;
    case 'gt':
      return sql`${col} > ${value ?? null}`;
    case 'lt':
      return sql`${col} < ${value ?? null}`;
    case 'is_null':
      return sql`${col} is null`;
    case 'is_not_null':
      return sql`${col} is not null`;
    default:
      return null;
  }
}

const filterSchema = z.object({
  column: z.string(),
  operator: z.enum(['eq', 'neq', 'contains', 'gt', 'lt', 'is_null', 'is_not_null']),
  value: z.string().optional()
});

export const vendorRouter = t.router({
  sophosSiteOverview: authProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(sophosSiteOverview)
      .orderBy(asc(sophosSiteOverview.dispositioned), asc(sophosSiteOverview.siteName));
  }),

  coveSiteOverview: authProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(coveSiteOverview)
      .orderBy(asc(coveSiteOverview.dispositioned), asc(coveSiteOverview.siteName));
  }),

  m365TenantOverview: authProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(m365TenantOverview)
      .orderBy(asc(m365TenantOverview.dispositioned), asc(m365TenantOverview.siteName));
  }),

  tableData: authProcedure
    .input(
      z.object({
        table: z.string(),
        linkId: z.uuid().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(1000).default(25),
        sortColumn: z.string().optional(),
        sortDirection: z.enum(['asc', 'desc']).optional(),
        filters: z.array(filterSchema).optional(),
        globalSearch: z.string().optional(),
        globalSearchColumns: z.array(z.string()).optional()
      })
    )
    .query(async ({ ctx, input }) => {
      if (!(input.table in VENDOR_TABLE_MAP)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown vendor table: ${input.table}`
        });
      }

      const table = VENDOR_TABLE_MAP[input.table as VendorTableKey] as any;
      const offset = (input.page - 1) * input.pageSize;

      // Build base filter: linkId takes priority, else siteId
      const baseConditions: ReturnType<typeof sql>[] = [];
      if (input.linkId) {
        baseConditions.push(sql`${sql.identifier('link_id')} = ${input.linkId}`);
      }

      // Apply user-supplied filters
      const userConditions: ReturnType<typeof sql>[] = [];
      for (const f of input.filters ?? []) {
        const cond = buildFilterCondition(f.column, f.operator, f.value);
        if (cond) userConditions.push(cond);
      }

      // Apply global search as OR across specified columns
      const globalSearchConditions: ReturnType<typeof sql>[] = [];
      if (input.globalSearch && input.globalSearchColumns?.length) {
        const term = '%' + input.globalSearch + '%';
        const orParts = input.globalSearchColumns
          .map(camelToSnake)
          .filter((col) => /^[a-z][a-z0-9_]*$/.test(col))
          .map((col) => sql`${sql.identifier(col)} ilike ${term}`);
        if (orParts.length > 0) {
          const orClause = orParts.reduce((acc, c) => sql`${acc} or ${c}`);
          globalSearchConditions.push(sql`(${orClause})`);
        }
      }

      const allConditions = [...baseConditions, ...userConditions, ...globalSearchConditions];
      const whereClause =
        allConditions.length > 0
          ? sql`${allConditions.reduce((acc, c, i) => (i === 0 ? c : sql`${acc} and ${c}`))}`
          : undefined;

      // Sort
      let orderClause: ReturnType<typeof sql> | undefined;
      const sortColumn = input.sortColumn ? normalizeColumnIdentifier(input.sortColumn) : null;
      if (sortColumn) {
        const colId = sql.identifier(sortColumn);
        orderClause =
          input.sortDirection === 'desc'
            ? sql`${colId} desc nulls last`
            : sql`${colId} asc nulls first`;
      } else if ('createdAt' in table) {
        orderClause = sql`${sql.identifier('created_at')} desc`;
      }

      const baseQuery = ctx.db.select().from(table).where(whereClause);
      const sortedQuery = orderClause ? baseQuery.orderBy(orderClause) : baseQuery;

      const [rows, [countRow]] = await Promise.all([
        sortedQuery.limit(input.pageSize).offset(offset),
        ctx.db.select({ count: count() }).from(table).where(whereClause)
      ]);

      const total = Number(countRow?.count ?? 0);
      const pageCount = Math.ceil(total / input.pageSize);

      return {
        rows: rows as Record<string, unknown>[],
        total,
        page: input.page,
        pageSize: input.pageSize,
        pageCount
      };
    }),

  identityDetails: authProcedure
    .input(z.object({ linkId: z.string().uuid(), identityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [
        roles,
        groups,
        directAssignments,
        groupAssignments,
        roleAssignments,
        allUsersPolicies
      ] = await Promise.all([
        ctx.db
          .select({ id: m365Roles.id, name: m365Roles.name })
          .from(m365IdentityRoles)
          .innerJoin(m365Roles, eq(m365IdentityRoles.roleId, m365Roles.id))
          .where(
            and(
              eq(m365IdentityRoles.identityId, input.identityId),
              eq(m365IdentityRoles.linkId, input.linkId)
            )
          ),
        ctx.db
          .select({ id: m365Groups.id, name: m365Groups.name })
          .from(m365IdentityGroups)
          .innerJoin(m365Groups, eq(m365IdentityGroups.groupId, m365Groups.id))
          .where(
            and(
              eq(m365IdentityGroups.identityId, input.identityId),
              eq(m365IdentityGroups.linkId, input.linkId)
            )
          ),
        ctx.db
          .select({
            id: m365Policies.id,
            name: m365Policies.name,
            policyState: m365Policies.policyState,
            included: m365PolicyIdentities.included
          })
          .from(m365PolicyIdentities)
          .innerJoin(m365Policies, eq(m365PolicyIdentities.policyId, m365Policies.id))
          .where(
            and(
              eq(m365PolicyIdentities.identityId, input.identityId),
              eq(m365PolicyIdentities.linkId, input.linkId)
            )
          ),
        ctx.db
          .select({
            id: m365Policies.id,
            name: m365Policies.name,
            policyState: m365Policies.policyState,
            included: m365PolicyGroups.included
          })
          .from(m365IdentityGroups)
          .innerJoin(
            m365PolicyGroups,
            and(
              eq(m365PolicyGroups.groupId, m365IdentityGroups.groupId),
              eq(m365PolicyGroups.linkId, m365IdentityGroups.linkId)
            )
          )
          .innerJoin(m365Policies, eq(m365PolicyGroups.policyId, m365Policies.id))
          .where(
            and(
              eq(m365IdentityGroups.identityId, input.identityId),
              eq(m365IdentityGroups.linkId, input.linkId)
            )
          ),
        ctx.db
          .select({
            id: m365Policies.id,
            name: m365Policies.name,
            policyState: m365Policies.policyState,
            included: m365PolicyRoles.included
          })
          .from(m365IdentityRoles)
          .innerJoin(
            m365PolicyRoles,
            and(
              eq(m365PolicyRoles.roleId, m365IdentityRoles.roleId),
              eq(m365PolicyRoles.linkId, m365IdentityRoles.linkId)
            )
          )
          .innerJoin(m365Policies, eq(m365PolicyRoles.policyId, m365Policies.id))
          .where(
            and(
              eq(m365IdentityRoles.identityId, input.identityId),
              eq(m365IdentityRoles.linkId, input.linkId)
            )
          ),
        ctx.db
          .select({
            id: m365Policies.id,
            name: m365Policies.name,
            policyState: m365Policies.policyState
          })
          .from(m365Policies)
          .where(
            and(
              eq(m365Policies.linkId, input.linkId),
              sql`${m365Policies.conditions} @> '{"users":{"includeUsers":["All"]}}'::jsonb`
            )
          )
      ]);

      type PolicyRow = { id: string; name: string; policyState: string; included: boolean };
      const policyMap = new Map<string, PolicyRow>();
      for (const p of allUsersPolicies) policyMap.set(p.id, { ...p, included: true });
      for (const p of roleAssignments) {
        const ex = policyMap.get(p.id);
        if (!ex || ex.included) policyMap.set(p.id, p);
      }
      for (const p of groupAssignments) {
        const ex = policyMap.get(p.id);
        if (!ex || ex.included) policyMap.set(p.id, p);
      }
      for (const p of directAssignments) policyMap.set(p.id, p);

      return { roles, groups, policies: Array.from(policyMap.values()) };
    }),

  groupMembers: authProcedure
    .input(z.object({ linkId: z.string().uuid(), groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: m365Identities.id,
          name: m365Identities.name,
          email: m365Identities.email,
          enabled: m365Identities.enabled
        })
        .from(m365IdentityGroups)
        .innerJoin(
          m365Identities,
          and(
            eq(m365IdentityGroups.identityId, m365Identities.id),
            eq(m365IdentityGroups.linkId, m365Identities.linkId)
          )
        )
        .where(
          and(
            eq(m365IdentityGroups.groupId, input.groupId),
            eq(m365IdentityGroups.linkId, input.linkId)
          )
        );
    }),

  licenseUsers: authProcedure
    .input(z.object({ linkId: z.string().uuid(), skuId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: m365Identities.id,
          name: m365Identities.name,
          email: m365Identities.email,
          enabled: m365Identities.enabled
        })
        .from(m365Identities)
        .where(
          and(
            eq(m365Identities.linkId, input.linkId),
            sql`${m365Identities.assignedLicenses} @> ARRAY[${input.skuId}]::text[]`
          )
        );
    }),

  roleAssignees: authProcedure
    .input(z.object({ linkId: z.string().uuid(), roleId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: m365Identities.id,
          name: m365Identities.name,
          email: m365Identities.email,
          enabled: m365Identities.enabled
        })
        .from(m365IdentityRoles)
        .innerJoin(m365Identities, eq(m365IdentityRoles.identityId, m365Identities.id))
        .where(
          and(
            eq(m365IdentityRoles.roleId, input.roleId),
            eq(m365IdentityRoles.linkId, input.linkId)
          )
        );
    }),

  assignedRoles: authProcedure
    .input(z.object({ linkId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: m365Roles.id,
          name: m365Roles.name,
          templateId: m365Roles.templateId,
          description: m365Roles.description,
          assigneeCount: count(m365IdentityRoles.identityId)
        })
        .from(m365Roles)
        .innerJoin(m365IdentityRoles, eq(m365IdentityRoles.roleId, m365Roles.id))
        .where(eq(m365IdentityRoles.linkId, input.linkId))
        .groupBy(m365Roles.id)
        .orderBy(m365Roles.name);

      return rows;
    }),

  policyDetails: authProcedure
    .input(z.object({ linkId: z.string().uuid(), policyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [identities, groups, roles] = await Promise.all([
        ctx.db
          .select({
            name: m365Identities.name,
            email: m365Identities.email,
            included: m365PolicyIdentities.included
          })
          .from(m365PolicyIdentities)
          .innerJoin(m365Identities, eq(m365PolicyIdentities.identityId, m365Identities.id))
          .where(
            and(
              eq(m365PolicyIdentities.policyId, input.policyId),
              eq(m365PolicyIdentities.linkId, input.linkId)
            )
          ),
        ctx.db
          .select({ name: m365Groups.name, included: m365PolicyGroups.included })
          .from(m365PolicyGroups)
          .innerJoin(m365Groups, eq(m365PolicyGroups.groupId, m365Groups.id))
          .where(
            and(
              eq(m365PolicyGroups.policyId, input.policyId),
              eq(m365PolicyGroups.linkId, input.linkId)
            )
          ),
        ctx.db
          .select({ name: m365Roles.name, included: m365PolicyRoles.included })
          .from(m365PolicyRoles)
          .innerJoin(m365Roles, eq(m365PolicyRoles.roleId, m365Roles.id))
          .where(
            and(
              eq(m365PolicyRoles.policyId, input.policyId),
              eq(m365PolicyRoles.linkId, input.linkId)
            )
          )
      ]);
      return { identities, groups, roles };
    }),

  m365TenantStats: authProcedure
    .input(z.object({ linkId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

      const [identityRows, licenseRows, policyRows] = await Promise.all([
        ctx.db
          .select({
            total: count(),
            noMfa: sql<number>`count(*) filter (where ${m365Identities.mfaEnforced} = false)`,
            stale: sql<number>`count(*) filter (where ${m365Identities.lastSignInAt} is null or ${m365Identities.lastSignInAt} < ${thirtyDaysAgo})`
          })
          .from(m365Identities)
          .where(eq(m365Identities.linkId, input.linkId)),
        ctx.db
          .select({
            skus: count(),
            unused: sql<number>`coalesce(sum(greatest(0, ${m365Licenses.totalUnits} - ${m365Licenses.consumedUnits})), 0)`
          })
          .from(m365Licenses)
          .where(eq(m365Licenses.linkId, input.linkId)),
        ctx.db
          .select({
            total: count(),
            enabled: sql<number>`count(*) filter (where ${m365Policies.policyState} in ('enabled', 'enabledForReportingButNotEnforced'))`
          })
          .from(m365Policies)
          .where(eq(m365Policies.linkId, input.linkId))
      ]);

      const id = identityRows[0] ?? { total: 0, noMfa: 0, stale: 0 };
      const lic = licenseRows[0] ?? { skus: 0, unused: 0 };
      const pol = policyRows[0] ?? { total: 0, enabled: 0 };

      return {
        identities: { total: Number(id.total), noMfa: Number(id.noMfa), stale: Number(id.stale) },
        licenses: { skus: Number(lic.skus), unused: Number(lic.unused) },
        policies: { total: Number(pol.total), enabled: Number(pol.enabled) }
      };
    })
});
