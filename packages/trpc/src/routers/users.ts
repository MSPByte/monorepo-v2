import { users, roles } from '@mspbyte/drizzle';
import { eq } from 'drizzle-orm';
import { t, authProcedure } from '../trpc.js';

export type UserWithRole = typeof users.$inferSelect & { role: typeof roles.$inferSelect | null };

export const usersRouter = t.router({
  list: authProcedure.query(async ({ ctx }): Promise<UserWithRole[]> => {
    const rows = await ctx.db
      .select()
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .orderBy(users.name);
    return rows.map((r) => ({ ...r.users, role: r.roles ?? null }));
  }),
});
