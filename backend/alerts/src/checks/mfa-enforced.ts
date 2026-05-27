import { eq, and } from 'drizzle-orm';
import { m365Identities } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from './interface.js';

// Full MFA state requires the Graph authenticationMethods endpoint.
// This check uses the mfa_enforced flag stored during normalization,
// which is derived from strongAuthenticationRequirements on the user object.
// A complete implementation should schedule a secondary fetch for
// /users/{id}/authentication/methods and update mfa_enforced accordingly.
export const mfaEnforcedCheck: CheckEvaluator = {
  checkId: 'mfa_enforced',
  definitionId: 'microsoft-365.identities.noMfa',

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const conditions = [eq(m365Identities.enabled, true), eq(m365Identities.mfaEnforced, false)];
    if (linkId) conditions.push(eq(m365Identities.linkId, linkId));

    const identities = await db
      .select()
      .from(m365Identities)
      .where(and(...conditions));

    return identities.map((identity) => ({
      checkId: 'mfa_enforced',
      definitionId: 'microsoft-365.identities.noMfa',
      linkId: linkId,
      siteId: identity.siteId ?? undefined,
      entityType: 'identity',
      entityRef: identity.email,
      entityId: identity.id,
      severity: 2,
      detail: {
        userId: identity.externalId,
        email: identity.email,
        name: identity.name
      }
    }));
  }
};
