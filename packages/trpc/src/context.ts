import { verifyToken } from '@clerk/backend';
import { TRPCError } from '@trpc/server';
import { getTenantDbByClerkOrg } from '@mspbyte/drizzle-catalog';
import { createMspServiceDb } from '@mspbyte/drizzle/clients';
import type { Redis } from 'ioredis';

// Generic enough for both Fastify and other HTTP frameworks
interface IncomingRequest {
  headers: Record<string, string | string[] | undefined>;
}

export async function createContext({ req, redis }: { req: IncomingRequest; redis?: Redis }) {
  const authHeader = req.headers.authorization;
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!raw?.startsWith('Bearer ')) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing authorization header' });
  }

  const token = raw.slice(7);

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid session token' });
  }

  const userId = payload.sub;
  // Clerk JWT v1 uses a flat `org_id` claim; v2 uses a compact `o` object with `id`.
  const payloadAny = payload as Record<string, unknown>;
  const o = payloadAny.o as Record<string, unknown> | string | undefined;
  const orgId =
    (payloadAny.org_id as string | undefined) ??
    (typeof o === 'string' ? o : (o as Record<string, unknown> | undefined)?.id as string | undefined);

  if (!orgId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No organization in session' });
  }

  const result = await getTenantDbByClerkOrg(orgId).catch(() => null);
  if (!result) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Organization not provisioned — contact support'
    });
  }

  const { org } = result;
  const db = await createMspServiceDb(org.serviceConnectionString);
  return { userId, orgId, db, org, connectionString: org.serviceConnectionString, redis };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
