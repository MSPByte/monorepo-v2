import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization as organizationPlugin } from 'better-auth/plugins';
import { createCatalogDb } from '@mspbyte/drizzle-catalog';
import * as authSchema from '@mspbyte/drizzle-catalog/catalog';

const catalogDatabaseUrl =
  process.env.CATALOG_DATABASE_URL ??
  'postgresql://better_auth:better_auth@127.0.0.1:5432/better_auth';

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? 'build-time-better-auth-secret',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173',
  trustedOrigins,
  database: drizzleAdapter(createCatalogDb(catalogDatabaseUrl), {
    provider: 'pg',
    schema: authSchema
  }),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['microsoft']
    }
  },
  socialProviders: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      tenantId: process.env.MICROSOFT_TENANT_ID ?? 'common',
      authority: process.env.MICROSOFT_AUTHORITY ?? 'https://login.microsoftonline.com',
      prompt: 'select_account'
    }
  },
  plugins: [organizationPlugin()]
});

export type BetterAuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
