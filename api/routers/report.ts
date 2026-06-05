import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query } from "../lib/db-helper";

export const reportRouter = createRouter({
  getSalesPerformance: publicQuery
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional()
    )
    .query(() => {
      const allDeals = query("SELECT * FROM deals") as any[];

      // Group by stage
      const stageData = ["new", "qualified", "proposal", "negotiation", "won", "lost"].map((stage) => ({
        stage,
        count: allDeals.filter((d) => d.stage === stage).length,
        value: allDeals.filter((d) => d.stage === stage).reduce((s, d) => s + Number(d.value), 0),
      }));

      return stageData;
    }),

  getConversionRates: publicQuery.query(() => {
    const allDeals = query("SELECT * FROM deals") as any[];
    const total = allDeals.length;

    const stages = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
    return stages.map((stage) => {
      const count = allDeals.filter((d) => d.stage === stage).length;
      return { stage, count, rate: total > 0 ? (count / total) * 100 : 0 };
    });
  }),

  getContactAnalysis: publicQuery.query(() => {
    const allContacts = query("SELECT * FROM contacts") as any[];

    const byStatus = ["lead", "prospect", "customer", "churned"].map((status) => ({
      status,
      count: allContacts.filter((c) => c.status === status).length,
    }));

    const bySource = ["website", "referral", "social", "cold_call", "event", "other"].map((source) => ({
      source,
      count: allContacts.filter((c) => c.source === source).length,
    }));

    return { byStatus, bySource };
  }),

  getRevenueBreakdown: publicQuery.query(() => {
    const allDeals = query("SELECT * FROM deals") as any[];

    const wonDeals = allDeals.filter((d) => d.stage === "won");
    const pipelineValue = allDeals
      .filter((d) => d.stage !== "won" && d.stage !== "lost")
      .reduce((s, d) => s + Number(d.value) * (Number(d.probability ?? 0) / 100), 0);

    return {
      totalRevenue: wonDeals.reduce((s, d) => s + Number(d.value), 0),
      totalDeals: allDeals.length,
      wonDeals: wonDeals.length,
      lostDeals: allDeals.filter((d) => d.stage === "lost").length,
      activeDeals: allDeals.filter((d) => d.stage !== "won" && d.stage !== "lost").length,
      weightedPipeline: pipelineValue,
      avgDealSize: allDeals.length > 0 ? allDeals.reduce((s, d) => s + Number(d.value), 0) / allDeals.length : 0,
    };
  }),
});
