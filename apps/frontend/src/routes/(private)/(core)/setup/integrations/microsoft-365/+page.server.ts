import { MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, ENCRYPTION_KEY } from '$env/static/private';
import { PUBLIC_ORIGIN } from '$env/static/public';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { createServerCaller } from '$lib/server/trpc';
import { M365Connector, TenantCapabilityService, Encryption } from '@mspbyte/shared';
import type { Actions } from './$types';

const M365ConfigSchema = z.object({
  tenantId: z.string(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

export const actions: Actions = {
  initialConsent: ({ locals }) => {
    if (!MICROSOFT_CLIENT_ID || !PUBLIC_ORIGIN) {
      return fail(500, { error: 'MICROSOFT_CLIENT_ID and PUBLIC_ORIGIN env vars are required' });
    }

    const consentUrl = new URL('https://login.microsoftonline.com/common/adminconsent');
    consentUrl.searchParams.set('client_id', MICROSOFT_CLIENT_ID);
    consentUrl.searchParams.set('redirect_uri', `${PUBLIC_ORIGIN}/setup/integrations/microsoft-365/consent`);
    consentUrl.searchParams.set('state', JSON.stringify({ orgId: locals.org?.id }));

    return redirect(303, consentUrl.href);
  },

  gdapConsent: async ({ request }) => {
    const formData = await request.formData();
    const gdapTenantId = formData.get('gdapTenantId');
    if (!gdapTenantId || typeof gdapTenantId !== 'string') {
      return fail(400, { error: 'gdapTenantId is required' });
    }

    if (!MICROSOFT_CLIENT_ID || !PUBLIC_ORIGIN) {
      return fail(500, { error: 'MICROSOFT_CLIENT_ID and PUBLIC_ORIGIN env vars are required' });
    }

    const consentUrl = new URL(`https://login.microsoftonline.com/${gdapTenantId}/adminconsent`);
    consentUrl.searchParams.set('client_id', MICROSOFT_CLIENT_ID);
    consentUrl.searchParams.set('redirect_uri', `${PUBLIC_ORIGIN}/setup/integrations/microsoft-365/consent`);
    consentUrl.searchParams.set('state', JSON.stringify({ gdapTenantId }));

    return redirect(303, consentUrl.href);
  },

  deleteIntegration: async ({ locals }) => {
    try {
      const caller = createServerCaller(locals);
      await caller.integrations.delete({ id: 'microsoft-365' });
    } catch (err) {
      return fail(500, { error: String(err) });
    }
    return redirect(303, '/setup/integrations/microsoft-365');
  },

  gdapSync: async ({ locals }) => {
    const caller = createServerCaller(locals);

    const integration = await caller.integrations.get({ id: 'microsoft-365' });
    if (!integration || integration.deletedAt) {
      return fail(400, { error: 'Microsoft 365 integration not configured' });
    }

    const configResult = M365ConfigSchema.safeParse(integration.config);
    if (!configResult.success) {
      return fail(400, { error: 'Invalid integration configuration' });
    }
    const config = configResult.data;
    const mspTenantId = config.tenantId;

    const clientId = config.clientId ?? MICROSOFT_CLIENT_ID;
    const rawSecret = config.clientSecret
      ? (Encryption.decrypt(config.clientSecret, ENCRYPTION_KEY) ?? MICROSOFT_CLIENT_SECRET)
      : MICROSOFT_CLIENT_SECRET;

    const connector = new M365Connector(clientId, rawSecret, mspTenantId);

    let relationships;
    try {
      relationships = await connector.tenantRelationships.delegatedAdminRelationships.listAll();
    } catch {
      return fail(502, { error: 'Failed to list GDAP relationships from Microsoft' });
    }

    const activeCustomers = relationships.filter(
      (r) => r.status === 'Active' && r.customer?.tenantId
    );

    let mspDisplayName: string | null = null;
    try {
      const org = await connector.organization.get();
      mspDisplayName = org.displayName || null;
    } catch { /* non-fatal */ }

    const existingLinks = await caller.integrationLinks.list({ integrationId: 'microsoft-365' });
    const tenantLinks = existingLinks.filter((l) => !l.siteId);
    const dbExternalIds = new Set(tenantLinks.map((l) => l.externalId));
    const gdapTenantIds = new Set(activeCustomers.map((r) => r.customer!.tenantId));

    const toInsert = activeCustomers.filter((r) => !dbExternalIds.has(r.customer!.tenantId));
    const toDelete = tenantLinks.filter(
      (l) => l.externalId && !gdapTenantIds.has(l.externalId) && l.externalId !== mspTenantId
    );

    let inserted = 0;
    for (const r of toInsert) {
      try {
        await caller.integrationLinks.create({
          integrationId: 'microsoft-365',
          externalId: r.customer!.tenantId,
          name: r.customer!.displayName ?? r.customer!.tenantId,
          status: 'disabled',
        });
        inserted++;
      } catch { /* log and continue */ }
    }

    // Ensure MSP's own tenant is linked as active
    if (!dbExternalIds.has(mspTenantId)) {
      try {
        await caller.integrationLinks.create({
          integrationId: 'microsoft-365',
          externalId: mspTenantId,
          name: mspDisplayName ?? mspTenantId,
          status: 'active',
        });
        inserted++;
      } catch { /* log and continue */ }
    }

    let removed = 0;
    if (toDelete.length > 0) {
      try {
        await caller.integrationLinks.delete({ ids: toDelete.map((l) => l.id) });
        removed = toDelete.length;
      } catch { /* log and continue */ }
    }

    return { success: true, inserted, removed };
  },

  refreshCapabilities: async ({ request, locals }) => {
    const formData = await request.formData();
    const externalId = formData.get('externalId');
    const linkId = formData.get('linkId');

    if (!externalId || typeof externalId !== 'string') return fail(400, { error: 'externalId is required' });
    if (!linkId || typeof linkId !== 'string') return fail(400, { error: 'linkId is required' });

    const caller = createServerCaller(locals);
    const integration = await caller.integrations.get({ id: 'microsoft-365' });
    if (!integration || integration.deletedAt) {
      return fail(400, { error: 'Microsoft 365 integration not configured' });
    }

    const configResult = M365ConfigSchema.safeParse(integration.config);
    if (!configResult.success) return fail(400, { error: 'Invalid integration configuration' });
    const config = configResult.data;

    const clientId = config.clientId ?? MICROSOFT_CLIENT_ID;
    const rawSecret = config.clientSecret
      ? (Encryption.decrypt(config.clientSecret, ENCRYPTION_KEY) ?? MICROSOFT_CLIENT_SECRET)
      : MICROSOFT_CLIENT_SECRET;

    // Scoped to GDAP tenant
    const connector = new M365Connector(clientId, rawSecret, externalId);

    let capabilities: Record<string, boolean>;
    try {
      capabilities = await new TenantCapabilityService(connector).probe();
    } catch {
      return fail(502, { error: 'Could not probe capabilities — check GDAP permissions' });
    }

    const links = await caller.integrationLinks.list({ integrationId: 'microsoft-365' });
    const link = links.find((l) => l.id === linkId);
    const existingMeta = (link?.meta as Record<string, unknown>) ?? {};

    try {
      await caller.integrationLinks.update({
        id: linkId,
        meta: { ...existingMeta, capabilities, capabilitiesCheckedAt: new Date().toISOString() },
      });
    } catch (err) {
      return fail(500, { error: String(err) });
    }

    return { success: true };
  },
};
