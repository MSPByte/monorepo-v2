import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';

export function createMspDb(connectionString: string) {
  return drizzleNeon(connectionString);
}

// Service role. Request handlers may use this only after server-side auth, org membership,
// and tenant-user authorization have been verified.
export async function createMspServiceDb(connectionString: string) {
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const client = postgres(connectionString);
  return drizzle({ client });
}

export type MspDb = ReturnType<typeof createMspDb>;
export type MspServiceDb = Awaited<ReturnType<typeof createMspServiceDb>>;
export type DrizzleDb = MspDb;
