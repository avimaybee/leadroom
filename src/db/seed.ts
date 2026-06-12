import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';

function seed() {
  const dbDir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const files = fs.readdirSync(dbDir);
  const sqliteFile = files.find((f) => f.endsWith('.sqlite')) || 'local-db.sqlite';
  const dbPath = path.join(dbDir, sqliteFile);

  console.log('Seeding database at:', dbPath);
  const db = new Database(dbPath);

  // Check if users table exists
  const hasUsersTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();

  if (!hasUsersTable) {
    console.error('Error: "users" table does not exist. Please generate and apply migrations first:');
    console.error('  npm run db:generate && npm run db:migrate');
    process.exit(1);
  }

  const userCount = (db.prepare('SELECT count(*) as count FROM users').get() as any).count;

  if (userCount === 0) {
    const userId = crypto.randomUUID();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
    const hashedPassword = `${salt}:${hash}`;
    
    db.prepare(
      'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)'
    ).run(userId, 'Default Admin', 'admin@agency.com', hashedPassword);
    
    console.log('Successfully seeded default administrator user:');
    console.log('  Email:    admin@agency.com');
    console.log('  Password: admin123');
  } else {
    console.log('Database already contains user records. Seeding skipped.');
  }
}

seed();
