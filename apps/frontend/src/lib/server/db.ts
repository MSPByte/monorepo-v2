import { sql, type DrizzleConfig } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import {
  drizzle as drizzlePg,
  NeonDatabase,
} from "drizzle-orm/neon-serverless";
import { CATALOG_DATABASE_URL } from "$env/static/private";
import type { SessionAuthObject } from "svelte-clerk/server";
import { decode } from "$lib/server/jwt";
import { db, dbCatalog } from "$lib/db";

type ClerkToken = {
  iss?: string;
  azp?: string;
  exp?: number;
  iat?: number;
  jti?: string;
  nbf?: number;
  fva?: number[];
  v?: number;

  sid?: string;
  sub?: string;
  pla?: string;
  fea?: string;
  sts?: string;

  // ORG
  id?: string;
  slg?: string;
  rol?: string;
  per?: string;
  fpm?: number[];
};

function createDrizzle<
  Database extends NeonDatabase<any>,
  Token extends ClerkToken = ClerkToken,
>(token: Token, { client }: { client: Database }) {
  return {
    rls: (async (transaction, ...rest) => {
      return await client.transaction(
        async (tx) => {
          // Use a savepoint so reset can run even if the inner tx fails
          await tx.execute(sql`SAVEPOINT rls_setup;`);

          try {
            await tx.execute(sql`
          -- auth.jwt()
          select set_config('request.jwt.claims', '${sql.raw(JSON.stringify(token))}', TRUE);
          -- auth.uid()
          select set_config('request.jwt.claim.sub', '${sql.raw(token.sub ?? "")}', TRUE);												
          -- set local role
          set local role ${sql.raw(token.iss ? "authenticated" : "anonymous")};
          `);

            const result = await transaction(tx);
            return result;
          } catch (err) {
            // Rollback to savepoint on error so we can still do cleanup
            await tx
              .execute(sql`ROLLBACK TO SAVEPOINT rls_setup;`)
              .catch(() => {}); // ignore cleanup errors
            throw err; // re-throw the original error
          } finally {
            // Always try to clean up (this now happens in a clean subtransaction state)
            await tx
              .execute(
                sql`
            -- reset
            select set_config('request.jwt.claims', NULL, TRUE);
            select set_config('request.jwt.claim.sub', NULL, TRUE);
            reset role;
            `,
              )
              .catch(() => {}); // best effort cleanup
          }
        },
        ...rest,
      );
    }) as typeof client.transaction,
  };
}

const client = (connection: string) => drizzlePg(connection);

export function createDrizzleCatalog() {
  return drizzle(CATALOG_DATABASE_URL);
}

export async function createDrizzleClient(
  connection: string,
  session: SessionAuthObject,
) {
  const token = await session.getToken();
  return createDrizzle(decode(token ?? ""), { client: client(connection) });
}

export type DrizzleClient = Awaited<ReturnType<typeof createDrizzleClient>>;
