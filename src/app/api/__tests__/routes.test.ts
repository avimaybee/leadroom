import { test } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';

// Ensure test environment
(process.env as any).NODE_ENV = 'test';
if (!process.env.DB_ENCRYPTION_KEY) {
  (process.env as any).DB_ENCRYPTION_KEY = 'test-encryption-key-for-local-dev-32chars!';
}


// Import route handlers
import { POST as triggerResearch } from '../leads/[id]/research/route';
import { GET as getJobStatus } from '../jobs/[id]/route';
import { jobRuns, researchSnapshots } from '@/db/schema/research';
import { prospects as leads, users } from '@/db/schema/core';
import { MockD1Database } from '@/db/local-mock';

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

    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE offers (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      name TEXT NOT NULL,
      target_pain TEXT,
      desired_outcome TEXT,
      proof_points TEXT,
      forbidden_claims TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE icp_profiles (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      name TEXT NOT NULL,
      positive_signals TEXT,
      negative_signals TEXT,
      disqualifiers TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE markets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      name TEXT NOT NULL,
      icp_profile_id TEXT REFERENCES icp_profiles(id),
      offer_id TEXT REFERENCES offers(id),
      status TEXT DEFAULT 'active',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE prospects (
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
      is_read INTEGER DEFAULT 0 NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      workspace_id TEXT REFERENCES workspaces(id),
      market_id TEXT REFERENCES markets(id),
      fit_score INTEGER,
      confidence_score INTEGER,
      priority_tier TEXT,
      disqualified_reason TEXT,
      fit_reasoning TEXT,
      owner_id TEXT REFERENCES users(id),
      score_dirty INTEGER DEFAULT 1 NOT NULL,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      stage_updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_activity_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES prospects(id),
      type TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata TEXT,
      timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE provider_configs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model_name TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      is_research_active INTEGER DEFAULT 0,
      is_scoring_active INTEGER DEFAULT 0,
      is_drafting_active INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    CREATE UNIQUE INDEX provider_user_idx ON provider_configs(provider, user_id);

    CREATE TABLE job_runs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      target_lead_id TEXT REFERENCES prospects(id),
      triggered_by_user_id TEXT REFERENCES users(id),
      error_summary TEXT,
      external_run_id TEXT,
      job_meta TEXT,
      total_items INTEGER,
      items_processed INTEGER,
      current_stage TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE research_snapshots (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES prospects(id),
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
      content_hash TEXT,
      user_remarks TEXT,
      job_run_id TEXT REFERENCES job_runs(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE contacts (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES prospects(id),
      full_name TEXT,
      role_title TEXT,
      email TEXT,
      phone TEXT,
      linkedin_url TEXT,
      other_profile_url TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      confidence_level TEXT NOT NULL DEFAULT 'UNKNOWN',
      source_type TEXT NOT NULL DEFAULT 'MANUAL',
      created_by_user_id TEXT REFERENCES users(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      deleted_at INTEGER
    );

    CREATE TABLE audits (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES prospects(id),
      created_by_user_id TEXT REFERENCES users(id),
      origin TEXT NOT NULL DEFAULT 'AI_GENERATED',
      key_strengths TEXT,
      key_weaknesses TEXT,
      recommended_improvements TEXT,
      opportunity_notes TEXT,
      content_hash TEXT,
      sources TEXT,
      job_run_id TEXT REFERENCES job_runs(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_run_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      is_read INTEGER DEFAULT 0 NOT NULL,
      link TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE lead_scores (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES prospects(id),
      score_value INTEGER NOT NULL,
      score_label TEXT,
      rationale_summary TEXT,
      factors TEXT,
      origin TEXT NOT NULL DEFAULT 'RULE_BASED',
      is_current INTEGER NOT NULL DEFAULT 1,
      created_by_user_id TEXT REFERENCES users(id),
      job_run_id TEXT REFERENCES job_runs(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE discovery_scopes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      industry_filter TEXT,
      geography_filter TEXT,
      company_size_filter TEXT,
      business_type_filter TEXT,
      digital_presence_filter TEXT,
      notes TEXT,
      auto_research_promoted_leads INTEGER DEFAULT 1 NOT NULL,
      created_by_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE candidate_leads (
      id TEXT PRIMARY KEY,
      discovery_scope_id TEXT REFERENCES discovery_scopes(id),
      raw_name TEXT NOT NULL,
      raw_website_url TEXT,
      raw_contact_info TEXT,
      raw_location TEXT,
      notes TEXT,
      status TEXT DEFAULT 'NEW' NOT NULL,
      promoted_lead_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE lead_stage_history (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES prospects(id),
      stage TEXT NOT NULL,
      entered_at INTEGER,
      exited_at INTEGER
    );

    CREATE TABLE research_tasks (
      id TEXT PRIMARY KEY,
      prospect_id TEXT NOT NULL REFERENCES prospects(id),
      task_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      raw_artifacts TEXT,
      extracted_signals TEXT,
      confidence INTEGER,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      started_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE pipeline_config (
      id TEXT PRIMARY KEY DEFAULT 'global',
      enforce_stage_order INTEGER NOT NULL DEFAULT 0,
      nba_rules TEXT,
      stage_requirements TEXT,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE activity_metadata (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id),
      metadata TEXT NOT NULL
    );

    CREATE TABLE nba_action_logs (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES prospects(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      signal TEXT NOT NULL,
      action_taken_at INTEGER,
      result_stage_target TEXT,
      result_stage_reached_at INTEGER
    );

    CREATE TABLE playbooks (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER
    );

    CREATE TABLE playbook_tasks (
      id TEXT PRIMARY KEY,
      playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      days_offset INTEGER NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium',
      category TEXT,
      action_type TEXT NOT NULL DEFAULT 'TASK',
      job_type TEXT
    );

    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      lead_id TEXT REFERENCES prospects(id),
      due_date INTEGER,
      status TEXT NOT NULL DEFAULT 'Open',
      is_read INTEGER DEFAULT 0 NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium',
      assignee_id TEXT REFERENCES users(id),
      category TEXT,
      source TEXT,
      playbook_id TEXT REFERENCES playbooks(id),
      google_calendar_event_id TEXT,
      google_calendar_sync_status TEXT DEFAULT 'PENDING',
      google_calendar_sync_error TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      completed_at INTEGER
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

    const response = await triggerResearch(request as any, {
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
      triggeredByUserId: 'user_123',
    });

    const request = new Request('http://localhost/api/jobs/job_456');
    const response = await getJobStatus(request as any, {
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
    const response = await triggerResearch(request as any, {
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
    process.env.GEMINI_API_KEY = 'mock_key';

    // Use a separate lead so the idempotency guard does not block this test
    await db.insert(leads).values({
      id: 'lead_sim',
      name: 'Stripe Inc Sim',
      company: 'Stripe',
      website: 'stripe.com',
      industry: 'Financial Technology',
    });

    // Mock global fetch for Jina Reader website scraper and Gemini API
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        companySummary: 'Stripe is a payments infrastructure company.',
                        productsServicesSummary: 'Payments API, Billing, Checkout.',
                        digitalPresenceNotes: 'Active on Twitter and LinkedIn.',
                        websiteNotes: 'Very clean landing page.',
                        brandingNotes: 'Excellent branding.',
                        painPointsHypotheses: '- Some pain point',
                        opportunityHypotheses: '- Some opportunity',
                        confidenceLevel: 'HIGH',
                        keyStrengths: '- Fast load times',
                        keyWeaknesses: '- High fees',
                        recommendedImprovements: '- Lower fees',
                        contacts: {
                          people: [],
                          socialLinks: {},
                          emails: [],
                          phones: []
                        },
                        sources: ['https://stripe.com']
                      })
                    }
                  ]
                }
              }
            ]
          })
        } as any;
      }

      // Mock Jina Reader response with streaming body support
      const jinaData = JSON.stringify({
        code: 200,
        status: 20000,
        data: {
          title: 'Stripe | Payments Infrastructure',
          url: 'https://stripe.com',
          content: 'Stripe is a suite of APIs powering online payments and merchant solutions.',
          description: 'Stripe description'
        }
      });
      const encoder = new TextEncoder();
      let readCalled = false;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) => null
        },
        body: {
          getReader: () => {
            return {
              read: async () => {
                if (readCalled) return { done: true, value: undefined };
                readCalled = true;
                return { done: false, value: encoder.encode(jinaData) };
              },
              cancel: () => {}
            };
          }
        }
      } as any;
    };

    try {
      const request = new Request('http://localhost/api/leads/lead_sim/research', {
        method: 'POST',
      });

    const response = await triggerResearch(request as any, {
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

