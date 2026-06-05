import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query, queryOne, run } from "../lib/db-helper";

export const serviceRouter = createRouter({
  list: publicQuery.input(z.object({ category: z.string().optional(), search: z.string().optional() }).optional())
    .query(({ input }) => {
      let sql = "SELECT * FROM services WHERE isActive = 1"; const params: any[] = [];
      if (input?.category) { sql += " AND category = ?"; params.push(input.category); }
      if (input?.search) { sql += " AND (name LIKE ? OR description LIKE ?)"; const s = `%${input.search}%`; params.push(s, s); }
      sql += " ORDER BY createdAt DESC";
      return query(sql, params);
    }),

  getById: publicQuery.input(z.object({ id: z.number() })).query(({ input }) => queryOne("SELECT * FROM services WHERE id = ?", [input.id])),

  create: publicQuery.input(z.object({ name: z.string().min(1), category: z.string().min(1), description: z.string().optional(), priceMin: z.number().optional(), priceMax: z.number().optional(), pricingUnit: z.enum(["per_hour","per_project","per_month","fixed"]).optional() }))
    .mutation(({ input }) => {
      const result = run("INSERT INTO services (name, category, description, priceMin, priceMax, pricingUnit) VALUES (?, ?, ?, ?, ?, ?)", [input.name, input.category, input.description || null, input.priceMin || null, input.priceMax || null, input.pricingUnit || "per_project"]);
      return { id: result.lastInsertRowid, ...input };
    }),

  update: publicQuery.input(z.object({ id: z.number(), name: z.string().optional(), category: z.string().optional(), description: z.string().optional(), priceMin: z.number().optional(), priceMax: z.number().optional(), pricingUnit: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(({ input }) => {
      const { id, ...fields } = input; const sets: string[] = []; const params: any[] = [];
      for (const [key, val] of Object.entries(fields)) { if (val !== undefined) { sets.push(`${key} = ?`); params.push(val); } }
      params.push(id); run(`UPDATE services SET ${sets.join(", ")} WHERE id = ?`, params);
      return queryOne("SELECT * FROM services WHERE id = ?", [id]);
    }),

  delete: publicQuery.input(z.object({ id: z.number() })).mutation(({ input }) => { run("DELETE FROM services WHERE id = ?", [input.id]); return { success: true }; }),
});
