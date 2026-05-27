import type { FastifyInstance } from 'fastify';

// TODO: file hosting v2 — serve from blob storage when ready
export function downloadsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/downloads/macos/*', async (_req, reply) => {
    return reply.status(404).send({ error: 'File hosting not yet available in v2' });
  });
}
