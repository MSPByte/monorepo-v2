import { appRouter } from '@mspbyte/trpc';
import { createMspDb } from '@mspbyte/drizzle';
import type { Org } from '@mspbyte/drizzle-catalog';
import type { db } from '$lib/db';

export function createServerCaller(locals: {
  auth: {
    userId: string;
    orgId: string;
    authOrgId: string;
    email: string;
  };
  org: Org;
  user?: db.User;
  role?: db.Role;
  connectionString: string;
}) {
  const db = createMspDb(locals.connectionString);
  return appRouter.createCaller({
    userId: locals.auth.userId,
    orgId: locals.auth.orgId,
    authOrgId: locals.auth.authOrgId,
    db: db as never,
    org: locals.org,
    user: locals.user as never,
    role: locals.role as never,
    connectionString: locals.connectionString,
    redis: undefined,
  });
}
