import { test } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';

// Ensure test environment
process.env.NODE_ENV = 'test';

// Import route handlers
import { POST as triggerResearch } from '../leads/[id]/research/route';
import { GET as getJobStatus } from '../jobs/[id]/route';
import { jobRuns, researchSnapshots } from '@/db/schema/research';
import { leads, users } from '@/db/schema/core';

class MockD1Database {
  constructor(private sqlite: any) {}

  prepare(query: string) {
    const stmt = this.sqlite.prepare(query);
    
    const createPreparedStatement = (boundParams: any[]): any => {
      return {
        bind: (...params: any[]) => {
          return createPreparedStatement(boundParams.concat(params.flat()));
        },
        all: async () => {
          try {
            const results = stmt.all(...boundParams);
            return { results, success: true };
          } catch (e: any) {
            console.error('SQLite stmt.all error:', e);
            throw new Error(`Failed query: ${query}\nparams: ${boundParams.join(', ')}\n${e.message}`);
          }
        },
        run: async () => {
          try {
            const info = stmt.run(...boundParams);
            return { 
              success: true, 
              meta: {
                changes: info.changes,
                duration: 0,
                last_row_id: info.lastInsertRowid,
              } 
            };
          } catch (e: any) {
            console.error('SQLite stmt.run error:', e);
            throw new Error(`Failed query: ${query}\nparams: ${boundParams.join(', ')}\n${e.message}`);
          }
        },
        first: async () => {
          try {
            return stmt.get(...boundParams);
          } catch (e: any) {
            console.error('SQLite stmt.get error:', e);
            throw new Error(`Failed query: ${query}\nparams: ${boundParams.join(', ')}\n${e.message}`);
          }
        },
        raw: async () => {
          try {
            stmt.raw(true);
            const results = stmt.all(...boundParams);
            stmt.raw(false);
            return results;
          } catch (e: any) {
            console.error('SQLite stmt.raw error:', e);
            throw new Error(`Failed query (raw): ${query}\nparams: ${boundParams.join(', ')}\n${e.message}`);
          }
        }
      };
    };

    return createPreparedStatement([]);
  }

  async exec(query: string) {
    this.sqlite.exec(query);
    return { count: 1, duration: 0 };
  }
}

function setupTestDb() {
  const sqlite = new Database(':memory:');
  
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      city TEXT,
      region TEXT,
      industry TEXT,
      stage TEXT NOT NULL DEFAULT 'New',
      status TEXT NOT NULL DEFAULT 'Active',
      triage_priority TEXT DEFAULT 'UNASSESSED',
      triage_reason TEXT,
      owner_id TEXT REFERENCES users(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      type TEXT NOT NULL,
      summary TEXT NOT NULL,
      timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE provider_configs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL UNIQUE,
      api_key TEXT NOT NULL,
      model_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE job_runs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      target_lead_id TEXT REFERENCES leads(id),
      triggered_by_user_id TEXT REFERENCES users(id),
      error_summary TEXT,
      external_run_id TEXT,
      job_meta TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE research_snapshots (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      created_by_user_id TEXT REFERENCES users(id),
      origin TEXT NOT NULL DEFAULT 'AI_GENERATED',
      snapshot_title TEXT,
      company_summary TEXT,
      products_services_summary TEXT,
      digital_presence_notes TEXT,
      website_notes TEXT,
      branding_notes TEXT,
      pain_points_hypotheses TEXT,
      opportunity_hypotheses TEXT,
      sources TEXT,
      confidence_level TEXT NOT NULL DEFAULT 'UNKNOWN',
      user_remarks TEXT,
      job_run_id TEXT REFERENCES job_runs(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  const mockD1 = new MockD1Database(sqlite);
  return { mockD1, sqlite };
}

test('API Route Handlers & Integration Pipeline', async (t) => {
  const { mockD1, sqlite } = setupTestDb();
  
  // Set the process DB mock by replacing process.env with a plain object to prevent stringification
  process.env = {
    ...process.env,
    DB: mockD1 as any,
  };

  const db = drizzle(sqlite);

  // Setup initial test data
  await db.insert(users).values({
    id: 'user_123',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
  });

  await db.insert(leads).values({
    id: 'lead_123',
    name: 'Stripe Inc',
    company: 'Stripe',
    website: 'stripe.com',
    industry: 'Financial Technology',
  });

  await t.test('POST /api/leads/[id]/research should queue a job and return jobId', async () => {
    const request = new Request('http://localhost/api/leads/lead_123/research', {
      method: 'POST',
    });

    const response = await triggerResearch(request, {
      params: Promise.resolve({ id: 'lead_123' }),
    });

    assert.strictEqual(response.status, 202);
    const body = await response.json() as any;
    assert.ok(body.jobId);

    // Verify job run is queued in DB
    const [job] = await db.select().from(jobRuns).where(eq(jobRuns.id, body.jobId)).limit(1);
    assert.ok(job);
    assert.strictEqual(job.status, 'QUEUED');
    assert.strictEqual(job.targetLeadId, 'lead_123');
  });

  await t.test('GET /api/jobs/[id] should return status of job', async () => {
    // Insert a dummy job run
    await db.insert(jobRuns).values({
      id: 'job_456',
      jobType: 'RESEARCH_GENERATION',
      status: 'RUNNING',
      targetLeadId: 'lead_123',
    });

    const request = new Request('http://localhost/api/jobs/job_456');
    const response = await getJobStatus(request, {
      params: Promise.resolve({ id: 'job_456' }),
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json() as any;
    assert.strictEqual(body.id, 'job_456');
    assert.strictEqual(body.status, 'RUNNING');
  });

  await t.test('POST /api/leads/[id]/research returns existing jobId for in-flight job (idempotency guard)', async () => {
    // At this point, lead_123 already has at least one QUEUED RESEARCH_GENERATION job from the first sub-test.
    // Calling the route again should return an existing jobId without creating a new one.
    const jobsBefore = await db.select().from(jobRuns)
      .where(eq(jobRuns.targetLeadId, 'lead_123'));
    const countBefore = jobsBefore.filter(j =>
      (j.status === 'QUEUED' || j.status === 'RUNNING') && j.jobType === 'RESEARCH_GENERATION'
    ).length;
    assert.ok(countBefore >= 1, 'Expected at least one active RESEARCH_GENERATION job to exist from previous sub-tests');

    const request = new Request('http://localhost/api/leads/lead_123/research', {
      method: 'POST',
    });
    const response = await triggerResearch(request, {
      params: Promise.resolve({ id: 'lead_123' }),
    });

    assert.strictEqual(response.status, 202);
    const body = await response.json() as any;
    assert.ok(body.jobId, 'Should return a jobId');

    // The count of active RESEARCH_GENERATION jobs must NOT have increased — the guard prevented a new one
    const jobsAfter = await db.select().from(jobRuns)
      .where(eq(jobRuns.targetLeadId, 'lead_123'));
    const countAfter = jobsAfter.filter(j =>
      (j.status === 'QUEUED' || j.status === 'RUNNING') && j.jobType === 'RESEARCH_GENERATION'
    ).length;
    assert.strictEqual(countAfter, countBefore, 'Idempotency guard must not create a new job when one is already active');
  });


  await t.test('Local Simulation should run, complete, and create a research snapshot', async () => {
    // Use a separate lead so the idempotency guard does not block this test
    await db.insert(leads).values({
      id: 'lead_sim',
      name: 'Stripe Inc Sim',
      company: 'Stripe',
      website: 'stripe.com',
      industry: 'Financial Technology',
    });

    // Mock global fetch for Jina Reader website scraper
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any) => {
      return {
        ok: true,
        json: async () => ({
          code: 200,
          data: {
            title: 'Stripe | Payments Infrastructure',
            url: 'https://stripe.com',
            content: 'Stripe is a suite of APIs powering online payments and merchant solutions.',
            description: 'Stripe description'
          }
        })
      } as any;
    };

    try {
      const request = new Request('http://localhost/api/leads/lead_sim/research', {
        method: 'POST',
      });

      const response = await triggerResearch(request, {
        params: Promise.resolve({ id: 'lead_sim' }),
      });

      const { jobId } = await response.json() as any;

      // Poll database until the job is completed or fails, up to 2 seconds
      let job = null;
      for (let i = 0; i < 40; i++) {
        const [row] = await db.select().from(jobRuns).where(eq(jobRuns.id, jobId)).limit(1);
        if (row && (row.status === 'COMPLETED' || row.status === 'FAILED')) {
          job = row;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      assert.ok(job, 'Job run was not created or found');
      assert.strictEqual(job.status, 'COMPLETED', `Job failed with error: ${job.errorSummary}`);

      // Verify a research snapshot has been generated and stored
      const snapshots = await db.select().from(researchSnapshots).where(eq(researchSnapshots.leadId, 'lead_sim'));
      assert.strictEqual(snapshots.length, 1);
      assert.strictEqual(snapshots[0].origin, 'AI_GENERATED');
      assert.strictEqual(snapshots[0].snapshotTitle, 'Research Snapshot: Stripe | Payments Infrastructure');
      assert.ok(snapshots[0].companySummary);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

