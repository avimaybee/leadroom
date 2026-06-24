import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { LeadService } from '../../services/lead';
import { leads, stageThresholds, users } from '../schema/core';
import { researchSnapshots } from '../schema/research';
import { outreachDrafts } from '../schema/outreach';
import { eq, sql } from 'drizzle-orm';

function setupTestDb() {
  const { db } = initTestDb();
  return { db, leadService: new LeadService(db as any) };
}

async function createUser(db: any) {
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, name: 'Test User', email: 'test@leadroom.com', password: 'hash' });
  return id;
}

test('NBAEngine', async (t) => {
  await t.test('returns empty for non-existent lead', async () => {
    const { leadService } = setupTestDb();
    const result = await leadService.getNextBestActions('nonexistent-id');
    assert.deepStrictEqual(result, []);
  });

  await t.test('returns empty for non-Active lead', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Inactive Lead' });
    await db.update(leads).set({ status: 'Archived' }).where(eq(leads.id, lead.id));
    const result = await leadService.getNextBestActions(lead.id);
    assert.deepStrictEqual(result, []);
  });

  await t.test('returns empty for Won stage', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Won Lead' });
    await db.update(leads).set({ stage: 'Won' }).where(eq(leads.id, lead.id));
    const result = await leadService.getNextBestActions(lead.id);
    assert.deepStrictEqual(result, []);
  });

  await t.test('returns empty for Lost stage', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Lost Lead' });
    await db.update(leads).set({ stage: 'Lost' }).where(eq(leads.id, lead.id));
    const result = await leadService.getNextBestActions(lead.id);
    assert.deepStrictEqual(result, []);
  });

  await t.test('overdue_task signal fires when a task is past due', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Overdue Lead' });
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.run(sql`INSERT INTO tasks (id, lead_id, title, status, due_date) VALUES (${crypto.randomUUID()}, ${lead.id}, 'Overdue task', 'Open', ${Math.floor(pastDate.getTime() / 1000)})`);
    const result = await leadService.getNextBestActions(lead.id);
    const overdueActions = result.filter((a) => a.action === 'Complete overdue tasks');
    assert.ok(overdueActions.length > 0, 'Expected at least one task action for overdue task');
  });

  await t.test('overdue_task signal absent when only future tasks exist', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Future Lead' });
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.run(sql`INSERT INTO tasks (id, lead_id, title, status, due_date) VALUES (${crypto.randomUUID()}, ${lead.id}, 'Future task', 'Open', ${Math.floor(futureDate.getTime() / 1000)})`);
    const result = await leadService.getNextBestActions(lead.id);
    const overdueActions = result.filter((a) => a.action === 'Complete overdue tasks');
    assert.strictEqual(overdueActions.length, 0);
  });

  await t.test('stale signal fires when lead is past stage threshold', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Stale Lead', stage: 'In Research' });
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await db.update(leads).set({ stageUpdatedAt: tenDaysAgo }).where(eq(leads.id, lead.id));
    await db.insert(stageThresholds).values({
      id: crypto.randomUUID(),
      stage: 'In Research',
      days: 5,
    });
    const result = await leadService.getNextBestActions(lead.id);
    const staleActions = result.filter((a) => a.type === 'review');
    assert.ok(staleActions.length > 0, 'Expected at least one review action for stale lead');
  });

  await t.test('no_research signal fires when lead has no snapshot', async () => {
    const { leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'No Research Lead' });
    const result = await leadService.getNextBestActions(lead.id);
    const researchActions = result.filter((a) => a.action === 'Start lead research');
    assert.ok(researchActions.length > 0, 'Expected research action when no snapshot exists');
  });

  await t.test('no_research signal absent when lead has a snapshot', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await createUser(db);
    const lead = await leadService.createLead({ name: 'Researched Lead' });
    await db.insert(researchSnapshots).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      createdByUserId: userId,
      origin: 'MANUAL',
      confidenceLevel: 'HIGH',
    });
    const result = await leadService.getNextBestActions(lead.id);
    const researchActions = result.filter((a) => a.action === 'Start lead research');
    assert.strictEqual(researchActions.length, 0);
  });

  await t.test('unsent_draft signal fires when lead has DRAFT drafts', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Draft Lead' });
    await db.insert(outreachDrafts).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      channel: 'EMAIL',
      body: 'Test draft body',
      status: 'DRAFT',
    });
    const result = await leadService.getNextBestActions(lead.id);
    const outreachActions = result.filter((a) => a.type === 'outreach');
    assert.ok(outreachActions.length > 0, 'Expected outreach action when unsent draft exists');
  });

  await t.test('unread signal fires when lead is unread', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Unread Lead' });
    await db.update(leads).set({ isRead: false }).where(eq(leads.id, lead.id));
    const result = await leadService.getNextBestActions(lead.id);
    const reviewActions = result.filter((a) => a.action === 'Review new lead');
    assert.ok(reviewActions.length > 0, 'Expected review action for unread lead');
  });

  await t.test('results sorted by score descending', async () => {
    const { db, leadService } = setupTestDb();
    // Create lead with multiple signals: overdue task + unread
    const lead = await leadService.createLead({ name: 'Multi Signal Lead' });
    await db.update(leads).set({ isRead: false }).where(eq(leads.id, lead.id));
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.run(sql`INSERT INTO tasks (id, lead_id, title, status, due_date) VALUES (${crypto.randomUUID()}, ${lead.id}, 'Overdue task', 'Open', ${Math.floor(pastDate.getTime() / 1000)})`);
    const result = await leadService.getNextBestActions(lead.id);
    assert.ok(result.length >= 2, 'Expected at least 2 actions for multiple signals');
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i - 1].score >= result[i].score, `Scores not descending at index ${i}: ${result[i - 1].score} < ${result[i].score}`);
    }
  });

  await t.test('zero-weight rules produce no action', async () => {
    const { leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Zero Weight Lead' });
    const zeroWeightRules = [
      { signal: 'unread' as const, weight: 0 },
    ];
    const result = await leadService.getNextBestActions(lead.id, zeroWeightRules);
    assert.strictEqual(result.length, 0);
  });
});
