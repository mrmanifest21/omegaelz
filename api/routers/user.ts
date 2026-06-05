import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query, queryOne, run } from "../lib/db-helper";

export const userRouter = createRouter({
  list: publicQuery.query(() => {
    // Combine OAuth users and local users into a unified list
    const oauthUsers = query("SELECT id, name, email, avatar, role, phone, department, isActive, createdAt, lastSignInAt, 'oauth' as authType FROM users") as any[];
    const localUsers = query("SELECT id, name, email, NULL as avatar, role, phone, department, isActive, createdAt, updatedAt as lastSignInAt, 'local' as authType FROM local_users") as any[];
    return [...oauthUsers, ...localUsers];
  }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      // Try OAuth users first, then local users
      let user = queryOne("SELECT * FROM users WHERE id = ?", [input.id]);
      if (!user) {
        user = queryOne("SELECT * FROM local_users WHERE id = ?", [input.id]);
      }
      return user ?? null;
    }),

  updateRole: publicQuery
    .input(z.object({ id: z.number(), role: z.enum(["admin", "manager", "sales", "support"]), authType: z.string().optional() }))
    .mutation(({ input }) => {
      const { id, role, authType } = input;
      if (authType === "oauth" || !authType) {
        run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
        const updated = queryOne("SELECT * FROM users WHERE id = ?", [id]);
        if (updated) return updated;
      }
      // Try local_users
      run("UPDATE local_users SET role = ? WHERE id = ?", [role, id]);
      return queryOne("SELECT * FROM local_users WHERE id = ?", [id]);
    }),

  updateProfile: publicQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      phone: z.string().optional(),
      department: z.string().optional(),
      authType: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const { id, name, phone, department, authType } = input;
      if (authType === "oauth" || !authType) {
        run("UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), department = COALESCE(?, department) WHERE id = ?", [name || null, phone || null, department || null, id]);
        const updated = queryOne("SELECT * FROM users WHERE id = ?", [id]);
        if (updated) return updated;
      }
      run("UPDATE local_users SET name = COALESCE(?, name), phone = COALESCE(?, phone), department = COALESCE(?, department) WHERE id = ?", [name || null, phone || null, department || null, id]);
      return queryOne("SELECT * FROM local_users WHERE id = ?", [id]);
    }),

  toggleActive: publicQuery
    .input(z.object({ id: z.number(), authType: z.string().optional() }))
    .mutation(({ input }) => {
      const { id, authType } = input;
      if (authType === "oauth" || !authType) {
        const user = queryOne("SELECT isActive FROM users WHERE id = ?", [id]);
        if (user) {
          const newVal = user.isActive ? 0 : 1;
          run("UPDATE users SET isActive = ? WHERE id = ?", [newVal, id]);
          return { success: true, isActive: newVal === 1 };
        }
      }
      const user = queryOne("SELECT isActive FROM local_users WHERE id = ?", [id]);
      const newVal = user ? (user.isActive ? 0 : 1) : 1;
      run("UPDATE local_users SET isActive = ? WHERE id = ?", [newVal, id]);
      return { success: true, isActive: newVal === 1 };
    }),
});
