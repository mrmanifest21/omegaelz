// Simple SQLite helper using better-sqlite3 directly
import { getDb } from "../queries/connection";

export function query(sql: string, params?: any[]) {
  const db = getDb();
  try {
    return db.prepare(sql).all(params || []);
  } catch (e: any) {
    console.error("[DB QUERY ERROR]", sql, e.message);
    throw e;
  }
}

export function queryOne(sql: string, params?: any[]) {
  const db = getDb();
  try {
    return db.prepare(sql).get(params || []) || null;
  } catch (e: any) {
    console.error("[DB QUERY ONE ERROR]", sql, e.message);
    throw e;
  }
}

export function run(sql: string, params?: any[]) {
  const db = getDb();
  try {
    const result = db.prepare(sql).run(params || []);
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  } catch (e: any) {
    console.error("[DB RUN ERROR]", sql, e.message);
    throw e;
  }
}
