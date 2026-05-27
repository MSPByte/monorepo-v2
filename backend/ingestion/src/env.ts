import { z } from 'zod';
import { config } from 'dotenv';
config();

const schema = z.object({
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CERT_PEM: z.string().optional(),
  ENCRYPTION_KEY: z.string().default(''),
  CATALOG_DATABASE_URL: z.string().url()
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[ingestion] Invalid environment:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
