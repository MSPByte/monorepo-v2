import { eq, and, lt } from 'drizzle-orm';
import { m365Identities } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from './interface.js';

const STALE_DAYS = 30;

export const staleIdentityCheck: CheckEvaluator = {
  checkId: 'stale_identity',
  definitionId: 'microsoft-365.identities.stale',
  sourceTables: ['m365_identities'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Identities that have never signed in OR whose last sign-in is before cutoff
    const filters = [eq(m365Identities.enabled, true), lt(m365Identities.lastSignInAt, cutoff)];
    if (linkId) filters.push(eq(m365Identities.linkId, linkId));

    const identities = await db
      .select()
      .from(m365Identities)
      .where(and(...filters));

    return identities.map((identity) => ({
      checkId: 'stale_identity',
      definitionId: 'microsoft-365.identities.stale',
      linkId,
      siteId: identity.siteId ?? undefined,
      entityType: 'identity',
      entityRef: identity.email,
      entityId: identity.id,
      severity: 1,
      detail: {
        userId: identity.externalId,
        email: identity.email,
        name: identity.name,
        lastSignInAt: identity.lastSignInAt,
        lastNonInteractiveSignInAt: identity.lastNonInteractiveSignInAt
      }
    }));
  }
};
