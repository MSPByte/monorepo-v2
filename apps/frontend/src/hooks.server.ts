import { redirect, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { eq } from "drizzle-orm";
import { withClerkHandler } from "svelte-clerk/server";
import { getTenantDbByClerkOrg } from "@mspbyte/drizzle-catalog";
import { users, roles, createMspServiceDb } from "@mspbyte/drizzle";
import { CATALOG_DATABASE_URL } from "$env/static/private";
import { getCatalogDb } from "@mspbyte/drizzle-catalog/tenant-factory";

const isPublicRoute = (route: string): boolean => {
  return route.startsWith("/auth") || route === "/";
};

const handleAuth: Handle = async ({ event, resolve }) => {
  try {
    const auth = event.locals.auth;
    const orgId = auth().orgId;
    const userId = auth().userId;

    if (!orgId || !userId) {
      if (isPublicRoute(event.url.pathname)) return resolve(event);
      throw { message: "User failed to authenticate", state: "anon" };
    }

    getCatalogDb(CATALOG_DATABASE_URL);
    const result = await getTenantDbByClerkOrg(orgId).catch(() => null);
    if (!result) {
      throw { message: "Org not found", state: "invalid" };
    }

    const { org } = result;
    const db = await createMspServiceDb(org.serviceConnectionString);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    if (!user || !user.roleId)
      throw { message: "User not found", state: "invalid" };

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, user.roleId))
      .limit(1);

    if (!role) throw { message: "Role not found", state: "invalid" };

    event.locals.user = user;
    event.locals.role = role;
    event.locals.org = org;
    event.locals.connectionString = org.serviceConnectionString;
  } catch (err: any) {
    console.error(`HOOK_ERR: ${err?.message || err}`);

    if (isPublicRoute(event.url.pathname) && err?.state !== "invalid")
      return resolve(event);
    else if (err?.state === "invalid") {
      for (const cookie of event.cookies.getAll()) {
        if (cookie.name.includes("clerk")) {
          event.cookies.delete(cookie.name, { path: "/" });
        }
      }
      return redirect(302, "/auth/login");
    } else return redirect(302, "/auth/login");
  }

  return resolve(event);
};

const handleRoutes: Handle = async ({ event, resolve }) => {
  const state = event.locals.user ? "authenticated" : "anon";

  if (state === "authenticated") {
    if (isPublicRoute(event.url.pathname)) {
      return redirect(302, "/home");
    }
    return resolve(event);
  } else if (state === "anon") {
    if (!isPublicRoute(event.url.pathname)) {
      return redirect(302, "/auth/login");
    }
    return resolve(event);
  }

  return resolve(event);
};

export const handle = sequence(withClerkHandler(), handleAuth, handleRoutes);
