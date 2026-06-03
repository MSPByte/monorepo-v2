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
 *   ENCRYPTION_KEY
 *   CATALOG_DATABASE_URL       — Neon catalog DB connection string
 *   MICROSOFT_TENANT_ID        — MSP's own Azure AD tenant ID (for Graph auth)
 *   MICROSOFT_CLIENT_ID        — Azure AD app client ID
 *   MICROSOFT_CLIENT_SECRET    — Azure AD app client secret
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { m365Roles } from '@mspbyte/drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

function decrypt(encryptedText: string, key: string): string | undefined {
  const [ivB64, tagB64, dataB64] = encryptedText.split(':');
  if (!ivB64 || !tagB64 || !dataB64) return undefined;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

async function getGraphToken(): Promise<string> {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing required env vars: MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET'
    );
  }

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default'
    })
  });
  if (!res.ok) throw new Error(`Graph token error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

type RoleTemplate = { templateId: string; name: string; description: string | null };

async function fetchRoleTemplates(token: string): Promise<RoleTemplate[]> {
  const res = await fetch('https://graph.microsoft.com/v1.0/directoryRoleTemplates', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Graph directoryRoleTemplates error: ${res.status}`);
  const data = (await res.json()) as {
    value: Array<{ id: string; displayName: string; description?: string | null }>;
  };
  return data.value.map((r) => ({
    templateId: r.id,
    name: r.displayName,
    description: r.description ?? null
  }));
}

async function seedOrg(serviceConnectionString: string, roles: RoleTemplate[]): Promise<number> {
  const client = postgres(serviceConnectionString);
  const db = drizzle({ client });

  const rows = roles.map((r) => ({
    externalId: r.templateId,
    templateId: r.templateId,
    name: r.name,
    description: r.description
  }));

  await db
    .insert(m365Roles)
    .values(rows)
    .onConflictDoUpdate({
      target: m365Roles.templateId,
      set: { name: sql`excluded.name`, description: sql`excluded.description` }
    });

  return rows.length;
}

async function main() {
  const catalogUrl = process.env.CATALOG_DATABASE_URL;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!catalogUrl || !encryptionKey)
    throw new Error('CATALOG_DATABASE_URL or ENCRYPTION_KEY is not set');

  const token = await getGraphToken();
  const roles = await fetchRoleTemplates(token);
  console.log(`Fetched ${roles.length} role templates from Graph`);

  const catalogSql = neon(catalogUrl);
  const orgs = (await catalogSql`
    SELECT id, service_connection_string FROM organization WHERE status = 'active'
  `) as Array<{ id: string; service_connection_string: string }>;

  console.log(`Seeding ${orgs.length} org(s)...`);
  for (const org of orgs) {
    const count = await seedOrg(decrypt(org.service_connection_string, encryptionKey) ?? '', roles);
    console.log(`  org ${org.id}: upserted ${count} roles`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
