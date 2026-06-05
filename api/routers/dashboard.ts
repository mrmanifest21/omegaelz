import { createRouter, publicQuery } from "../middleware";
import { query, queryOne } from "../lib/db-helper";

export const dashboardRouter = createRouter({
  getKPIs: publicQuery.query(() => {
    const contactCount = queryOne("SELECT COUNT(*) as c FROM contacts") as any;
    const dealCount = queryOne("SELECT COUNT(*) as c FROM deals WHERE stage != 'won' AND stage != 'lost'") as any;
    const taskCount = queryOne("SELECT COUNT(*) as c FROM tasks WHERE status != 'done'") as any;
    const wonRevenue = queryOne("SELECT COALESCE(SUM(value), 0) as total FROM deals WHERE stage = 'won'") as any;

    return {
      revenue: Number(wonRevenue?.total ?? 0),
      activeDeals: Number(dealCount?.c ?? 0),
      contacts: Number(contactCount?.c ?? 0),
      tasksDue: Number(taskCount?.c ?? 0),
      revenueChange: 14.2,
      dealsChange: 8.5,
      contactsChange: 23.1,
      tasksChange: -5.2,
    };
  }),

  getRevenueOverview: publicQuery.query(() => {
    const allProjects = query("SELECT * FROM projects") as any[];

    const q1 = allProjects.filter((p) => {
      const d = p.startDate ? new Date(p.startDate) : null;
      return d && d.getMonth() >= 0 && d.getMonth() <= 2;
    }).reduce((s, p) => s + Number(p.revenue ?? 0), 0);

    const q2 = allProjects.filter((p) => {
      const d = p.startDate ? new Date(p.startDate) : null;
      return d && d.getMonth() >= 3 && d.getMonth() <= 5;
    }).reduce((s, p) => s + Number(p.revenue ?? 0), 0);

    const q3 = allProjects.filter((p) => {
      const d = p.startDate ? new Date(p.startDate) : null;
      return d && d.getMonth() >= 6 && d.getMonth() <= 8;
    }).reduce((s, p) => s + Number(p.revenue ?? 0), 0);

    const q4 = allProjects.filter((p) => {
      const d = p.startDate ? new Date(p.startDate) : null;
      return d && d.getMonth() >= 9 && d.getMonth() <= 11;
    }).reduce((s, p) => s + Number(p.revenue ?? 0), 0);

    return {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      values: [q1, q2, q3, q4],
    };
  }),

  getRecentActivity: publicQuery.query(() => {
    const items = query("SELECT * FROM activities ORDER BY createdAt DESC LIMIT 10") as any[];
    return items;
  }),

  getTopDeals: publicQuery.query(() => {
    const items = query("SELECT * FROM deals WHERE stage != 'lost' ORDER BY value DESC LIMIT 5") as any[];
    return items;
  }),
});
