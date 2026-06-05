import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query, queryOne, run } from "../lib/db-helper";

export const projectRouter = createRouter({
  list: publicQuery.input(z.object({ status: z.string().optional(), search: z.string().optional(), page: z.number().default(1), limit: z.number().default(20) }).optional())
    .query(({ input }) => {
      let sql = "SELECT * FROM projects WHERE 1=1"; const params: any[] = [];
      if (input?.status) { sql += " AND status = ?"; params.push(input.status); }
      if (input?.search) { sql += " AND (title LIKE ? OR projectCode LIKE ?)"; const s = `%${input.search}%`; params.push(s, s); }
      sql += " ORDER BY createdAt DESC LIMIT ? OFFSET ?"; params.push(input?.limit ?? 20, ((input?.page ?? 1) - 1) * (input?.limit ?? 20));
      return { projects: query(sql, params), total: (queryOne("SELECT COUNT(*) as c FROM projects") as any)?.c ?? 0 };
    }),

  getById: publicQuery.input(z.object({ id: z.number() })).query(({ input }) => queryOne("SELECT * FROM projects WHERE id = ?", [input.id])),

  create: publicQuery.input(z.object({ projectCode: z.string().min(1), title: z.string().min(1), clientId: z.number().optional(), description: z.string().optional(), services: z.array(z.string()).optional(), status: z.enum(["planning","in_progress","on_hold","completed","cancelled"]).optional(), startDate: z.string().optional(), endDate: z.string().optional(), budget: z.number().optional(), assignedTo: z.number().optional(), priority: z.enum(["low","medium","high","urgent"]).optional() }))
    .mutation(({ input }) => {
      const result = run("INSERT INTO projects (projectCode, title, clientId, description, services, status, startDate, endDate, budget, assignedTo, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [input.projectCode, input.title, input.clientId || null, input.description || null, input.services ? JSON.stringify(input.services) : null, input.status || "planning", input.startDate || null, input.endDate || null, input.budget || null, input.assignedTo || null, input.priority || "medium"]);
      return { id: result.lastInsertRowid, ...input };
    }),

  update: publicQuery.input(z.object({ id: z.number(), title: z.string().optional(), description: z.string().optional(), status: z.enum(["planning","in_progress","on_hold","completed","cancelled"]).optional(), budget: z.number().optional(), actualCost: z.number().optional(), revenue: z.number().optional(), received: z.number().optional(), outstanding: z.number().optional(), priority: z.enum(["low","medium","high","urgent"]).optional() }))
    .mutation(({ input }) => {
      const { id, ...fields } = input; const sets: string[] = []; const params: any[] = [];
      for (const [key, val] of Object.entries(fields)) { if (val !== undefined) { sets.push(`${key} = ?`); params.push(val); } }
      if (sets.length === 0) return queryOne("SELECT * FROM projects WHERE id = ?", [id]);
      params.push(id); run(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`, params);
      return queryOne("SELECT * FROM projects WHERE id = ?", [id]);
    }),

  delete: publicQuery.input(z.object({ id: z.number() })).mutation(({ input }) => { run("DELETE FROM projects WHERE id = ?", [input.id]); return { success: true }; }),

  getStats: publicQuery.query(() => {
    const all = query("SELECT * FROM projects") as any[];
    return { total: all.length, completed: all.filter(p => p.status === "completed").length, inProgress: all.filter(p => p.status === "in_progress").length, planning: all.filter(p => p.status === "planning").length, totalRevenue: all.reduce((s, p) => s + (p.revenue ?? 0), 0), totalReceived: all.reduce((s, p) => s + (p.received ?? 0), 0), totalOutstanding: all.reduce((s, p) => s + (p.outstanding ?? 0), 0) };
  }),
});
