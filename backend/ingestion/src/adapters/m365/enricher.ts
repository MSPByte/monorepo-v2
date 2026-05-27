import { z } from 'zod';
import {
  m365Identities,
  m365Policies,
  m365IdentityGroups,
  m365IdentityRoles,
  m365Groups,
  m365Roles,
} from '@mspbyte/drizzle';
import { getTenantServiceDb } from '@mspbyte/drizzle-catalog';
import { eq, inArray, and } from 'drizzle-orm';
import { logger } from '../../logger.js';

const CAPolicyGrantControlsSchema = z
  .object({ builtInControls: z.array(z.string()).optional().nullable() })
  .passthrough()
  .optional()
  .nullable();

const CAPolicyConditionsSchema = z
  .object({
    users: z
      .object({
        includeUsers: z.array(z.string()).optional().default([]),
        excludeUsers: z.array(z.string()).optional().default([]),
        includeGroups: z.array(z.string()).optional().default([]),
        excludeGroups: z.array(z.string()).optional().default([]),
        includeRoles: z.array(z.string()).optional().default([]),
        excludeRoles: z.array(z.string()).optional().default([]),
      })
      .passthrough()
      .optional()
      .nullable(),
    applications: z
      .object({
        includeApplications: z.array(z.string()).optional().default([]),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

export async function enrichM365(linkId: string, orgId: string): Promise<void> {
  const { db } = await getTenantServiceDb(orgId);

  const [policyDocs, identityDocs] = await Promise.all([
    db
      .select({ id: m365Policies.id, conditions: m365Policies.conditions, grantControls: m365Policies.grantControls })
      .from(m365Policies)
      .where(and(eq(m365Policies.linkId, linkId), eq(m365Policies.policyState, 'enabled'))),
    db
      .select({ id: m365Identities.id, externalId: m365Identities.externalId })
      .from(m365Identities)
      .where(eq(m365Identities.linkId, linkId)),
  ]);

  const mfaPolicies = policyDocs
    .filter((p) => {
      const gc = CAPolicyGrantControlsSchema.safeParse(p.grantControls);
      if (!gc.success || !gc.data?.builtInControls?.includes('mfa')) return false;
      const cond = CAPolicyConditionsSchema.safeParse(p.conditions);
      return cond.data?.applications?.includeApplications?.includes('All') ?? false;
    })
    .map((p) => CAPolicyConditionsSchema.parse(p.conditions));

  const CHUNK = 1000;

  if (mfaPolicies.length === 0 || identityDocs.length === 0) {
    logger.info({ linkId }, 'Enrich M365: no qualifying MFA policies');
    const ids = identityDocs.map((i) => i.id);
    for (let i = 0; i < ids.length; i += CHUNK) {
      await db
        .update(m365Identities)
        .set({ mfaEnforced: false })
        .where(inArray(m365Identities.id, ids.slice(i, i + CHUNK)));
    }
    return;
  }

  const [igRows, irRows] = await Promise.all([
    db
      .select({ identityId: m365IdentityGroups.identityId, groupExternalId: m365Groups.externalId })
      .from(m365IdentityGroups)
      .innerJoin(m365Groups, eq(m365IdentityGroups.groupId, m365Groups.id))
      .where(eq(m365IdentityGroups.linkId, linkId)),
    db
      .select({ identityId: m365IdentityRoles.identityId, roleTemplateId: m365Roles.templateId })
      .from(m365IdentityRoles)
      .innerJoin(m365Roles, eq(m365IdentityRoles.roleId, m365Roles.id))
      .where(eq(m365IdentityRoles.linkId, linkId)),
  ]);

  const identityGroupExtIds = new Map<string, Set<string>>();
  for (const row of igRows) {
    if (!identityGroupExtIds.has(row.identityId)) identityGroupExtIds.set(row.identityId, new Set());
    identityGroupExtIds.get(row.identityId)!.add(row.groupExternalId);
  }

  const identityRoleTemplateIds = new Map<string, Set<string>>();
  for (const row of irRows) {
    if (!identityRoleTemplateIds.has(row.identityId)) identityRoleTemplateIds.set(row.identityId, new Set());
    identityRoleTemplateIds.get(row.identityId)!.add(row.roleTemplateId);
  }

  const trueIds: string[] = [];
  const falseIds: string[] = [];

  for (const identity of identityDocs) {
    const groupExtIds = identityGroupExtIds.get(identity.id) ?? new Set<string>();
    const roleTemplateIds = identityRoleTemplateIds.get(identity.id) ?? new Set<string>();

    let mfaEnforced = false;
    for (const cond of mfaPolicies) {
      const u = cond?.users;
      if (!u) continue;

      const included =
        (u.includeUsers ?? []).includes('All') ||
        (u.includeUsers ?? []).includes(identity.externalId) ||
        (u.includeGroups ?? []).some((g) => groupExtIds.has(g)) ||
        (u.includeRoles ?? []).some((r) => roleTemplateIds.has(r));

      const excluded =
        (u.excludeUsers ?? []).includes(identity.externalId) ||
        (u.excludeGroups ?? []).some((g) => groupExtIds.has(g)) ||
        (u.excludeRoles ?? []).some((r) => roleTemplateIds.has(r));

      if (included && !excluded) {
        mfaEnforced = true;
        break;
      }
    }

    (mfaEnforced ? trueIds : falseIds).push(identity.id);
  }

  await Promise.all([
    ...Array.from({ length: Math.ceil(trueIds.length / CHUNK) }, (_, i) =>
      db
        .update(m365Identities)
        .set({ mfaEnforced: true })
        .where(inArray(m365Identities.id, trueIds.slice(i * CHUNK, (i + 1) * CHUNK)))
    ),
    ...Array.from({ length: Math.ceil(falseIds.length / CHUNK) }, (_, i) =>
      db
        .update(m365Identities)
        .set({ mfaEnforced: false })
        .where(inArray(m365Identities.id, falseIds.slice(i * CHUNK, (i + 1) * CHUNK)))
    ),
  ]);

  logger.info(
    { linkId, total: identityDocs.length, mfaEnforced: trueIds.length },
    'M365 identity enrichment complete'
  );
}
