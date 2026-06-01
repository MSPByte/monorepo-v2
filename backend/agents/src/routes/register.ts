import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { agents, agentLogs, sites } from '@mspbyte/drizzle';
import { getTenantServiceDbByOrgId } from '@mspbyte/drizzle-catalog';
import { logger } from '../logger.js';
import { env } from '../env.js';
import type { FastifyInstance } from 'fastify';

const BodySchema = z.object({
  site_id: z.uuid(),
  hostname: z.string(),
  version: z.string(),
  platform: z.string(),
  device_id: z.uuid().optional().nullable(),
  mac: z.string().optional().nullable(),
  ip_address: z.string().optional().nullable(),
  ext_address: z.string().optional().nullable()
});

export function registerRoute(fastify: FastifyInstance) {
  fastify.post('/v1.0/register', async (req, reply) => {
    const body = BodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { module: 'v1.0/register', context: 'POST', message: 'Invalid request body' }
      });
    }

    const { site_id, hostname, version, platform, device_id, mac, ip_address, ext_address } =
      body.data;

    let db: Awaited<ReturnType<typeof getTenantServiceDbByOrgId>>['db'];
    try {
      ({ db } = await getTenantServiceDbByOrgId(env.ORG_ID, env.ENCRYPTION_KEY));
    } catch {
      return reply
        .status(404)
        .send({ error: { module: 'v1.0/register', context: 'POST', message: 'Org not found' } });
    }

    // Verify site exists in this org's MSP DB
    const [site] = await db.select().from(sites).where(eq(sites.id, site_id)).limit(1);
    if (!site) {
      return reply
        .status(404)
        .send({ error: { module: 'v1.0/register', context: 'POST', message: 'Site not found' } });
    }

    const now = new Date().toISOString();

    let agentId: string;

    if (device_id) {
      // Update existing agent
      const [existing] = await db.select().from(agents).where(eq(agents.id, device_id)).limit(1);
      if (existing) {
        await db
          .update(agents)
          .set({
            hostname,
            version,
            platform,
            ipAddress: ip_address ?? null,
            extAddress: ext_address ?? null,
            macAddress: mac ?? null,
            updatedAt: now
          })
          .where(eq(agents.id, device_id));
        agentId = device_id;
        logger.info({ agentId, hostname, siteId: site_id }, 'Agent updated');
      } else {
        const [created] = await db
          .insert(agents)
          .values({
            siteId: site_id,
            hostname,
            version,
            platform,
            ipAddress: ip_address ?? null,
            extAddress: ext_address ?? null,
            macAddress: mac ?? null,
            registeredAt: now
          })
          .returning({ id: agents.id });
        agentId = created.id;
        logger.info({ agentId, hostname, siteId: site_id }, 'Agent created (device_id not found)');
      }
    } else {
      const [created] = await db
        .insert(agents)
        .values({
          siteId: site_id,
          hostname,
          version,
          platform,
          ipAddress: ip_address ?? null,
          extAddress: ext_address ?? null,
          macAddress: mac ?? null,
          registeredAt: now
        })
        .returning({ id: agents.id });
      agentId = created.id;
      logger.info({ agentId, hostname, siteId: site_id }, 'Agent registered');
    }

    await db.insert(agentLogs).values({
      agentId,
      siteId: site_id,
      method: 'POST',
      message: `Agent registered: ${hostname} v${version} (${platform})`,
      status: 200,
      timeElapsedMs: 0
    });

    return reply.status(200).send({ data: { device_id: agentId, guid: agentId } });
  });
}
