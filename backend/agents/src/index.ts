import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './env.js';
import { logger } from './logger.js';
import { registerRoute } from './routes/register.js';
import { ticketRoute } from './routes/ticket.js';
import { debugRoutes } from './routes/debug.js';
import { downloadsRoutes } from './routes/downloads.js';

const fastify = Fastify({ logger: false });

await fastify.register(cors, { origin: true, credentials: true });
await fastify.register(multipart);

// Bearer token auth hook for agent endpoints
fastify.addHook('onRequest', async (req, reply) => {
  const path = req.url;

  // Debug and health routes don't require auth
  if (path.startsWith('/debug')) return;
  if (path === '/health') return;

  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // TODO: Add agent authentication
  // if (!token || token !== env.AGENT_API_SECRET) {
  //   return reply.status(401).send({ error: 'Unauthorized' });
  // }
});

fastify.get('/health', async () => ({ status: 'ok' }));

registerRoute(fastify);
ticketRoute(fastify);
debugRoutes(fastify);
downloadsRoutes(fastify);

await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
logger.info({ port: env.PORT }, 'Agents server started');

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  await fastify.close();
  process.exit(0);
});
