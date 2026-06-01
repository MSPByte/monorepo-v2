import { drizzle } from 'drizzle-orm/postgres-js';
import { Encryption } from '../utils/encryption.js';
import postgres from 'postgres';

export async function createTenantDb(connection: string, encryptionKey: string) {
  const decrypted = Encryption.decrypt(connection, encryptionKey);
  const client = postgres(decrypted ?? '', {
    idle_timeout: 20,
    max: 3,
    connect_timeout: 10,
  });
  return drizzle({ client });
}
