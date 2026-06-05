import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query, queryOne, run } from "../lib/db-helper";

// Simulated AI responses for OmegaAI
function generateAIResponse(message: string, context: any): string {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes("pipeline") || lowerMsg.includes("deals")) {
    const allDeals = context.deals || [];
    const totalDeals = allDeals.length;
    const totalValue = allDeals.reduce((s: number, d: any) => s + Number(d.value), 0);
    const wonValue = allDeals.filter((d: any) => d.stage === "won").reduce((s: number, d: any) => s + Number(d.value), 0);
    return `Based on your current pipeline data:\n\n- Total deals: ${totalDeals}\n- Pipeline value: R${totalValue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}\n- Revenue won: R${wonValue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}\n\nYour top deals are SABSA (R4,050, 85% probability) and Du Preez Legal IT Migration (R18,000, 70% probability).`;
  }

  if (lowerMsg.includes("contact") || lowerMsg.includes("lead")) {
    const allContacts = context.contacts || [];
    const total = allContacts.length;
    const customers = allContacts.filter((c: any) => c.status === "customer").length;
    const leads = allContacts.filter((c: any) => c.status === "lead").length;
    const prospects = allContacts.filter((c: any) => c.status === "prospect").length;
    return `Here's your contact summary:\n\n- Total contacts: ${total}\n- Customers: ${customers}\n- Leads: ${leads}\n- Prospects: ${prospects}\n\nYour customer conversion rate is ${total > 0 ? ((customers / total) * 100).toFixed(1) : 0}%.`;
  }

  if (lowerMsg.includes("revenue") || lowerMsg.includes("money") || lowerMsg.includes("income")) {
    const allProjects = context.projects || [];
    const rev = allProjects.reduce((s: number, p: any) => s + Number(p.revenue ?? 0), 0);
    const rec = allProjects.reduce((s: number, p: any) => s + Number(p.received ?? 0), 0);
    const out = allProjects.reduce((s: number, p: any) => s + Number(p.outstanding ?? 0), 0);
    return `Your revenue overview:\n\n- Total project value: R${rev.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}\n- Revenue collected: R${rec.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}\n- Outstanding: R${out.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}\n\nCollection rate: ${rev > 0 ? ((rec / rev) * 100).toFixed(1) : 0}%`;
  }

  if (lowerMsg.includes("task") || lowerMsg.includes("todo")) {
    const allTasks = context.tasks || [];
    const total = allTasks.length;
    const done = allTasks.filter((t: any) => t.status === "done").length;
    const pending = allTasks.filter((t: any) => t.status === "todo" || t.status === "in_progress").length;
    const highPriority = allTasks.filter((t: any) => t.status === "todo" && t.priority === "high").length;
    return `Task status:\n\n- Total tasks: ${total}\n- Completed: ${done}\n- Pending: ${pending}\n\nYou have ${highPriority} high-priority tasks waiting.`;
  }

  if (lowerMsg.includes("project")) {
    const allProjects = context.projects || [];
    const total = allProjects.length;
    const completed = allProjects.filter((p: any) => p.status === "completed").length;
    const inProgress = allProjects.filter((p: any) => p.status === "in_progress").length;
    const planning = allProjects.filter((p: any) => p.status === "planning").length;
    return `Project summary:\n\n- Total projects: ${total}\n- Completed: ${completed}\n- In progress: ${inProgress}\n- Planning: ${planning}\n\nActive projects: SABSA Digital Presence and Lizorah Brand Launch.`;
  }

  if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey")) {
    return "Hello! I'm OmegaAI, your intelligent CRM assistant. I can help you with:\n\n- Pipeline analysis and forecasting\n- Contact and lead management\n- Revenue tracking and reporting\n- Task and project updates\n- Sales insights and recommendations\n\nWhat would you like to know about your CRM data?";
  }

  // Generic response with context
  const totalContacts = (context.contacts || []).length;
  const totalDeals = (context.deals || []).length;
  const totalTasks = (context.tasks || []).length;
  return `I understand you're asking about "${message}". Based on your CRM data, you currently have ${totalContacts} contacts, ${totalDeals} deals in your pipeline, and ${totalTasks} tasks.\n\nFor more specific information, try asking about:\n- "What's my pipeline value?"\n- "Show me my contacts"\n- "What tasks are due?"\n- "What's my revenue this month?"`;
}

export const aiRouter = createRouter({
  chat: publicQuery
    .input(z.object({
      message: z.string().min(1),
      conversationId: z.number().optional(),
    }))
    .mutation(({ input }) => {
      // Get CRM context using raw SQL
      const allContacts = query("SELECT * FROM contacts LIMIT 100") as any[];
      const allDeals = query("SELECT * FROM deals LIMIT 100") as any[];
      const allTasks = query("SELECT * FROM tasks LIMIT 100") as any[];
      const allProjects = query("SELECT * FROM projects LIMIT 100") as any[];

      const context = {
        contacts: allContacts,
        deals: allDeals,
        tasks: allTasks,
        projects: allProjects,
      };

      const reply = generateAIResponse(input.message, context);

      let conversationId: number;

      if (input.conversationId) {
        // Update existing conversation
        const existing = queryOne("SELECT * FROM ai_conversations WHERE id = ?", [input.conversationId]) as any;
        if (existing) {
          let messages = [];
          try {
            messages = existing.messages ? JSON.parse(existing.messages) : [];
          } catch { messages = []; }
          messages.push({ role: "user", content: input.message, timestamp: new Date().toISOString() });
          messages.push({ role: "assistant", content: reply, timestamp: new Date().toISOString() });
          run("UPDATE ai_conversations SET messages = ?, updatedAt = unixepoch() WHERE id = ?", [JSON.stringify(messages), input.conversationId]);
          conversationId = input.conversationId;
          return { reply, conversationId };
        }
      }

      // Create new conversation
      const messages = [
        { role: "user", content: input.message, timestamp: new Date().toISOString() },
        { role: "assistant", content: reply, timestamp: new Date().toISOString() },
      ];
      const title = input.message.length > 40 ? input.message.substring(0, 40) + "..." : input.message;
      const result = run(
        "INSERT INTO ai_conversations (userId, title, messages) VALUES (?, ?, ?)",
        [1, title, JSON.stringify(messages)]
      );
      conversationId = Number(result.lastInsertRowid);

      return { reply, conversationId };
    }),

  getConversations: publicQuery.query(() => {
    const items = query("SELECT * FROM ai_conversations ORDER BY updatedAt DESC LIMIT 50") as any[];
    return items.map((item: any) => ({
      ...item,
      messages: item.messages ? (() => { try { return JSON.parse(item.messages); } catch { return []; } })() : [],
    }));
  }),

  getConversation: publicQuery
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      const item = queryOne("SELECT * FROM ai_conversations WHERE id = ?", [input.id]) as any;
      if (!item) return null;
      return {
        ...item,
        messages: item.messages ? (() => { try { return JSON.parse(item.messages); } catch { return []; } })() : [],
      };
    }),

  deleteConversation: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      run("DELETE FROM ai_conversations WHERE id = ?", [input.id]);
      return { success: true };
    }),
});
