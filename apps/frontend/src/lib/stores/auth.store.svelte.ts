import { goto } from "$app/navigation";
import { PersistedState } from "runed";
import type { db } from "$lib/db";
import { type Permission, hasPermission } from "@mspbyte/shared";

type User = typeof db.users.$inferSelect;
type Role = typeof db.roles.$inferSelect;

function createAuthStore() {
  const user = new PersistedState<User | null>("current_user", null, {
    storage: "session",
    syncTabs: false,
  });
  const role = new PersistedState<Role | null>("current_role", null, {
    storage: "session",
    syncTabs: false,
  });

  return {
    get currentUser() {
      return user.current;
    },
    get currentRole() {
      return role.current;
    },
    set currentUser(u: User | null) {
      user.current = u;
    },
    set currentRole(r: Role | null) {
      role.current = r;
    },

    isAllowed: (p: Permission) => {
      const attrs =
        (role.current?.attributes as Record<string, boolean> | null) ?? null;
      return hasPermission(attrs, p);
    },

    logout: (signOutFn?: () => void) => {
      user.current = null;
      role.current = null;
      if (signOutFn) {
        signOutFn();
      } else {
        void goto("/auth/signout");
      }
    },
  };
}

export const authStore = createAuthStore();
