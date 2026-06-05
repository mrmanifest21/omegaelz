import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = path.resolve(__dirname, "../dist/public");
const dbPath = process.env.DATABASE_URL?.replace("sqlite://", "") || "./omegaelz.db";

console.log("[BOOT] OmegaElz CRM starting...");
console.log("[BOOT] PORT:", process.env.PORT || "3000");
console.log("[BOOT] DB path:", dbPath);

// ============================================================
// SQLITE AUTO SETUP
// ============================================================
function autoSetup() {
  try {
    const exists = fs.existsSync(dbPath);
    const db = new Database(dbPath);
    db.exec("PRAGMA journal_mode = WAL;");

    if (exists) {
      try {
        const check = db.prepare("SELECT id FROM local_users WHERE username = ?").get("admin1");
        if (check) {
          console.log("[SETUP] Already initialized.");
          db.close();
          return;
        }
      } catch { /* table doesn't exist yet */ }
    }

    console.log("[SETUP] First boot - creating tables...");

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unionId TEXT NOT NULL UNIQUE,
        name TEXT,
        email TEXT,
        avatar TEXT,
        role TEXT DEFAULT 'sales' NOT NULL,
        phone TEXT,
        department TEXT,
        isActive INTEGER DEFAULT 1 NOT NULL,
        createdAt INTEGER DEFAULT (unixepoch()),
        updatedAt INTEGER DEFAULT (unixepoch()),
        lastSignInAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS local_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        name TEXT,
        email TEXT,
        role TEXT DEFAULT 'sales' NOT NULL,
        phone TEXT,
        department TEXT,
        isActive INTEGER DEFAULT 1 NOT NULL,
        createdAt INTEGER DEFAULT (unixepoch()),
        updatedAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        company TEXT,
        jobTitle TEXT,
        status TEXT DEFAULT 'lead' NOT NULL,
        source TEXT DEFAULT 'other' NOT NULL,
        score INTEGER DEFAULT 0 NOT NULL,
        assignedTo INTEGER,
        lastActivityAt INTEGER,
        notes TEXT,
        address TEXT,
        city TEXT,
        country TEXT DEFAULT 'South Africa',
        createdAt INTEGER DEFAULT (unixepoch()),
        updatedAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        contactId INTEGER,
        company TEXT,
        value REAL NOT NULL,
        currency TEXT DEFAULT 'ZAR' NOT NULL,
        stage TEXT DEFAULT 'new' NOT NULL,
        probability INTEGER DEFAULT 0 NOT NULL,
        expectedCloseDate TEXT,
        actualCloseDate TEXT,
        description TEXT,
        assignedTo INTEGER,
        source TEXT,
        competitor TEXT,
        createdAt INTEGER DEFAULT (unixepoch()),
        updatedAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        contactId INTEGER,
        dealId INTEGER,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        dueDate INTEGER,
        completedAt INTEGER,
        status TEXT DEFAULT 'pending' NOT NULL,
        duration INTEGER,
        createdAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectCode TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        clientId INTEGER,
        description TEXT,
        services TEXT,
        status TEXT DEFAULT 'planning' NOT NULL,
        startDate TEXT,
        endDate TEXT,
        budget REAL,
        actualCost REAL DEFAULT 0 NOT NULL,
        revenue REAL,
        received REAL DEFAULT 0 NOT NULL,
        outstanding REAL DEFAULT 0 NOT NULL,
        assignedTo INTEGER,
        priority TEXT DEFAULT 'medium' NOT NULL,
        createdAt INTEGER DEFAULT (unixepoch()),
        updatedAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo' NOT NULL,
        priority TEXT DEFAULT 'medium' NOT NULL,
        assignedTo INTEGER,
        contactId INTEGER,
        dealId INTEGER,
        projectId INTEGER,
        dueDate INTEGER,
        completedAt INTEGER,
        createdBy INTEGER NOT NULL,
        createdAt INTEGER DEFAULT (unixepoch()),
        updatedAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        priceMin REAL,
        priceMax REAL,
        pricingUnit TEXT DEFAULT 'per_project' NOT NULL,
        isActive INTEGER DEFAULT 1 NOT NULL,
        createdAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        senderId INTEGER NOT NULL,
        senderName TEXT NOT NULL,
        recipientId INTEGER NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        isRead INTEGER DEFAULT 0 NOT NULL,
        parentId INTEGER,
        createdAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS ai_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        messages TEXT,
        createdAt INTEGER DEFAULT (unixepoch()),
        updatedAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS email_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        category TEXT DEFAULT 'custom' NOT NULL,
        createdBy INTEGER,
        createdAt INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        action TEXT NOT NULL,
        entityType TEXT NOT NULL,
        entityId INTEGER,
        oldValues TEXT,
        newValues TEXT,
        ipAddress TEXT,
        createdAt INTEGER DEFAULT (unixepoch())
      );
    `);

    // Seed admin accounts
    const hash1 = bcrypt.hashSync("admin123", 10);
    const hash2 = bcrypt.hashSync("admin456", 10);

    db.prepare("INSERT INTO local_users (username, passwordHash, name, email, role, department, isActive) VALUES (?,?,?,?,?,?,?)")
      .run("admin1", hash1, "Daniel Menji", "daniel@omegaelz.co.za", "admin", "Management", 1);
    console.log("[SETUP] admin1 created: daniel / admin123");

    db.prepare("INSERT INTO local_users (username, passwordHash, name, email, role, department, isActive) VALUES (?,?,?,?,?,?,?)")
      .run("admin2", hash2, "Temosho", "temosho@omegaelz.co.za", "admin", "Management", 1);
    console.log("[SETUP] admin2 created: temosho / admin456");

    // Seed contacts
    const contactsData = [
      ["SABSA","Representative","info@sabsa.co.za","+27 11 123 4567","SABSA","IT Manager","customer","referral",85,1,"Johannesburg","South Africa","Website development, business email, social media management"],
      ["Lizorah","Brand Manager","contact@lizorah.com","+27 82 345 6789","Lizorah Brand","Brand Director","customer","website",72,1,"Pretoria","South Africa","Website development, business registration, social media"],
      ["Thabo","Chibuwe","thabo@chibuwec.co.za","+27 71 456 7890","Chibuwe Construction","Owner","customer","cold_call",90,1,"Johannesburg","South Africa","Website development, domain hosting, business email setup"],
      ["Beast","Initiatives","info@beastinitiatives.com","+27 63 567 8901","BeastInitiatives","Founder","customer","social",95,1,"Cape Town","South Africa","Website design, operational strategy, digital consultation"],
      ["Sarah","Mokoena","sarah@techstart.co.za","+27 72 678 9012","TechStart SA","CEO","lead","event",45,1,"Durban","South Africa","Interested in AI automation package"],
      ["David","van der Merwe","david@vanderconsulting.co.za","+27 83 789 0123","Van der Merwe Consulting","Managing Director","prospect","referral",68,1,"Pretoria","South Africa","CRM implementation and business documentation"],
      ["Nomsa","Dlamini","nomsa@dlaminidesigns.co.za","+27 64 890 1234","Dlamini Designs","Creative Director","lead","social",38,1,"Johannesburg","South Africa","Graphic design agency looking for web dev partnership"],
      ["Peter","Okafor","peter@globaltrade.ng","+234 80 901 2345","Global Trade Nigeria","Operations Manager","lead","website",55,1,"Lagos","Nigeria","Business documentation and company registration"],
      ["Anne-Marie","du Preez","am@dupreezlegal.co.za","+27 71 012 3456","Du Preez Legal","Partner","prospect","referral",78,1,"Cape Town","South Africa","Law firm needing IT support and cloud migration"],
      ["Kabelo","Mashaba","kabelo@mashabafitness.co.za","+27 82 123 4567","Mashaba Fitness","Owner","lead","cold_call",30,1,"Bloemfontein","South Africa","Fitness brand startup needing logo, website, social media"],
    ];
    const insertContact = db.prepare("INSERT INTO contacts (firstName,lastName,email,phone,company,jobTitle,status,source,score,assignedTo,city,country,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
    for (const c of contactsData) insertContact.run(c);
    console.log("[SETUP] 10 contacts seeded");

    // Seed deals
    const dealsData = [
      ["SABSA Website & Digital Package",1,"SABSA",4050,"ZAR","negotiation",85,"2026-06-15",null,"Website development, business email, social media, domain, hosting",1],
      ["Lizorah Brand Digital Transformation",2,"Lizorah Brand",3000,"ZAR","proposal",60,"2026-07-01",null,"Website development, business registration, social media",1],
      ["Chibuwe Construction Web Package",3,"Chibuwe Construction",1050,"ZAR","won",100,"2026-05-30","2026-05-29","Website development, domain hosting, business email",1],
      ["BeastInitiatives Global Strategy",4,"BeastInitiatives",11069.73,"ZAR","won",100,"2026-05-15","2026-05-10","Website design, operational strategy, digital consultation",1],
      ["TechStart AI Automation Package",5,"TechStart SA",8500,"ZAR","qualified",40,"2026-07-30",null,"AI chatbot, workflow automation, email management, CRM setup",1],
      ["Van der Merwe CRM Implementation",6,"Van der Merwe Consulting",12500,"ZAR","proposal",55,"2026-08-15",null,"CRM system implementation, business documentation, workflow automation",1],
      ["Dlamini Design Partnership",7,"Dlamini Designs",4500,"ZAR","new",25,"2026-09-01",null,"Web development partnership for design clients",1],
      ["Global Trade Business Setup",8,"Global Trade Nigeria",7500,"ZAR","qualified",45,"2026-08-30",null,"Company registration, business documentation, compliance",1],
      ["Du Preez Legal IT Migration",9,"Du Preez Legal",18000,"ZAR","proposal",70,"2026-07-20",null,"IT support, cloud migration, network setup, security",1],
      ["Mashaba Fitness Startup Package",10,"Mashaba Fitness",2800,"ZAR","new",20,"2026-09-15",null,"Logo design, website, social media management",1],
    ];
    const insertDeal = db.prepare("INSERT INTO deals (title,contactId,company,value,currency,stage,probability,expectedCloseDate,actualCloseDate,description,assignedTo) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    for (const d of dealsData) insertDeal.run(d);
    console.log("[SETUP] 10 deals seeded");

    // Seed projects
    db.exec(`INSERT INTO projects (projectCode,title,clientId,description,services,status,startDate,endDate,budget,revenue,received,outstanding,priority) VALUES
      ('OE001','SABSA Digital Presence',1,'Complete digital transformation','["Website Development","Business Email","Social Media Management","Domain Registration","Hosting"]','in_progress','2026-05-04','2026-06-07',4500,4050,3500,550,'high'),
      ('OE002','Lizorah Brand Launch',2,'Brand development and digital launch','["Website Development","Business Registration","Social Media Creation","Social Media Optimization"]','in_progress','2026-02-06','2026-07-15',3500,3000,0,3000,'medium'),
      ('OE003','Chibuwe Construction Web Setup',3,'Rapid website deployment','["Website Development","Domain Hosting","Business Email","Social Media Creation"]','completed','2026-05-28','2026-05-29',1200,1050,1050,0,'high'),
      ('OE004','BeastInitiatives Global Strategy',4,'International client strategy','["Website Design","Operational Strategy","Digital Business Consultation"]','completed','2026-03-01','2026-05-10',12000,11069.73,11069.73,0,'urgent'),
      ('OE005','TechStart AI Integration',5,'AI automation implementation','["AI Chatbot","Workflow Automation","AI Email Management","Basic CRM Setup"]','planning','2026-07-01','2026-08-30',10000,8500,0,8500,'medium'),
      ('OE006','Van der Merwe Digital Office',6,'Complete digital office setup','["CRM Implementation","Business Documentation","Workflow Automation","Cloud Solutions"]','planning','2026-07-15','2026-09-30',15000,12500,0,12500,'high')`);
    console.log("[SETUP] 6 projects seeded");

    // Seed tasks
    db.exec(`INSERT INTO tasks (title,description,status,priority,dueDate,contactId,projectId,createdBy) VALUES
      ('Complete SABSA website homepage','Finalize the homepage layout and responsive design','in_progress','high',1749081600,1,1,1),
      ('Setup business email for SABSA','Configure Google Workspace email accounts','todo','medium',1749168000,1,1,1),
      ('Lizorah brand identity review','Review and finalize brand guidelines','todo','medium',1749513600,2,2,1),
      ('Submit business registration docs','Complete CIPC registration process','todo','high',1749945600,2,2,1),
      ('Follow up with TechStart AI proposal','Send detailed AI automation proposal','todo','high',1749686400,5,NULL,1),
      ('Prepare CRM demo for Van der Merwe','Create personalized CRM demonstration','todo','medium',1750032000,6,NULL,1),
      ('Design Mashaba Fitness logo concepts','Create 3-5 logo design concepts','todo','low',1750291200,10,NULL,1),
      ('Du Preez Legal IT assessment','On-site IT infrastructure assessment','todo','high',1749945600,9,NULL,1),
      ('Monthly social media content for SABSA','Create and schedule June social media posts','review','medium',1749168000,1,1,1),
      ('Update OmegaElz service catalog','Add new AI services to the catalog','done','low',1749168000,NULL,NULL,1),
      ('Send invoice for Chibuwe project','Issue final invoice for completed work','done','medium',1749168000,3,3,1),
      ('BeastInitiatives project handover','Complete project documentation and handover','done','high',1749168000,4,4,1)`);
    console.log("[SETUP] 12 tasks seeded");

    // Seed services
    db.exec(`INSERT INTO services (name,category,description,priceMin,priceMax,pricingUnit) VALUES
      ('Website Design (Basic)','web_dev','3-5 page responsive website with basic SEO',1500,3500,'per_project'),
      ('Website Design (Advanced)','web_dev','5-10 page website with advanced features',3500,7000,'per_project'),
      ('E-commerce Development','web_dev','Full online store with payment integration',6000,15000,'per_project'),
      ('Logo Design','graphic_design','Professional logo with 3-5 concepts',500,1200,'fixed'),
      ('Brand Identity Package','graphic_design','Complete branding solution',6000,18000,'per_project'),
      ('Social Media Management','marketing','Content creation and platform management',1500,3500,'per_month'),
      ('Company Registration','business_doc','CIPC company registration and incorporation',1750,3500,'fixed'),
      ('Business Plan Development','business_doc','Comprehensive business plan with financials',800,2500,'per_project'),
      ('IT Support','tech_services','Remote technical support and troubleshooting',120,250,'per_hour'),
      ('Network Setup','tech_services','Office network infrastructure setup',2500,8000,'per_project'),
      ('Cloud Migration','tech_services','Data and systems migration to cloud',8000,18000,'per_project'),
      ('Video Editing','creative','Professional video editing services',300,800,'per_hour'),
      ('Virtual Assistant','admin','Remote administrative support',120,300,'per_hour'),
      ('Business Consultation','consultation','Strategic business planning and advice',500,1200,'per_hour'),
      ('AI Chatbot Development','ai_automation','Custom AI chatbot for customer engagement',7500,75000,'per_project'),
      ('Workflow Automation','ai_automation','Business process automation setup',3500,15000,'per_project'),
      ('CRM Implementation','crm','CRM system setup and configuration',5500,25000,'per_project'),
      ('Data Analytics Setup','data_analytics','Business intelligence and analytics dashboard',10000,45000,'per_project'),
      ('AI Content Generation','ai_automation','AI-powered content creation',2500,8000,'per_month'),
      ('SEO Optimization','marketing','Search engine optimization services',5000,18000,'per_month')`);
    console.log("[SETUP] 20 services seeded");

    // Seed activities
    db.exec(`INSERT INTO activities (type,contactId,dealId,userId,title,description,status,duration) VALUES
      ('email',1,1,1,'Sent website mockup to SABSA','Shared Figma designs for review','completed',NULL),
      ('call',2,2,1,'Discovery call with Lizorah Brand','Discussed brand requirements and timeline','completed',45),
      ('meeting',5,5,1,'AI demo for TechStart','Presented AI automation capabilities','completed',60),
      ('note',9,9,1,'Du Preez requirements gathered','IT infrastructure needs documented','completed',NULL),
      ('task',6,6,1,'Send CRM proposal to Van der Merwe','Include pricing and implementation timeline','pending',NULL),
      ('email',3,NULL,1,'Chibuwe project completion email','Sent final deliverables and login credentials','completed',NULL),
      ('call',8,8,1,'Follow-up with Global Trade Nigeria','Discussed documentation requirements','completed',30),
      ('meeting',4,NULL,1,'BeastInitiatives strategy session','Final review of operational strategy document','completed',90)`);
    console.log("[SETUP] 8 activities seeded");

    // Seed messages between admins
    const a1 = db.prepare("SELECT id FROM local_users WHERE username = 'admin1'").get() as any;
    const a2 = db.prepare("SELECT id FROM local_users WHERE username = 'admin2'").get() as any;
    if (a1 && a2) {
      db.prepare("INSERT INTO messages (senderId, senderName, recipientId, subject, body, isRead) VALUES (?,?,?,?,?,?)")
        .run(a1.id, "Daniel Menji", a2.id, "Welcome to OmegaElz CRM", "Hi Temosho,\n\nThe CRM is now live! We can use this to manage all our clients, projects, and deals. Let me know if you need any help getting started.\n\n- Daniel", 0);
      db.prepare("INSERT INTO messages (senderId, senderName, recipientId, subject, body, isRead) VALUES (?,?,?,?,?,?)")
        .run(a2.id, "Temosho", a1.id, "RE: Welcome to OmegaElz CRM", "Hi Daniel,\n\nThanks for setting this up! It looks great. I will start adding our active deals and updating the pipeline.\n\n- Temosho", 0);
      console.log("[SETUP] 2 messages seeded");
    }

    // Seed email templates
    db.exec(`INSERT INTO email_templates (name,subject,body,category) VALUES
      ('Welcome Email','Welcome to OmegaElz - Your Digital Success Starts Here','Welcome to OmegaElz! Thank you for choosing us for your digital solutions.','welcome'),
      ('Follow-up Template','Following up on our recent conversation','Hi, I wanted to follow up on our recent conversation.','follow_up'),
      ('Proposal Template','Your Custom Proposal from OmegaElz','Please find attached our detailed proposal for your project.','proposal'),
      ('Invoice Reminder','Payment Reminder','This is a friendly reminder about your outstanding invoice.','invoice'),
      ('Task Reminder','Reminder: Task due soon','This is a reminder that your task is due soon.','reminder')`);
    console.log("[SETUP] 5 email templates seeded");

    db.close();
    console.log("[SETUP] COMPLETE - Everything ready!");
  } catch (e: any) {
    console.error("[SETUP] FAILED:", e.message);
    console.error(e.stack);
  }
}

autoSetup();

// ============================================================
// HONO APP
// ============================================================
const app = new Hono();
app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// OAuth callback
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// Health check
app.get("/health", (c) => c.json({ ok: true, db: "sqlite", ts: Date.now() }));

// tRPC API
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({ endpoint: "/api/trpc", req: c.req.raw, router: appRouter, createContext });
});

// API 404
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// Static files
if (fs.existsSync(publicDir)) {
  const rel = path.relative(process.cwd(), publicDir) || "dist/public";
  app.use("/assets/*", serveStatic({ root: rel }));
  app.get("*", (c) => {
    const idx = path.join(publicDir, "index.html");
    if (fs.existsSync(idx)) return c.html(fs.readFileSync(idx, "utf-8"));
    return c.json({ error: "No index.html" }, 500);
  });
} else {
  app.get("*", (c) => c.json({ error: "Frontend not built" }, 500));
}

const port = parseInt(process.env.PORT || "3000");
serve({ fetch: app.fetch, port }, () => {
  console.log(`[BOOT] Server running on port ${port}`);
});

export default app;
