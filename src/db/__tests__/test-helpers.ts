import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';

if (!process.env.DB_ENCRYPTION_KEY) {
  process.env.DB_ENCRYPTION_KEY = 'test-encryption-key-for-local-dev-32chars!';
}

export function setupTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  
  // Polyfill Drizzle's D1 .batch() function which is missing on better-sqlite3 db instances
  (db as any).batch = async (queries: any[]) => {
    const results = [];
    for (const q of queries) {
      results.push(await q);
    }
    return results;
  };

  // Polyfill async transactions for better-sqlite3 to emulate D1's async transactions
  db.transaction = async function(cb: any) {
    sqlite.exec('BEGIN TRANSACTION');
    try {
      const result = await cb(db);
      sqlite.exec('COMMIT');
      return result;
    } catch (e) {
      try {
        sqlite.exec('ROLLBACK');
      } catch {}
      throw e;
    }
  } as any;
  
  // Dynamically run all Drizzle migrations to ensure the test schema matches production perfectly.
  // We use sqlite.exec() directly to support multi-statement SQL files (like 0030_add_missing_indexes.sql).
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const journalPath = path.join(migrationsDir, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  
  for (const entry of journal.entries) {
    const migrationFile = path.join(migrationsDir, `${entry.tag}.sql`);
    const sql = fs.readFileSync(migrationFile, 'utf8');
    sqlite.exec(sql);
  }
  
  return { db, sqlite };
}
