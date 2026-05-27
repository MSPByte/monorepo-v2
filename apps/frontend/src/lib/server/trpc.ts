import { appRouter } from '@mspbyte/trpc';
import { createMspDb } from '@mspbyte/drizzle';
import type { Org } from '@mspbyte/drizzle-catalog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthFn = (...args: any[]) => any;

export function createServerCaller(locals: {
  auth: AuthFn;
  org: Org;
  connectionString: string;
}) {
  const auth = locals.auth() as { userId?: string | null; orgId?: string | null };
  const db = createMspDb(locals.connectionString);
  return appRouter.createCaller({
    userId: auth.userId ?? '',
    orgId: auth.orgId ?? '',
    db,
    org: locals.org,
    connectionString: locals.connectionString,
  });
}
