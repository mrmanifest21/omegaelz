import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ============================================================
// USERS (OAuth users)
// ============================================================
export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  unionId: text("unionId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  avatar: text("avatar"),
  role: text("role", { enum: ["admin", "manager", "sales", "support"] }).default("sales").notNull(),
  phone: text("phone"),
  department: text("department"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastSignInAt: integer("lastSignInAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// LOCAL USERS (for username/password auth)
// ============================================================
export const localUsers = sqliteTable("local_users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  name: text("name"),
  email: text("email"),
  role: text("role", { enum: ["admin", "manager", "sales", "support"] }).default("sales").notNull(),
  phone: text("phone"),
  department: text("department"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// CONTACTS
// ============================================================
export const contacts = sqliteTable("contacts", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  jobTitle: text("jobTitle"),
  status: text("status", { enum: ["lead", "prospect", "customer", "churned"] }).default("lead").notNull(),
  source: text("source", { enum: ["website", "referral", "social", "cold_call", "event", "other"] }).default("other").notNull(),
  score: integer("score").default(0).notNull(),
  assignedTo: integer("assignedTo"),
  lastActivityAt: integer("lastActivityAt", { mode: "timestamp" }),
  notes: text("notes"),
  address: text("address"),
  city: text("city"),
  country: text("country").default("South Africa"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// DEALS
// ============================================================
export const deals = sqliteTable("deals", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  contactId: integer("contactId"),
  company: text("company"),
  value: real("value").notNull(),
  currency: text("currency").default("ZAR").notNull(),
  stage: text("stage", { enum: ["new", "qualified", "proposal", "negotiation", "won", "lost"] }).default("new").notNull(),
  probability: integer("probability").default(0).notNull(),
  expectedCloseDate: text("expectedCloseDate"),
  actualCloseDate: text("actualCloseDate"),
  description: text("description"),
  assignedTo: integer("assignedTo"),
  source: text("source"),
  competitor: text("competitor"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// ACTIVITIES
// ============================================================
export const activities = sqliteTable("activities", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["call", "email", "meeting", "note", "task", "sms"] }).notNull(),
  contactId: integer("contactId"),
  dealId: integer("dealId"),
  userId: integer("userId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: integer("dueDate", { mode: "timestamp" }),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  status: text("status", { enum: ["pending", "completed", "overdue", "cancelled"] }).default("pending").notNull(),
  duration: integer("duration"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// PROJECTS
// ============================================================
export const projects = sqliteTable("projects", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectCode: text("projectCode").notNull().unique(),
  title: text("title").notNull(),
  clientId: integer("clientId"),
  description: text("description"),
  services: text("services", { mode: "json" }).$type<string[]>(),
  status: text("status", { enum: ["planning", "in_progress", "on_hold", "completed", "cancelled"] }).default("planning").notNull(),
  startDate: text("startDate"),
  endDate: text("endDate"),
  budget: real("budget"),
  actualCost: real("actualCost").default(0).notNull(),
  revenue: real("revenue"),
  received: real("received").default(0).notNull(),
  outstanding: real("outstanding").default(0).notNull(),
  assignedTo: integer("assignedTo"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).default("medium").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// TASKS
// ============================================================
export const tasks = sqliteTable("tasks", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["todo", "in_progress", "review", "done"] }).default("todo").notNull(),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).default("medium").notNull(),
  assignedTo: integer("assignedTo"),
  contactId: integer("contactId"),
  dealId: integer("dealId"),
  projectId: integer("projectId"),
  dueDate: integer("dueDate", { mode: "timestamp" }),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  createdBy: integer("createdBy").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// SERVICES
// ============================================================
export const services = sqliteTable("services", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category", { enum: ["web_dev", "graphic_design", "business_doc", "tech_services", "creative", "admin", "consultation", "ai_automation", "crm", "data_analytics", "marketing"] }).notNull(),
  description: text("description"),
  priceMin: real("priceMin"),
  priceMax: real("priceMax"),
  pricingUnit: text("pricingUnit", { enum: ["per_hour", "per_project", "per_month", "fixed"] }).default("per_project").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// AI CONVERSATIONS
// ============================================================
export const aiConversations = sqliteTable("ai_conversations", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  title: text("title").notNull(),
  messages: text("messages", { mode: "json" }).$type<{ role: string; content: string; timestamp: string }[]>(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// EMAIL TEMPLATES
// ============================================================
export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  category: text("category", { enum: ["welcome", "follow_up", "proposal", "invoice", "reminder", "custom"] }).default("custom").notNull(),
  createdBy: integer("createdBy"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// MESSAGES (Internal messaging between admins)
// ============================================================
export const messages = sqliteTable("messages", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  senderId: integer("senderId").notNull(),
  senderName: text("senderName").notNull(),
  recipientId: integer("recipientId").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isRead: integer("isRead", { mode: "boolean" }).default(false).notNull(),
  parentId: integer("parentId"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// AUDIT LOG
// ============================================================
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("userId"),
  action: text("action").notNull(),
  entityType: text("entityType").notNull(),
  entityId: integer("entityId"),
  oldValues: text("oldValues", { mode: "json" }),
  newValues: text("newValues", { mode: "json" }),
  ipAddress: text("ipAddress"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================================
// TYPE EXPORTS
// ============================================================
export type User = typeof users.$inferSelect;
export type LocalUser = typeof localUsers.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Service = typeof services.$inferSelect;
export type AIConversation = typeof aiConversations.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
