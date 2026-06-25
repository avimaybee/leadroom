import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { LeadService } from '../../services/lead';
import { leads, stageThresholds, users, notifications } from '../schema/core';
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

test('StaleAlerts', async (t) => {
  await t.test('returns 0 when leads have no stageUpdatedAt', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    const lead = await leadService.createLead({ name: 'No Date Lead', ownerId: userId });
    await db.update(leads).set({ stageUpdatedAt: null }).where(eq(leads.id, lead.id));
    const count = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(count, 0);
  });

  await t.test('skips Won leads', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    const lead = await leadService.createLead({ name: 'Won Lead', ownerId: userId, stage: 'Won' });
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db.update(leads).set({ stageUpdatedAt: oldDate }).where(eq(leads.id, lead.id));
    const count = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(count, 0);
  });

  await t.test('skips Lost leads', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    const lead = await leadService.createLead({ name: 'Lost Lead', ownerId: userId, stage: 'Lost' });
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db.update(leads).set({ stageUpdatedAt: oldDate }).where(eq(leads.id, lead.id));
    const count = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(count, 0);
  });

  await t.test('creates alert (ERROR) when lead past threshold', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    const lead = await leadService.createLead({ name: 'Stale Alert Lead', ownerId: userId, stage: 'Auditing' });
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await db.update(leads).set({ stageUpdatedAt: tenDaysAgo }).where(eq(leads.id, lead.id));
    await db.insert(stageThresholds).values({
      id: crypto.randomUUID(),
      stage: 'Auditing',
      days: 5,
    });
    const count = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(count, 1, 'Expected 1 alert for stale lead');

    const alertNotifications = await db
      .select()
      .from(notifications)
      .where(like(notifications.title, 'Lead stale:%'));
    assert.strictEqual(alertNotifications.length, 1);
    assert.strictEqual(alertNotifications[0].status, 'ERROR');
  });

  await t.test('creates warning (INFO) at near-threshold', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    // Set threshold to 10 days, lead is 9 days old = 90% of threshold (within 80-99% range)
    await db.insert(stageThresholds).values({
      id: crypto.randomUUID(),
      stage: 'Auditing',
      days: 10,
    });
    const lead = await leadService.createLead({ name: 'Warning Lead', ownerId: userId, stage: 'Auditing' });
    const nineDaysAgo = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
    await db.update(leads).set({ stageUpdatedAt: nineDaysAgo }).where(eq(leads.id, lead.id));
    const count = await leadService.checkAndAlertStaleLeads();
    // Warning does not count toward alertCount
    assert.strictEqual(count, 0);

    const warningNotifications = await db
      .select()
      .from(notifications)
      .where(like(notifications.title, 'Lead aging:%'));
    assert.strictEqual(warningNotifications.length, 1);
    assert.strictEqual(warningNotifications[0].status, 'INFO');
  });

  await t.test('dedup prevents duplicate ERROR alerts within window', async () => {
    const { db, leadService } = setupTestDb();
    const userId = await seedUser(db);
    const lead = await leadService.createLead({ name: 'Dedup Alert Lead', ownerId: userId, stage: 'Auditing' });
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await db.update(leads).set({ stageUpdatedAt: tenDaysAgo }).where(eq(leads.id, lead.id));
    await db.insert(stageThresholds).values({
      id: crypto.randomUUID(),
      stage: 'Auditing',
      days: 5,
    });

    const firstCount = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(firstCount, 1);

    const secondCount = await leadService.checkAndAlertStaleLeads();
    assert.strictEqual(secondCount, 0, 'Expected 0 new alerts (dedup within 24h window)');

    const allAlerts = await db
      .select()
      .from(notifications)
      .where(like(notifications.title, 'Lead stale:%'));
    assert.strictEqual(allAlerts.length, 1, 'Should only be 1 alert notification after dedup');
  });
});
