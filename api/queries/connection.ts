import Database from "better-sqlite3";

// Singleton database connection
let db: any = null;

function createDb() {
  // Get path from DATABASE_URL env var
  const rawUrl = process.env.DATABASE_URL || "sqlite://./omegaelz.db";
  const dbPath = rawUrl.replace("sqlite://", "").replace("sqlite:", "");

  console.log("[DB] Connecting to:", dbPath);

  // Ensure parent directory exists
  const fs = require("fs");
  const path = require("path");
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const client = new Database(dbPath);
  client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");

  return client;
}

export function getDb() {
  if (!db) {
    db = createDb();
  }
  return db;
}
