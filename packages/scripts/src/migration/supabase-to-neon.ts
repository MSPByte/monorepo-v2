/**
 * Migrate sites, agents, and agent_tickets from Supabase to Neon.
 *
 * Usage:
 *   bun run src/migration/supabase-to-neon.ts
 *
 * Required env vars:
 *   SUPABASE_DATABASE_URL  — Supabase Postgres connection string (source)
 *   NEON_DATABASE_URL      — Neon org database connection string (target)
 *   SUPABASE_TENANT_ID     — tenant UUID whose data to migrate
 */

import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sites, agents, agentTickets } from '@mspbyte/drizzle';

type SupabaseSite = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type SupabaseAgent = {
  id: string;
  site_id: string;
  hostname: string;
  ip_address: string | null;
  ext_address: string | null;
  mac_address: string | null;
  platform: string;
  version: string;
  registered_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SupabaseTicket = {
  id: string;
  agent_id: string;
  site_id: string;
  ticket_id: string;
  summary: string | null;
  meta: unknown;
  created_at: string;
};

const BATCH_SIZE = 500;

async function main() {
  const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
  const neonUrl = process.env.NEON_DATABASE_URL;
  const tenantId = process.env.SUPABASE_TENANT_ID;

  if (!supabaseUrl || !neonUrl || !tenantId) {
    throw new Error('Missing required env: SUPABASE_DATABASE_URL, NEON_DATABASE_URL, SUPABASE_TENANT_ID');
  }

  const source = postgres(supabaseUrl);
  const target = postgres(neonUrl);
  const db = drizzle({ client: target });

  // --- Sites ---
  const siteRows = await source<SupabaseSite[]>`
    SELECT id, name, created_at, updated_at
    FROM sites
    WHERE tenant_id = ${tenantId}
  `;
  console.log(`Found ${siteRows.length} sites`);

  for (let i = 0; i < siteRows.length; i += BATCH_SIZE) {
    const batch = siteRows.slice(i, i + BATCH_SIZE);
    await db.insert(sites).values(
      batch.map((s) => ({
        id: s.id,
        name: s.name,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }))
    ).onConflictDoNothing();
    console.log(`  Inserted sites ${i + 1}–${Math.min(i + BATCH_SIZE, siteRows.length)}`);
  }

  // --- Agents ---
  const agentRows = await source<SupabaseAgent[]>`
    SELECT id, site_id, hostname, ip_address, ext_address, mac_address,
           platform, version, registered_at, created_at, updated_at, deleted_at
    FROM agents
    WHERE tenant_id = ${tenantId}
  `;
  console.log(`Found ${agentRows.length} agents`);

  for (let i = 0; i < agentRows.length; i += BATCH_SIZE) {
    const batch = agentRows.slice(i, i + BATCH_SIZE);
    await db.insert(agents).values(
      batch.map((a) => ({
        id: a.id,
        siteId: a.site_id,
        hostname: a.hostname,
        ipAddress: a.ip_address,
        extAddress: a.ext_address,
        macAddress: a.mac_address,
        platform: a.platform,
        version: a.version,
        registeredAt: a.registered_at,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        deletedAt: a.deleted_at
      }))
    ).onConflictDoNothing();
    console.log(`  Inserted agents ${i + 1}–${Math.min(i + BATCH_SIZE, agentRows.length)}`);
  }

  // --- Agent Tickets ---
  const ticketRows = await source<SupabaseTicket[]>`
    SELECT id, agent_id, site_id, ticket_id, summary, meta, created_at
    FROM agent_tickets
    WHERE tenant_id = ${tenantId}
  `;
  console.log(`Found ${ticketRows.length} agent tickets`);

  for (let i = 0; i < ticketRows.length; i += BATCH_SIZE) {
    const batch = ticketRows.slice(i, i + BATCH_SIZE);
    await db.insert(agentTickets).values(
      batch.map((t) => ({
        id: t.id,
        agentId: t.agent_id,
        siteId: t.site_id,
        ticketId: t.ticket_id,
        summary: t.summary,
        meta: t.meta,
        createdAt: t.created_at
      }))
    ).onConflictDoNothing();
    console.log(`  Inserted tickets ${i + 1}–${Math.min(i + BATCH_SIZE, ticketRows.length)}`);
  }

  console.log('Migration complete.');
  await source.end();
  await target.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
