import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { LeadService } from '../../services/lead';
import { prospects as leads, users, notifications } from '../schema/core';
import { eq, like } from 'drizzle-orm';

function setupTestDb() {
  const { db } = initTestDb();
  return { db, leadService: new LeadService(db as any) };
}

async function seedUser(db: any) {
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, name: 'Operator', email: 'op@leadroom.com', password: 'hash' });
  return id;
}

test('StaleAlerts (hardcoded thresholds)', async (t) => {
  // Hardcoded defaults: 'In Research': 2, 'Drafting': 2

  await t.test('returns 0 when leads have no stageUpdatedAt', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    const lead = await leadService.createLead({ name: 'No Date', ownerId: userId });
    await db.update(leads).set({ stageUpdatedAt: null }).where(eq(leads.id, lead.id));
    const count = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(count, 0);
  });

  await t.test('skips Won leads', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    const lead = await leadService.createLead({ name: 'Won Lead', ownerId: userId, stage: 'Won' });
    await db.update(leads).set({ stageUpdatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }).where(eq(leads.id, lead.id));
    const count = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(count, 0);
  });

  await t.test('creates alert when lead past threshold', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    const lead = await leadService.createLead({ name: 'Stale Alert', ownerId: userId, stage: 'In Research' });
    // threshold is 2 days, set to 5 days ago
    await db.update(leads).set({ stageUpdatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }).where(eq(leads.id, lead.id));
    const count = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(count, 1);

    const alerts = await db.select().from(notifications).where(like(notifications.title, 'Lead stale:%'));
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].status, 'ERROR');
  });

  await t.test('creates warning at near-threshold', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    const lead = await leadService.createLead({ name: 'Warning Lead', ownerId: userId, stage: 'Drafting' });
    // threshold is 2 days, 80-99% = ~1.6-1.98 days. Set to 1.8 days ago.
    await db.update(leads).set({ stageUpdatedAt: new Date(Date.now() - 1.8 * 24 * 60 * 60 * 1000) }).where(eq(leads.id, lead.id));
    const count = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(count, 0); // warnings don't count

    const warnings = await db.select().from(notifications).where(like(notifications.title, 'Lead aging:%'));
    assert.strictEqual(warnings.length, 1);
    assert.strictEqual(warnings[0].status, 'INFO');
  });

  await t.test('dedup prevents duplicate alerts within window', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    const lead = await leadService.createLead({ name: 'Dedup', ownerId: userId, stage: 'In Research' });
    await db.update(leads).set({ stageUpdatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }).where(eq(leads.id, lead.id));
    const first = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(first, 1);
    const second = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(second, 0);

    const all = await db.select().from(notifications).where(like(notifications.title, 'Lead stale:%'));
    assert.strictEqual(all.length, 1);
  });
});
