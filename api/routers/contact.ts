import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query, queryOne, run } from "../lib/db-helper";

export const contactRouter = createRouter({
  list: publicQuery
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      source: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(({ input }) => {
      const limit = input?.limit ?? 20;
      const offset = ((input?.page ?? 1) - 1) * limit;
      let sql = "SELECT * FROM contacts WHERE 1=1";
      const params: any[] = [];
      if (input?.search) {
        sql += " AND (firstName LIKE ? OR lastName LIKE ? OR email LIKE ? OR company LIKE ?)";
        const s = `%${input.search}%`;
        params.push(s, s, s, s);
      }
      if (input?.status) { sql += " AND status = ?"; params.push(input.status); }
      if (input?.source) { sql += " AND source = ?"; params.push(input.source); }
      sql += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);
      const contacts = query(sql, params);
      const countResult = queryOne("SELECT COUNT(*) as c FROM contacts") as any;
      return { contacts, total: countResult?.c ?? 0 };
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      return queryOne("SELECT * FROM contacts WHERE id = ?", [input.id]);
    }),

  create: publicQuery
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      status: z.enum(["lead", "prospect", "customer", "churned"]).optional(),
      source: z.enum(["website", "referral", "social", "cold_call", "event", "other"]).optional(),
      notes: z.string().optional(),
      city: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const result = run(
        "INSERT INTO contacts (firstName, lastName, email, phone, company, jobTitle, status, source, score, notes, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
        [input.firstName, input.lastName, input.email, input.phone || null, input.company || null, input.jobTitle || null, input.status || "lead", input.source || "other", input.notes || null, input.city || null]
      );
      return { id: result.lastInsertRowid, ...input };
    }),

  update: publicQuery
    .input(z.object({
      id: z.number(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      status: z.enum(["lead", "prospect", "customer", "churned"]).optional(),
      source: z.string().optional(),
      score: z.number().optional(),
      notes: z.string().optional(),
      city: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...fields } = input;
      const sets: string[] = [];
      const params: any[] = [];
      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) { sets.push(`${key} = ?`); params.push(val); }
      }
      if (sets.length === 0) return queryOne("SELECT * FROM contacts WHERE id = ?", [id]);
      params.push(id);
      run(`UPDATE contacts SET ${sets.join(", ")} WHERE id = ?`, params);
      return queryOne("SELECT * FROM contacts WHERE id = ?", [id]);
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      run("DELETE FROM contacts WHERE id = ?", [input.id]);
      return { success: true };
    }),

  getStats: publicQuery.query(() => {
    const allContacts = query("SELECT * FROM contacts") as any[];
    const stats = { total: allContacts.length, leads: 0, prospects: 0, customers: 0, churned: 0, bySource: {} as Record<string, number> };
    for (const c of allContacts) {
      stats[c.status as keyof typeof stats]++;
      stats.bySource[c.source] = (stats.bySource[c.source] ?? 0) + 1;
    }
    return stats;
  }),
});
