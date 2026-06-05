import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query, queryOne, run } from "../lib/db-helper";

export const messageRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        recipientId: z.number(),
        folder: z.enum(["inbox", "sent"]).default("inbox"),
      }).optional()
    )
    .query(({ input }) => {
      if (!input) return { messages: [], unreadCount: 0 };

      const sql = input.folder === "inbox"
        ? "SELECT * FROM messages WHERE recipientId = ? ORDER BY createdAt DESC LIMIT 100"
        : "SELECT * FROM messages WHERE senderId = ? ORDER BY createdAt DESC LIMIT 100";

      const items = query(sql, [input.recipientId]) as any[];
      const unreadResult = queryOne(
        "SELECT COUNT(*) as c FROM messages WHERE recipientId = ? AND isRead = 0",
        [input.recipientId]
      ) as any;

      return { messages: items, unreadCount: unreadResult?.c ?? 0 };
    }),

  getConversation: publicQuery
    .input(z.object({
      user1Id: z.number(),
      user2Id: z.number(),
    }))
    .query(({ input }) => {
      const items = query(
        "SELECT * FROM messages WHERE (senderId = ? AND recipientId = ?) OR (senderId = ? AND recipientId = ?) ORDER BY createdAt",
        [input.user1Id, input.user2Id, input.user2Id, input.user1Id]
      ) as any[];
      return items;
    }),

  send: publicQuery
    .input(
      z.object({
        senderId: z.number(),
        senderName: z.string(),
        recipientId: z.number(),
        subject: z.string(),
        body: z.string(),
        parentId: z.number().optional(),
      })
    )
    .mutation(({ input }) => {
      const result = run(
        "INSERT INTO messages (senderId, senderName, recipientId, subject, body, parentId) VALUES (?, ?, ?, ?, ?, ?)",
        [input.senderId, input.senderName, input.recipientId, input.subject, input.body, input.parentId ?? null]
      );
      return { id: Number(result.lastInsertRowid), ...input };
    }),

  markRead: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      run("UPDATE messages SET isRead = 1 WHERE id = ?", [input.id]);
      return { success: true };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      run("DELETE FROM messages WHERE id = ?", [input.id]);
      return { success: true };
    }),

  getUnreadCount: publicQuery
    .input(z.object({ recipientId: z.number() }))
    .query(({ input }) => {
      const result = queryOne(
        "SELECT COUNT(*) as c FROM messages WHERE recipientId = ? AND isRead = 0",
        [input.recipientId]
      ) as any;
      return result?.c ?? 0;
    }),
});
