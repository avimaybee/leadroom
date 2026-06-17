// Dynamic imports are used inside setupLocalDatabaseMock to prevent loading Node.js modules in Edge/Workers.

class MockD1PreparedStatement {
  constructor(private stmt: any, private params: any[] = []) {}

  bind(...params: any[]) {
    return new MockD1PreparedStatement(this.stmt, params);
  }

  async all() {
    try {
      const results = this.stmt.all(...this.params);
      return { results, success: true };
    } catch (e: any) {
      console.error('Mock D1 PreparedStatement all() failed:', e);
      throw e;
    }
  }

  async run() {
    try {
      const result = this.stmt.run(...this.params);
      return { 
        success: true,
        meta: {
          changes: result.changes,
          duration: 0,
          last_row_id: result.lastInsertRowid,
        }
      };
    } catch (e: any) {
      console.error('Mock D1 PreparedStatement run() failed:', e);
      throw e;
    }
  }

  async first(key?: string) {
    try {
      const row = this.stmt.get(...this.params);
      if (!row) return null;
      if (key) return row[key];
      return row;
    } catch (e: any) {
      console.error('Mock D1 PreparedStatement first() failed:', e);
      throw e;
    }
  }

  async raw() {
    try {
      const rows = this.stmt.raw(...this.params);
      return rows;
    } catch (e: any) {
      console.error('Mock D1 PreparedStatement raw() failed:', e);
      throw e;
    }
  }
}

class MockD1Database {
  constructor(private db: any) {}

  prepare(query: string) {
    const stmt = this.db.prepare(query);
    return new MockD1PreparedStatement(stmt);
  }

  async batch(statements: MockD1PreparedStatement[]) {
    const results: any[] = [];
    const runBatch = this.db.transaction(() => {
      for (const stmt of statements) {
        const res = (stmt as any).stmt.all(...(stmt as any).params);
        results.push({ results: res, success: true });
      }
    });
    runBatch();
    return results;
  }

  async exec(query: string) {
    this.db.exec(query);
    return { count: 0, duration: 0 };
  }
}

export function setupLocalDatabaseMock() {
  const req = typeof require !== 'undefined' ? require : undefined;
  if (!req) {
    console.warn('Node.js require is not available. Skipping local database mock setup.');
    return;
  }

  const Database = req('better-sqlite3');
  const path = req('path');
  const fs = req('fs');

  const baseDir = path.resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  let dbPath = '';

  if (fs.existsSync(baseDir)) {
    const files = fs.readdirSync(baseDir)
      .filter((f: string) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
      .map((f: string) => ({
        name: f,
        path: path.join(baseDir, f),
        mtime: fs.statSync(path.join(baseDir, f)).mtimeMs,
      }))
      .sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime);

    // Pick the newest .sqlite file (wrangler creates new files on each run)
    if (files.length > 0) {
      dbPath = files[0].path;
    }
  }

  if (!dbPath) {
    const fallbackPath = path.resolve(process.cwd(), '.wrangler/local-fallback.sqlite');
    const dir = path.dirname(fallbackPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    dbPath = fallbackPath;
  }

  const sqlite = new Database(dbPath);

  // Apply pending column migrations idempotently (safe even if columns exist)
  const migrationStmts = [
    `ALTER TABLE leads ADD COLUMN is_read integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE tasks ADD COLUMN is_read integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE outreach_drafts ADD COLUMN is_read integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE audits ADD COLUMN is_modern integer`,
    `ALTER TABLE audits ADD COLUMN triage_reason text`,
  ];
  for (const stmt of migrationStmts) {
    try { sqlite.exec(stmt); } catch { /* column already exists — safe to ignore */ }
  }

  const mockD1 = new MockD1Database(sqlite);

  // Inject the mock into the process env
  (process as any).env.DB = mockD1;
}
