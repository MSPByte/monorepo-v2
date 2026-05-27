import type { FastifyInstance } from 'fastify';

// TODO: v2 — remove before production; these are diagnostic stubs only
export function debugRoutes(fastify: FastifyInstance) {
  fastify.get('/api/debug/memory', async (_req, reply) => {
    const mem = process.memoryUsage();
    return reply.status(200).send({ rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal });
  });

  fastify.get('/api/debug/uptime', async (_req, reply) => {
    return reply.status(200).send({ uptimeSeconds: process.uptime() });
  });
}
