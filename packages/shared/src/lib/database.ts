import { drizzle } from 'drizzle-orm/postgres-js';
import { Encryption } from '../utils/encryption.js';
import postgres from 'postgres';

export async function createTenantDb(connection: string, encryptionKey: string) {
  const decrypted = Encryption.decrypt(connection, encryptionKey);
  const client = postgres(decrypted ?? '');
  return drizzle({ client });
}
