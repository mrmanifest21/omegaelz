import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query, queryOne, run } from "../lib/db-helper";

export const activityRouter = createRouter({
  list: publicQuery.input(z.object({ contactId: z.number().optional(), dealId: z.number().optional(), type: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(({ input }) => {
      let sql = "SELECT * FROM activities WHERE 1=1"; const params: any[] = [];
      if (input?.contactId) { sql += " AND contactId = ?"; params.push(input.contactId); }
      if (input?.dealId) { sql += " AND dealId = ?"; params.push(input.dealId); }
      if (input?.type) { sql += " AND type = ?"; params.push(input.type); }
      sql += " ORDER BY createdAt DESC LIMIT ?"; params.push(input?.limit ?? 50);
      return query(sql, params);
    }),

  create: publicQuery.input(z.object({ type: z.enum(["call","email","meeting","note","task","sms"]), contactId: z.number().optional(), dealId: z.number().optional(), userId: z.number().default(1), title: z.string().min(1), description: z.string().optional(), dueDate: z.string().optional(), duration: z.number().optional() }))
    .mutation(({ input }) => {
      const due = input.dueDate ? Math.floor(new Date(input.dueDate).getTime() / 1000) : null;
      const result = run("INSERT INTO activities (type, contactId, dealId, userId, title, description, dueDate, duration, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
        [input.type, input.contactId || null, input.dealId || null, input.userId, input.title, input.description || null, due, input.duration || null]);
      return { id: result.lastInsertRowid, ...input };
    }),

  complete: publicQuery.input(z.object({ id: z.number() })).mutation(({ input }) => {
    run("UPDATE activities SET status = 'completed', completedAt = ? WHERE id = ?", [Math.floor(Date.now() / 1000), input.id]);
    return queryOne("SELECT * FROM activities WHERE id = ?", [input.id]);
  }),

  delete: publicQuery.input(z.object({ id: z.number() })).mutation(({ input }) => {
    run("DELETE FROM activities WHERE id = ?", [input.id]); return { success: true };
  }),
});
