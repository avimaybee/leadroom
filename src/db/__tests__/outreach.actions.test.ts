import { test } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';

// Setup environment variable so getDb works
process.env.AUTH_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
(process.env as any).NODE_ENV = 'test';
(globalThis as any).mockUserId = 'user-admin';

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

  CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id),
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
    job_run_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE audits (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id),
    created_by_user_id TEXT REFERENCES users(id),
    origin TEXT NOT NULL DEFAULT 'AI_GENERATED',
    website_quality_score INTEGER,
    design_aesthetic_score INTEGER,
    messaging_clarity_score INTEGER,
    social_presence_score INTEGER,
    overall_branding_score INTEGER,
    key_strengths TEXT,
    key_weaknesses TEXT,
    recommended_improvements TEXT,
    opportunity_notes TEXT,
    sources TEXT,
    job_run_id TEXT,
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

  CREATE TABLE lead_scores (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id),
    score_value INTEGER NOT NULL,
    score_label TEXT,
    rationale_summary TEXT,
    factors TEXT,
    origin TEXT NOT NULL DEFAULT 'RULE_BASED',
    is_current INTEGER NOT NULL DEFAULT 1,
    created_by_user_id TEXT REFERENCES users(id),
    job_run_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
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

    CREATE TABLE outreach_drafts (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      channel TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'DRAFT' NOT NULL,
      origin TEXT DEFAULT 'AI_GENERATED' NOT NULL,
      created_by_user_id TEXT REFERENCES users(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      attachments TEXT
    );

  CREATE TABLE approvals (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL REFERENCES outreach_drafts(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    decision TEXT NOT NULL,
    feedback TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
`);

// Set process.env.DB to our mock D1 database before loading getDb
const mockD1 = new MockD1Database(sqlite);
process.env = {
  ...process.env,
  DB: mockD1 as any,
};

import { getDb } from '../../db';
const testDb = getDb();

import {
  generateOutreachDraftAction,
  updateDraftAction,
  recordApprovalAction,
  markAsSentAction,
  duplicateDraftAction,
  deleteDraftAction,
} from '../../app/actions/outreach';

import { users, leads, outreachDrafts, approvals, activities } from '../schema';

test('Outreach Server Actions Integration', async (t) => {
  // Seed test database
  await testDb.insert(users).values({
    id: 'user-admin',
    name: 'Admin User',
    email: 'admin@leadroom.com',
    password: 'hashed-password',
  });

  await testDb.insert(leads).values({
    id: 'lead-client',
    name: 'Client Business Inc',
    website: 'clientbusiness.com',
    stage: 'Researching',
    status: 'Active',
  });

  let draftId = '';

  await t.test('generateOutreachDraftAction should trigger AI generation and save draft', async () => {
    const result = await generateOutreachDraftAction('lead-client', 'EMAIL');
    console.log('generateOutreachDraftAction result:', result);
    assert.ok(result.success);
    assert.ok(result.drafts && result.drafts.length > 0);
    assert.strictEqual(result.drafts![0].channel, 'EMAIL');
    assert.strictEqual(result.drafts![0].status, 'DRAFT');
    assert.ok(result.drafts![0].id);
    draftId = result.drafts![0].id;

    // Verify activity logged
    const activitiesList = await testDb.select().from(activities).where(eq(activities.leadId, 'lead-client'));
    assert.ok(activitiesList.some(a => a.type === 'Outreach draft created'));
  });

  await t.test('updateDraftAction should allow editing subject and body', async () => {
    const result = await updateDraftAction(draftId, 'New Subject', 'New Body Content');
    assert.ok(result.success);

    const [draft] = await testDb.select().from(outreachDrafts).where(eq(outreachDrafts.id, draftId)).limit(1);
    assert.strictEqual(draft.subject, 'New Subject');
    assert.strictEqual(draft.body, 'New Body Content');
  });

  await t.test('recordApprovalAction should record APPROVED and transition draft status', async () => {
    const result = await recordApprovalAction(draftId, 'APPROVED', 'Looks good!');
    assert.ok(result.success);

    const [draft] = await testDb.select().from(outreachDrafts).where(eq(outreachDrafts.id, draftId)).limit(1);
    assert.strictEqual(draft.status, 'APPROVED');

    const [approval] = await testDb.select().from(approvals).where(eq(approvals.draftId, draftId)).limit(1);
    assert.ok(approval);
    assert.strictEqual(approval.decision, 'APPROVED');
    assert.strictEqual(approval.feedback, 'Looks good!');
  });

  await t.test('markAsSentAction should update status to SENT', async () => {
    const result = await markAsSentAction(draftId);
    assert.ok(result.success);

    const [draft] = await testDb.select().from(outreachDrafts).where(eq(outreachDrafts.id, draftId)).limit(1);
    assert.strictEqual(draft.status, 'SENT');
  });

  await t.test('duplicateDraftAction should clone a draft into DRAFT status and preserve original values', async () => {
    const result = await duplicateDraftAction(draftId);
    assert.ok(result.success);
    assert.ok(result.draft);
    assert.notStrictEqual(result.draft.id, draftId);
    assert.strictEqual(result.draft.channel, 'EMAIL');
    assert.strictEqual(result.draft.status, 'DRAFT');
    assert.strictEqual(result.draft.subject, 'New Subject');
    assert.strictEqual(result.draft.body, 'New Body Content');

    // Verify activity logged for new draft creation
    const activitiesList = await testDb.select().from(activities).where(eq(activities.leadId, 'lead-client'));
    assert.ok(activitiesList.some(a => a.summary.includes('Created outreach draft for EMAIL')));
  });

  await t.test('generateOutreachDraftAction should support MEETING channel', async () => {
    const result = await generateOutreachDraftAction('lead-client', 'MEETING');
    assert.ok(result.success);
    assert.ok(result.drafts && result.drafts.length > 0);
    assert.strictEqual(result.drafts![0].channel, 'MEETING');
    assert.strictEqual(result.drafts![0].status, 'DRAFT');
    assert.ok(result.drafts![0].body.includes('MEETING PREP GUIDE'));
  });

  await t.test('deleteDraftAction should delete a DRAFT draft', async () => {
    const genResult = await generateOutreachDraftAction('lead-client', 'EMAIL');
    assert.ok(genResult.success);
    const delId = genResult.drafts![0].id;

    const deleteResult = await deleteDraftAction(delId);
    assert.ok(deleteResult.success);
  });

  await t.test('reject -> duplicate -> re-edit flow should work end-to-end', async () => {
    const genResult = await generateOutreachDraftAction('lead-client', 'LINKEDIN');
    assert.ok(genResult.success);
    const originalDraftId = genResult.drafts![0].id;

    const rejResult = await recordApprovalAction(originalDraftId, 'REJECTED', 'Too formal');
    assert.ok(rejResult.success);

    const dupResult = await duplicateDraftAction(originalDraftId);
    assert.ok(dupResult.success);
    assert.ok(dupResult.draft);
    assert.strictEqual(dupResult.draft.status, 'DRAFT');
    assert.notStrictEqual(dupResult.draft.id, originalDraftId);

    const editResult = await updateDraftAction(dupResult.draft.id, null, 'Less formal body');
    assert.ok(editResult.success);

    const approveResult = await recordApprovalAction(dupResult.draft.id, 'APPROVED');
    assert.ok(approveResult.success);
  });
});
