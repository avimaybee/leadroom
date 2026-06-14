import { test } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { AuditService } from '../../services/audits';
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
    auditService: new AuditService(db as any),
    scoringService: new ScoringService(db as any),
  };
}

test('Audits & Scoring Integration', async (t) => {
  const { leadService, auditService, scoringService, db } = setupTestDb();

  await t.test('recalculateScore on profile data only', async () => {
    // Lead with name and email only
    const lead = await leadService.createLead({
      name: 'John Creative Parlour',
      email: 'john@creativeparlour.com',
      triagePriority: 'MEDIUM',
    });

    const score = await scoringService.recalculateScore(lead.id);
    assert.ok(score);
    assert.strictEqual(score.leadId, lead.id);
    // Base 10 + Email 10 + Triage Medium 5 = 25 points
    assert.strictEqual(score.scoreValue, 25);
    assert.strictEqual(score.scoreLabel, 'Low');
    assert.ok(score.rationaleSummary.includes('Calculated Priority: Low'));

    // Check activity log
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const scoreActivity = activitiesList.find(a => a.type === 'Score updated');
    assert.ok(scoreActivity);
    assert.ok(scoreActivity.summary.includes('score calculated as 25'));
  });

  await t.test('createAudit should save audit, recalculate score, and log activities', async () => {
    // Create lead with full profile details
    const lead = await leadService.createLead({
      name: 'The Gallery Tattoo Studio',
      website: 'https://thegalleryburleson.com',
      email: 'info@thegalleryburleson.com',
      phone: '817-555-0199',
      city: 'Burleson',
      region: 'Texas',
      triagePriority: 'HIGH',
    });

    // Run audit representing a very weak digital presence (high opportunity)
    const audit = await auditService.createAudit({
      leadId: lead.id,
      websiteQualityScore: 30, // < 50 -> +15 opportunity
      designAestheticScore: 40, // < 60 -> +15 opportunity
      messagingClarityScore: 45, // < 60 -> +10 opportunity
      socialPresenceScore: 80, // > 50 -> +0 opportunity
      overallBrandingScore: 50, // < 60 -> +10 opportunity
      keyStrengths: 'Decent portfolio images.',
      keyWeaknesses: 'No mobile responsiveness, slow load time, weak CTA.',
      recommendedImprovements: 'Build clean React static page with direct booking form.',
      origin: 'AI_GENERATED',
    });

    assert.ok(audit);
    assert.strictEqual(audit.leadId, lead.id);

    // Verify lead score:
    // Base: 10
    // Profile: website (15) + email (10) + phone (10) + location (5) = +40
    // Triage: HIGH = +15
    // Audit Opportunity:
    //   websiteQuality < 50 -> +15
    //   designAesthetic < 60 -> +15
    //   messagingClarity < 60 -> +10
    //   overallBranding < 60 -> +10
    // Total potential opportunity: +50
    // Total expected score: 10 + 40 + 15 + 50 = 115 (clamped to 100)
    const currentScore = await scoringService.getCurrentScore(lead.id);
    assert.ok(currentScore);
    assert.strictEqual(currentScore.scoreValue, 100);
    assert.strictEqual(currentScore.scoreLabel, 'High');

    // Verify activity logs
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const auditActivity = activitiesList.find(a => a.type === 'Audit generated');
    const scoreActivity = activitiesList.find(a => a.type === 'Score updated' && a.summary.includes('100'));
    
    assert.ok(auditActivity);
    assert.ok(scoreActivity);
  });

  await t.test('manualOverride should enforce user score and update isCurrent flags', async () => {
    const lead = await leadService.createLead({
      name: 'Custom Studio Corp',
      triagePriority: 'MEDIUM',
    });

    // Insert mock user to satisfy foreign key constraint on createdByUserId
    await db.insert(users).values({
      id: 'user-123',
      name: 'Test Operator',
      email: 'operator@draftroom.com',
      password: 'hashedpassword',
    });

    // Run first score calculation (should be 15: Base 10 + Triage 5)
    await scoringService.recalculateScore(lead.id);

    // Apply manual override
    const override = await scoringService.manualOverride(
      lead.id,
      85,
      'Spoke to owner, ready for branding package next week.',
      'user-123'
    );

    assert.ok(override);
    assert.strictEqual(override.scoreValue, 85);
    assert.strictEqual(override.scoreLabel, 'High');
    assert.strictEqual(override.origin, 'MANUAL_OVERRIDE');

    // Ensure the manual score is the current one
    const current = await scoringService.getCurrentScore(lead.id);
    assert.strictEqual(current.id, override.id);
    assert.strictEqual(current.isCurrent, 1);

    // Check old score is not current anymore
    const allScores = await db.select().from(leadScores).where(eq(leadScores.leadId, lead.id));
    const oldScore = allScores.find(s => s.id !== override.id);
    assert.ok(oldScore);
    assert.strictEqual(oldScore.isCurrent, 0);
  });
});
