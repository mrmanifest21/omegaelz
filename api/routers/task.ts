import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query, queryOne, run } from "../lib/db-helper";

export const taskRouter = createRouter({
  list: publicQuery.input(z.object({ status: z.string().optional(), priority: z.string().optional(), page: z.number().default(1), limit: z.number().default(20) }).optional())
    .query(({ input }) => {
      const limit = input?.limit ?? 20; const offset = ((input?.page ?? 1) - 1) * limit;
      let sql = "SELECT * FROM tasks WHERE 1=1"; const params: any[] = [];
      if (input?.status) { sql += " AND status = ?"; params.push(input.status); }
      if (input?.priority) { sql += " AND priority = ?"; params.push(input.priority); }
      sql += " ORDER BY createdAt DESC LIMIT ? OFFSET ?"; params.push(limit, offset);
      return { tasks: query(sql, params), total: (queryOne("SELECT COUNT(*) as c FROM tasks") as any)?.c ?? 0 };
    }),

  getById: publicQuery.input(z.object({ id: z.number() })).query(({ input }) => {
    return queryOne("SELECT * FROM tasks WHERE id = ?", [input.id]);
  }),

  create: publicQuery.input(z.object({ title: z.string().min(1), description: z.string().optional(), priority: z.enum(["low","medium","high","urgent"]).optional(), assignedTo: z.number().optional(), contactId: z.number().optional(), dealId: z.number().optional(), projectId: z.number().optional(), dueDate: z.string().optional(), createdBy: z.number().default(1) }))
    .mutation(({ input }) => {
      const due = input.dueDate ? Math.floor(new Date(input.dueDate).getTime() / 1000) : null;
      const result = run("INSERT INTO tasks (title, description, status, priority, assignedTo, contactId, dealId, projectId, dueDate, createdBy) VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?)",
        [input.title, input.description || null, input.priority || "medium", input.assignedTo || null, input.contactId || null, input.dealId || null, input.projectId || null, due, input.createdBy]);
      return { id: result.lastInsertRowid, ...input };
    }),

  update: publicQuery.input(z.object({ id: z.number(), title: z.string().optional(), description: z.string().optional(), status: z.enum(["todo","in_progress","review","done"]).optional(), priority: z.enum(["low","medium","high","urgent"]).optional(), assignedTo: z.number().optional(), dueDate: z.string().optional() }))
    .mutation(({ input }) => {
      const { id, ...fields } = input; const sets: string[] = []; const params: any[] = [];
      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          if (key === "dueDate" && val) { sets.push("dueDate = ?"); params.push(Math.floor(new Date(val).getTime() / 1000)); }
          else { sets.push(`${key} = ?`); params.push(val); }
        }
      }
      if (input.status === "done") { sets.push("completedAt = ?"); params.push(Math.floor(Date.now() / 1000)); }
      if (sets.length === 0) return queryOne("SELECT * FROM tasks WHERE id = ?", [id]);
      params.push(id); run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, params);
      return queryOne("SELECT * FROM tasks WHERE id = ?", [id]);
    }),

  delete: publicQuery.input(z.object({ id: z.number() })).mutation(({ input }) => {
    run("DELETE FROM tasks WHERE id = ?", [input.id]); return { success: true };
  }),
});
