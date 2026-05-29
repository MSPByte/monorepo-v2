import { z } from 'zod';
import {
  m365Identities,
  m365Groups,
  m365Roles,
  m365Policies,
  m365IdentityGroups,
  m365IdentityRoles,
  m365PolicyIdentities,
  m365PolicyGroups,
  m365PolicyRoles
} from '@mspbyte/drizzle';
import { getTenantServiceDb } from '@mspbyte/drizzle-catalog';
import { M365Connector } from '@mspbyte/shared';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../../logger.js';
import { env } from '../../env.js';

// ─── CA policy conditions schema ─────────────────────────────────────────────

const CAPolicyUsersSchema = z.looseObject({
  includeUsers: z.array(z.string()).optional().default([]),
  excludeUsers: z.array(z.string()).optional().default([]),
  includeGroups: z.array(z.string()).optional().default([]),
  excludeGroups: z.array(z.string()).optional().default([]),
  includeRoles: z.array(z.string()).optional().default([]),
  excludeRoles: z.array(z.string()).optional().default([])
});

const CAPolicyConditionsSchema = z.looseObject({ users: CAPolicyUsersSchema.optional() });

// ─── M365 link logic ──────────────────────────────────────────────────────────

export async function linkM365(
  linkId: string,
  linkMeta: Record<string, unknown>,
  orgId: string
): Promise<void> {
  const gdapTenantId = typeof linkMeta.externalId === 'string' ? linkMeta.externalId : '';
  if (!gdapTenantId) {
    logger.warn({ linkId }, 'M365 linker: missing gdapTenantId in linkMeta — skipping');
    return;
  }

  const clientId = env.MICROSOFT_CLIENT_ID;
  const clientSecret = env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('M365 credentials not configured'), { failParent: true });
  }

  const connector = new M365Connector(clientId, clientSecret, gdapTenantId);
  const { db } = await getTenantServiceDb(orgId, env.ENCRYPTION_KEY);
  const now = new Date();

  const FETCH_CONCURRENCY = 5;

  // ── Identity ↔ Groups ─────────────────────────────────────────────────────

  const [identityDocs, groupDocs] = await Promise.all([
    db
      .select({ id: m365Identities.id, externalId: m365Identities.externalId })
      .from(m365Identities)
      .where(eq(m365Identities.linkId, linkId)),
    db
      .select({ id: m365Groups.id, externalId: m365Groups.externalId })
      .from(m365Groups)
      .where(eq(m365Groups.linkId, linkId))
  ]);

  const identityByExternalId = new Map(identityDocs.map((i) => [i.externalId, i.id]));

  const igRows: (typeof m365IdentityGroups.$inferInsert)[] = [];

  for (let i = 0; i < groupDocs.length; i += FETCH_CONCURRENCY) {
    const chunk = groupDocs.slice(i, i + FETCH_CONCURRENCY);
    await Promise.all(
      chunk.map(async (group) => {
        let members: Array<{ id?: string }>;
        try {
          members = await connector.groups.members(group.externalId);
        } catch {
          logger.warn({ linkId, groupId: group.externalId }, 'Failed to get group members');
          return;
        }
        for (const m of members) {
          const identityId = identityByExternalId.get(m.id ?? '');
          if (!identityId) continue;
          igRows.push({ identityId, groupId: group.id, linkId, lastSeenAt: now, createdAt: now });
        }
      })
    );
  }

  await db.delete(m365IdentityGroups).where(eq(m365IdentityGroups.linkId, linkId));
  if (igRows.length > 0) await db.insert(m365IdentityGroups).values(igRows);
  logger.info({ linkId, count: igRows.length }, 'M365 identity groups linked');

  // ── Identity ↔ Roles ──────────────────────────────────────────────────────

  const roleDocs = await db
    .select({ id: m365Roles.id, templateId: m365Roles.templateId })
    .from(m365Roles);

  const irRows: (typeof m365IdentityRoles.$inferInsert)[] = [];

  for (let i = 0; i < roleDocs.length; i += FETCH_CONCURRENCY) {
    const chunk = roleDocs.slice(i, i + FETCH_CONCURRENCY);
    await Promise.all(
      chunk.map(async (role) => {
        // 404 (role not activated in tenant) is handled by the connector — returns []
        const members = await connector.directoryRoles.members(role.templateId);
        for (const m of members) {
          const identityId = identityByExternalId.get(m.id ?? '');
          if (!identityId) continue;
          irRows.push({ identityId, roleId: role.id, linkId, lastSeenAt: now, createdAt: now });
        }
      })
    );
  }

  await db.delete(m365IdentityRoles).where(eq(m365IdentityRoles.linkId, linkId));
  if (irRows.length > 0) await db.insert(m365IdentityRoles).values(irRows);
  logger.info({ linkId, count: irRows.length }, 'M365 identity roles linked');

  // ── Policy ↔ Identities / Groups / Roles ─────────────────────────────────

  const policyDocs = await db
    .select({ id: m365Policies.id, conditions: m365Policies.conditions })
    .from(m365Policies)
    .where(eq(m365Policies.linkId, linkId));

  const piRows: (typeof m365PolicyIdentities.$inferInsert)[] = [];
  const pgRows: (typeof m365PolicyGroups.$inferInsert)[] = [];
  const prRows: (typeof m365PolicyRoles.$inferInsert)[] = [];

  const groupByExternalId = new Map(groupDocs.map((g) => [g.externalId, g.id]));
  const roleByTemplateId = new Map(roleDocs.map((r) => [r.templateId, r.id]));

  for (const policy of policyDocs) {
    const condParsed = CAPolicyConditionsSchema.safeParse(policy.conditions);
    const users = condParsed.data?.users;
    if (!users) continue;

    for (const uid of users.includeUsers) {
      if (uid === 'All') continue;
      const identityId = identityByExternalId.get(uid);
      if (!identityId) continue;
      piRows.push({
        policyId: policy.id,
        identityId,
        linkId,
        included: true,
        lastSeenAt: now,
        createdAt: now
      });
    }
    for (const uid of users.excludeUsers) {
      const identityId = identityByExternalId.get(uid);
      if (!identityId) continue;
      piRows.push({
        policyId: policy.id,
        identityId,
        linkId,
        included: false,
        lastSeenAt: now,
        createdAt: now
      });
    }
    for (const gid of users.includeGroups) {
      const groupId = groupByExternalId.get(gid);
      if (!groupId) continue;
      pgRows.push({
        policyId: policy.id,
        groupId,
        linkId,
        included: true,
        lastSeenAt: now,
        createdAt: now
      });
    }
    for (const gid of users.excludeGroups) {
      const groupId = groupByExternalId.get(gid);
      if (!groupId) continue;
      pgRows.push({
        policyId: policy.id,
        groupId,
        linkId,
        included: false,
        lastSeenAt: now,
        createdAt: now
      });
    }
    for (const rid of users.includeRoles) {
      const roleId = roleByTemplateId.get(rid);
      if (!roleId) continue;
      prRows.push({
        policyId: policy.id,
        roleId,
        linkId,
        included: true,
        lastSeenAt: now,
        createdAt: now
      });
    }
    for (const rid of users.excludeRoles) {
      const roleId = roleByTemplateId.get(rid);
      if (!roleId) continue;
      prRows.push({
        policyId: policy.id,
        roleId,
        linkId,
        included: false,
        lastSeenAt: now,
        createdAt: now
      });
    }
  }

  const policyIds = policyDocs.map((p) => p.id);
  if (policyIds.length > 0) {
    await Promise.all([
      db.delete(m365PolicyIdentities).where(inArray(m365PolicyIdentities.policyId, policyIds)),
      db.delete(m365PolicyGroups).where(inArray(m365PolicyGroups.policyId, policyIds)),
      db.delete(m365PolicyRoles).where(inArray(m365PolicyRoles.policyId, policyIds))
    ]);
  }

  await Promise.all([
    piRows.length > 0 ? db.insert(m365PolicyIdentities).values(piRows) : Promise.resolve(),
    pgRows.length > 0 ? db.insert(m365PolicyGroups).values(pgRows) : Promise.resolve(),
    prRows.length > 0 ? db.insert(m365PolicyRoles).values(prRows) : Promise.resolve()
  ]);

  logger.info(
    { linkId, identities: piRows.length, groups: pgRows.length, roles: prRows.length },
    'M365 policy links upserted'
  );
}
