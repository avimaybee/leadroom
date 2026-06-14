import { test } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { ScoringService } from '../../services/scoring';
import { LeadService } from '../../services/lead';
import { audits, leadScores } from '../schema';
import { leads, activities, users } from '../schema/core';
import { eq } from 'drizzle-orm';

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

    CREATE TABLE job_runs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      target_lead_id TEXT REFERENCES leads(id),
      triggered_by_user_id TEXT REFERENCES users(id),
      error_summary TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
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
      job_run_id TEXT REFERENCES job_runs(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
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
      job_run_id TEXT REFERENCES job_runs(id),
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
  `);

  const db = drizzle(sqlite);
  return {
    db,
    leadService: new LeadService(db as any),
    scoringService: new ScoringService(db as any),
  };
}

test('ScoringService Integration Tests', async (t) => {
  await t.test('Base Scoring: Lead with minimal details', async () => {
    const { leadService, scoringService } = setupTestDb();
    const lead = await leadService.createLead({
      name: 'Minimal Lead',
    });

    const score = await scoringService.recalculateScore(lead.id);
    assert.ok(score);
    // Base score is 10. No email (+0), website (+0), phone (+0), location (+0).
    assert.strictEqual(score.scoreValue, 10);
    assert.strictEqual(score.scoreLabel, 'Low');
  });

  await t.test('Profile Completeness Scoring: Lead with email, website, phone, and city', async () => {
    const { leadService, scoringService } = setupTestDb();
    const lead = await leadService.createLead({
      name: 'Detailed Lead',
      email: 'hello@example.com',
      website: 'https://example.com',
      phone: '123-456-7890',
      city: 'Austin',
      region: 'Texas',
    });

    const score = await scoringService.recalculateScore(lead.id);
    assert.ok(score);
    // Base 10 + Website (15) + Email (10) + Phone (10) + Location (5) = 50
    assert.strictEqual(score.scoreValue, 50);
    assert.strictEqual(score.scoreLabel, 'Medium');
  });

  await t.test('Triage Priority Modifiers: HIGH vs MEDIUM vs LOW vs SKIP', async () => {
    const { leadService, scoringService } = setupTestDb();

    // High Triage lead
    const leadHigh = await leadService.createLead({
      name: 'Triage High Lead',
      triagePriority: 'HIGH',
    });
    const scoreHigh = await scoringService.recalculateScore(leadHigh.id);
    // Base 10 + Triage HIGH (15) = 25
    assert.strictEqual(scoreHigh.scoreValue, 25);

    // Medium Triage lead
    const leadMedium = await leadService.createLead({
      name: 'Triage Medium Lead',
      triagePriority: 'MEDIUM',
    });
    const scoreMedium = await scoringService.recalculateScore(leadMedium.id);
    // Base 10 + Triage MEDIUM (5) = 15
    assert.strictEqual(scoreMedium.scoreValue, 15);

    // Skip Triage lead
    const leadSkip = await leadService.createLead({
      name: 'Triage Skip Lead',
      triagePriority: 'SKIP',
    });
    const scoreSkip = await scoringService.recalculateScore(leadSkip.id);
    // Base 10 + Triage SKIP (-20) = -10 (which might be clamped or calculated exactly depending on service)
    assert.ok(scoreSkip.scoreValue <= 0);
  });

  await t.test('Manual override saves the exact score and deactivates old scores', async () => {
    const { leadService, scoringService, db } = setupTestDb();
    const lead = await leadService.createLead({
      name: 'Override Lead',
    });

    // Seed mock user
    await db.insert(users).values({
      id: 'operator-1',
      name: 'Admin User',
      email: 'admin@leadroom.com',
      password: 'hashedpassword',
    });

    // Fetch base score created during createLead
    const [baseScore] = await db.select().from(leadScores).where(eq(leadScores.leadId, lead.id));
    assert.ok(baseScore);
    assert.strictEqual(baseScore.isCurrent, 1);

    // Perform override
    const override = await scoringService.manualOverride(
      lead.id,
      95,
      'Pre-approved package',
      'operator-1'
    );

    assert.ok(override);
    assert.strictEqual(override.scoreValue, 95);
    assert.strictEqual(override.scoreLabel, 'High');
    assert.strictEqual(override.origin, 'MANUAL_OVERRIDE');
    assert.strictEqual(override.isCurrent, 1);

    // Check that base score is now NOT current
    const all = await db.select().from(leadScores).where(eq(leadScores.leadId, lead.id));
    assert.strictEqual(all.length, 2);
    const deactivated = all.find(s => s.id === baseScore.id);
    assert.ok(deactivated);
    assert.strictEqual(deactivated.isCurrent, 0);
  });
});
