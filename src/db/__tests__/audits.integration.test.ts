import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { AuditService } from '../../services/audits';
import { ScoringService } from '../../services/scoring';
import { LeadService } from '../../services/lead';
import { audits, leadScores } from '../schema';
import { prospects as leads, activities, users } from '../schema/core';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const { db } = initTestDb();
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
    });

    const score = await scoringService.recalculateScore(lead.id);
    assert.ok(score);
    assert.strictEqual(score.leadId, lead.id);
    // Base 10 + Email 10 = 20 points
    assert.strictEqual(score.scoreValue, 20);
    assert.strictEqual(score.scoreLabel, 'Low');
    assert.ok(score.rationaleSummary.includes('Calculated baseline priority'));

    // Check activity log
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const scoreActivity = activitiesList.find(a => a.type === 'Score updated');
    assert.ok(scoreActivity);
    assert.ok(scoreActivity.summary.includes('score updated to 20'));
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
    });

    // Run audit representing a very weak digital presence (high opportunity)
    const audit = await auditService.createAudit({
      leadId: lead.id,
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
    // Audit completed: +30
    // Weaknesses identified: +5
    // Recommended improvements: +5
    // Total expected score: 10 + 40 + 30 + 5 + 5 = 90 (High)
    const currentScore = await scoringService.getCurrentScore(lead.id);
    assert.ok(currentScore);
    assert.strictEqual(currentScore.scoreValue, 90);
    assert.strictEqual(currentScore.scoreLabel, 'High');

    // Verify activity logs
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const auditActivity = activitiesList.find(a => a.type === 'Audit generated');
    const scoreActivity = activitiesList.find(a => a.type === 'Score updated' && a.summary.includes('90'));
    
    assert.ok(auditActivity);
    assert.ok(scoreActivity);
  });

  await t.test('manualOverride should enforce user score and update isCurrent flags', async () => {
    const lead = await leadService.createLead({
      name: 'Custom Studio Corp',
    });

    // Insert mock user to satisfy foreign key constraint on createdByUserId
    await db.insert(users).values({
      id: 'user-123',
      name: 'Test Operator',
      email: 'operator@leadroom.com',
      password: 'hashedpassword',
    });

    // Run first score calculation (should be 10: Base 10)
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
