import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';

export function createMspDb(connectionString: string) {
  return drizzleNeon(connectionString);
}

// Service role — use only in worker context, never in request handlers
export async function createMspServiceDb(connectionString: string) {
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const client = postgres(connectionString);
  return drizzle({ client });
}

export type MspDb = ReturnType<typeof createMspDb>;
export type MspServiceDb = Awaited<ReturnType<typeof createMspServiceDb>>;
export type DrizzleDb = MspDb;
