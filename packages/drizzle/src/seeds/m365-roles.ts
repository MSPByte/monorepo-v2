/**
 * Seed M365 directory role templates into every MSP org's m365_roles table.
 *
 * Role templateIds are universal Microsoft constants — identical across all M365
 * tenants — so this is safe to re-run and idempotent (upsert on templateId).
 *
 * Usage:
 *   bun run src/seeds/m365-roles.ts
 *
 * Required env vars:
 *   CATALOG_DATABASE_URL       — Neon catalog DB connection string
 *   MICROSOFT_TENANT_ID        — MSP's own Azure AD tenant ID (for Graph auth)
 *   MICROSOFT_CLIENT_ID        — Azure AD app client ID
 *   MICROSOFT_CLIENT_SECRET    — Azure AD app client secret
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { createMspServiceDb } from '../clients.js';
import { m365Roles } from '../db/vendors/index.js';

async function getGraphToken(): Promise<string> {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing required env vars: MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET'
    );
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );
  if (!res.ok) throw new Error(`Graph token error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

type RoleTemplate = { templateId: string; name: string; description: string | null };

async function fetchRoleTemplates(token: string): Promise<RoleTemplate[]> {
  const res = await fetch('https://graph.microsoft.com/v1.0/directoryRoleTemplates', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Graph directoryRoleTemplates error: ${res.status}`);
  const data = (await res.json()) as {
    value: Array<{ id: string; displayName: string; description?: string | null }>;
  };
  return data.value.map((r) => ({
    templateId: r.id,
    name: r.displayName,
    description: r.description ?? null,
  }));
}

async function seedOrg(serviceConnectionString: string, roles: RoleTemplate[]): Promise<number> {
  const db = await createMspServiceDb(serviceConnectionString);

  const rows = roles.map((r) => ({
    externalId: r.templateId,
    templateId: r.templateId,
    name: r.name,
    description: r.description,
  }));

  await db
    .insert(m365Roles)
    .values(rows)
    .onConflictDoUpdate({
      target: m365Roles.templateId,
      set: { name: sql`excluded.name`, description: sql`excluded.description` },
    });

  return rows.length;
}

async function main() {
  const catalogUrl = process.env.CATALOG_DATABASE_URL;
  if (!catalogUrl) throw new Error('CATALOG_DATABASE_URL is not set');

  const token = await getGraphToken();
  const roles = await fetchRoleTemplates(token);
  console.log(`Fetched ${roles.length} role templates from Graph`);

  // Raw catalog query via neon serverless — avoids circular dependency with drizzle-catalog
  const catalogSql = neon(catalogUrl);
  const orgs = await catalogSql`
    SELECT id, service_connection_string FROM orgs WHERE status = 'active'
  ` as Array<{ id: string; service_connection_string: string }>;

  console.log(`Seeding ${orgs.length} org(s)...`);
  for (const org of orgs) {
    const count = await seedOrg(org.service_connection_string, roles);
    console.log(`  org ${org.id}: upserted ${count} roles`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
