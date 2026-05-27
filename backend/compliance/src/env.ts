import { z } from 'zod';
import { config } from 'dotenv';
config();

const schema = z.object({
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  CATALOG_DATABASE_URL: z.string().url()
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[compliance] Invalid environment:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
