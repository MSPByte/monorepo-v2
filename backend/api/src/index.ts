import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { clerkPlugin } from '@clerk/fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { appRouter, createContext } from '@mspbyte/trpc';
import { QUEUES } from '@mspbyte/shared';
import { createCatalogDb } from '@mspbyte/drizzle-catalog';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true
});

await app.register(clerkPlugin);

await app.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext: (opts: { req: Parameters<typeof createContext>[0]['req'] }) =>
      createContext({ req: opts.req, redis })
  }
});

app.get('/health', async () => {
  const catalogDb = createCatalogDb();
  let dbOk = false;
  let redisOk = false;

  try {
    await catalogDb.execute('SELECT 1' as unknown as Parameters<typeof catalogDb.execute>[0]);
    dbOk = true;
  } catch {}

  try {
    await redis.ping();
    redisOk = true;
  } catch {}

  return {
    status: dbOk && redisOk ? 'ok' : 'degraded',
    db: dbOk,
    redis: redisOk,
    timestamp: new Date().toISOString()
  };
});

// Bull Board — queue visibility UI at /admin/queues
const serverAdapter = new FastifyAdapter();
const queues = Object.values(QUEUES).map(
  (name) => new BullMQAdapter(new Queue(name, { connection: redis }))
);
createBullBoard({ queues, serverAdapter });
serverAdapter.setBasePath('/admin/queues');
await app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' });

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
