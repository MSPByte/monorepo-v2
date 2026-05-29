import { z } from 'zod';
import 'dotenv/config';

const schema = z.object({
  REDIS_URL: z.url().default('redis://localhost:6379'),
  CATALOG_DATABASE_URL: z.url(),
  SCHEDULE_CRON: z.string().default('*/5 * * * *'),
  LOG_LEVEL: z.enum(['trace', 'info', 'debug', 'warn', 'silent', 'error', 'fatal']).default('info')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.log('[pipeline] Current environment:', process.env);
  console.error('[pipeline] Invalid environment:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
