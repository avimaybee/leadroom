import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

if (!process.env.DB_ENCRYPTION_KEY) {
  process.env.DB_ENCRYPTION_KEY = 'test-encryption-key-for-local-dev-32chars!';
}

export function setupTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  
  // Dynamically run all Drizzle migrations to ensure the test schema matches production perfectly
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'migrations') });
  
  return { db, sqlite };
}
