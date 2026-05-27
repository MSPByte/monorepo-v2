# MSPByte Monorepo — Architectural Rules

## Package Manager

This is a Turborepo monorepo using **Bun**, not npm or yarn. Always use `bun` for package management (`bun add`, `bun install`, `bun run`). Never use `npm install` or `yarn add`.

## Monorepo Structure

```
apps/web/              ← SvelteKit frontend
backend/api/           ← Fastify + tRPC HTTP server
backend/pipeline/      ← BullMQ ingestion orchestrator (scheduler + flow builder)
backend/ingestion/     ← BullMQ fetch + normalize workers + provider adapters
backend/alerts/        ← BullMQ alert evaluation worker
backend/compliance/    ← BullMQ compliance evaluation worker
packages/drizzle/      ← Drizzle ORM schemas + client factories
packages/shared/       ← Zod schemas, TypeScript types, queue constants
packages/trpc/         ← tRPC router definition + AppRouter type
packages/typescript-config/  ← Shared tsconfig presets
packages/eslint-config/      ← Shared ESLint config
infra/                 ← Docker Compose (Redis)
```

## Database Architecture — Two Tiers

**Catalog DB** (`CATALOG_DATABASE_URL`): Single Neon project. Contains only the `orgs` table — maps a Clerk org ID to the MSP's dedicated Neon project connection strings. Never store MSP operational data here.

**MSP DB** (per org): One Neon project per MSP organization. Contains all operational data: tenants, sites, users, integrations, vendor data, alerts, compliance. Connection string comes from `orgs.neon_connection_string` in the catalog DB.

### Database Client Rules

- `createCatalogDb()` — neon-http driver. For API request context only. Reads `CATALOG_DATABASE_URL`.
- `createMspDb(connectionString)` — neon-http driver. For API/tRPC request handlers. Connection string from catalog lookup.
- `createMspServiceDb(connectionString)` — postgres-js driver. **Workers only.** Never use in request handlers.

Never trust client-supplied connection strings. Always resolve them from the catalog lookup using the Clerk JWT's `o: { id }` claim.

### Schema Locations

- Catalog schema: `packages/drizzle/src/catalog/schema.ts` — `orgs` table only
- MSP public schema: `packages/drizzle/src/msp/schema.ts`
- MSP vendors schema: `packages/drizzle/src/msp/vendors.ts` (uses `pgSchema('vendors')`)

Never query MSP DB tables from catalog schema code and vice versa.

## tRPC Rules

- Router defined in `packages/trpc/src/router.ts`
- `packages/trpc/src/index.ts` exports `appRouter` (implementation) and `export type { AppRouter }` (type only)
- `apps/frontend` must **only** use `import type { AppRouter } from '@mspbyte/trpc'` — never import the implementation
- Every tRPC procedure validates the Clerk session via the context factory in `packages/trpc/src/context.ts`
- `o: { id }` comes from the Clerk JWT claim — never trust client-supplied org IDs

## Auth (Clerk)

- Clerk organizations model: one Clerk org = one MSP
- JWT `org_id` claim maps to `orgs.clerk_org_id` in the catalog DB
- Every API request must have a valid Clerk session token in the Authorization header
- tRPC context verifies the token and resolves the MSP DB connection before any procedure runs

## BullMQ Workers

- `backend/pipeline` orchestrates — creates BullMQ Flows chaining fetch → normalize → alerts
- `backend/ingestion` fetches raw data and normalizes it into vendor tables
- `backend/alerts` evaluates check definitions against normalized data and upserts alert records
- `backend/compliance` evaluates framework checks against stored data in vendor tables
- Workers communicate via **queues only** — never import functions from other backend packages
- Queue names are constants in `packages/shared/src/types/queues.ts`. Never hardcode queue name strings.
- Create one IORedis connection per process and share it across workers

## Provider Adapters

- All provider adapters implement `ProviderAdapter` from `packages/shared/src/libs/provider.ts`
- Provider-specific logic lives **only** in `backend/ingestion/src/adapters/`
- Register adapters in `backend/ingestion/src/adapters/registry.ts`
- To add a new provider: implement `ProviderAdapter`, register it — no other files need changing

## Alert Upsert State Machine

The `upsertAlert` function in `backend/alerts/src/upsert.ts` enforces this state machine:

1. No existing alert → INSERT new `active` alert
2. Existing `active` or `suppressed` alert → UPDATE `last_seen_at` only (never change suppression)
3. Only `resolved` alert exists → INSERT new `active` alert (issue returned)

Never reopen a resolved alert. Never write alerts from the compliance worker.

## Testing Conventions

- **Unit tests**: alongside source files as `*.test.ts`. No DB, no Redis, no HTTP. Pure logic + mocks only.
- **Integration tests**: in `<package>/__tests__/integration/*.integration.test.ts`. Use real test DB + Redis. Wrap every test in a transaction and always rollback via `withTestTransaction`.
- **E2E tests**: in `apps/frontend/e2e/*.spec.ts`. Playwright + Chromium only.
- Test DB env vars: `TEST_CATALOG_DATABASE_URL`, `TEST_MSP_DATABASE_URL`

## Do Not Use

- **Convex** — replaced by Drizzle + Neon
- **Supabase** — not part of this stack
- **Prisma** — use Drizzle ORM only
- Do not add new dependencies without noting them in a PR description

## TypeScript Config

- Backend packages + `packages/shared/drizzle/trpc`: extend `@repo/typescript-config/base.json` (NodeNext module)
- `apps/frontend` + `packages/ui`: extend `@repo/typescript-config/svelte.json`
- Use `.js` extensions in imports within backend src files — required for NodeNext module resolution

## Build Order (Turborepo dependency graph)

`shared` → `drizzle` → `trpc` → `api`, `frontend`, `pipeline`, `ingestion`, `alerts`, `compliance`
