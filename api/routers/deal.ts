import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query, queryOne, run } from "../lib/db-helper";

export const dealRouter = createRouter({
  list: publicQuery
    .input(z.object({ stage: z.string().optional(), search: z.string().optional(), page: z.number().default(1), limit: z.number().default(20) }).optional())
    .query(({ input }) => {
      const limit = input?.limit ?? 20;
      const offset = ((input?.page ?? 1) - 1) * limit;
      let sql = "SELECT * FROM deals WHERE 1=1";
      const params: any[] = [];
      if (input?.stage) { sql += " AND stage = ?"; params.push(input.stage); }
      if (input?.search) { sql += " AND (title LIKE ? OR company LIKE ?)"; const s = `%${input.search}%`; params.push(s, s); }
      sql += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);
      const deals = query(sql, params);
      const countResult = queryOne("SELECT COUNT(*) as c FROM deals") as any;
      return { deals, total: countResult?.c ?? 0 };
    }),

  getById: publicQuery.input(z.object({ id: z.number() })).query(({ input }) => {
    return queryOne("SELECT * FROM deals WHERE id = ?", [input.id]);
  }),

  create: publicQuery
    .input(z.object({ title: z.string().min(1), contactId: z.number().optional(), company: z.string().optional(), value: z.number().min(0), stage: z.enum(["new","qualified","proposal","negotiation","won","lost"]).optional(), probability: z.number().optional(), expectedCloseDate: z.string().optional(), description: z.string().optional(), assignedTo: z.number().optional(), source: z.string().optional(), competitor: z.string().optional() }))
    .mutation(({ input }) => {
      const result = run(
        "INSERT INTO deals (title, contactId, company, value, stage, probability, expectedCloseDate, description, assignedTo, source, competitor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [input.title, input.contactId || null, input.company || null, input.value, input.stage || "new", input.probability ?? 20, input.expectedCloseDate || null, input.description || null, input.assignedTo || null, input.source || null, input.competitor || null]
      );
      return { id: result.lastInsertRowid, ...input };
    }),

  update: publicQuery
    .input(z.object({ id: z.number(), title: z.string().optional(), contactId: z.number().optional(), company: z.string().optional(), value: z.number().optional(), stage: z.enum(["new","qualified","proposal","negotiation","won","lost"]).optional(), probability: z.number().optional(), expectedCloseDate: z.string().optional(), actualCloseDate: z.string().optional(), description: z.string().optional(), assignedTo: z.number().optional() }))
    .mutation(({ input }) => {
      const { id, ...fields } = input;
      const sets: string[] = []; const params: any[] = [];
      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) { sets.push(`${key} = ?`); params.push(val); }
      }
      if (sets.length === 0) return queryOne("SELECT * FROM deals WHERE id = ?", [id]);
      params.push(id);
      run(`UPDATE deals SET ${sets.join(", ")} WHERE id = ?`, params);
      return queryOne("SELECT * FROM deals WHERE id = ?", [id]);
    }),

  updateStage: publicQuery
    .input(z.object({ id: z.number(), stage: z.enum(["new","qualified","proposal","negotiation","won","lost"]) }))
    .mutation(({ input }) => {
      const updates: any = { stage: input.stage };
      if (input.stage === "won") { updates.probability = 100; updates.actualCloseDate = new Date().toISOString().split("T")[0]; }
      if (input.stage === "lost") updates.probability = 0;
      const sets: string[] = []; const params: any[] = [];
      for (const [k, v] of Object.entries(updates)) { sets.push(`${k} = ?`); params.push(v); }
      params.push(input.id);
      run(`UPDATE deals SET ${sets.join(", ")} WHERE id = ?`, params);
      return queryOne("SELECT * FROM deals WHERE id = ?", [input.id]);
    }),

  delete: publicQuery.input(z.object({ id: z.number() })).mutation(({ input }) => {
    run("DELETE FROM deals WHERE id = ?", [input.id]);
    return { success: true };
  }),

  getPipeline: publicQuery.query(() => {
    const allDeals = query("SELECT * FROM deals") as any[];
    const stages = ["new","qualified","proposal","negotiation","won","lost"];
    const pipeline = stages.map(stage => ({ stage, count: 0, value: 0 }));
    for (const d of allDeals) {
      const p = pipeline.find(p => p.stage === d.stage);
      if (p) { p.count++; p.value += Number(d.value); }
    }
    const totalValue = allDeals.reduce((s, d) => s + Number(d.value), 0);
    return { stages: pipeline, totalValue };
  }),

  getStats: publicQuery.query(() => {
    const allDeals = query("SELECT * FROM deals") as any[];
    const won = allDeals.filter(d => d.stage === "won");
    const lost = allDeals.filter(d => d.stage === "lost");
    const totalWon = won.reduce((s, d) => s + Number(d.value), 0);
    return {
      totalDeals: allDeals.length,
      totalValue: allDeals.reduce((s, d) => s + Number(d.value), 0),
      avgDealSize: allDeals.length > 0 ? allDeals.reduce((s, d) => s + Number(d.value), 0) / allDeals.length : 0,
      winRate: (won.length + lost.length) > 0 ? (won.length / (won.length + lost.length)) * 100 : 0,
      dealsByStage: allDeals.reduce((acc, d) => { acc[d.stage] = (acc[d.stage] ?? 0) + 1; return acc; }, {} as Record<string, number>),
      revenueWon: totalWon,
    };
  }),
});
