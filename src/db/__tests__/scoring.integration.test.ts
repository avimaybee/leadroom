import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { ScoringService } from '../../services/scoring';
import { LeadService } from '../../services/lead';
import { audits, leadScores } from '../schema';
import { leads, activities, users } from '../schema/core';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const { db } = initTestDb();
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
