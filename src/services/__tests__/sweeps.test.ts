import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from '../../db/__tests__/test-helpers';
import {
  runFastSweeps,
  runDailySweeps,
  runAllSweeps,
  runTablePruningSweep,
  runReminderSweep,
  runStuckJobRunSweep,
  runStuckResearchTaskSweep,
  runScoreSweep,
} from '../sweeps';
import { ReminderService } from '../reminders';
import {
  notifications,
  reminders,
  prospects as leads,
  users,
  sweepLocks,
} from '../../db/schema/core';
import { leadScores } from '../../db/schema/audits';
import { jobRuns } from '../../db/schema/research';
import { researchTasks } from '../../db/schema/jobs';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const { db, sqlite } = initTestDb();
  return { db: db as any, sqlite };
}

async function seedUser(db: any) {
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    name: 'Test Operator',
    email: `op-${id.slice(0, 8)}@leadroom.com`,
    password: 'hash',
  });
  return id;
}

test('Sweeps Optimization & D1 Read Efficiency', async (t) => {
  await t.test('EXPLAIN QUERY PLAN confirms equality-first index seek for notifications cleanup', async () => {
    const { sqlite } = setupTestDb();

    // Query executed by runTablePruningSweep
    const plan = sqlite
      .prepare(
        `EXPLAIN QUERY PLAN DELETE FROM notifications WHERE created_at <= 1000 AND is_read = 1`
      )
      .all();

    const planStr = JSON.stringify(plan);
    // Must use index notifications_is_read_created_at_idx
    assert.ok(
      planStr.includes('notifications_is_read_created_at_idx'),
      `Expected plan to use notifications_is_read_created_at_idx, got: ${planStr}`
    );
    // Must NOT do a full SCAN of notifications
    assert.ok(
      !planStr.includes('SCAN notifications'),
      `Query plan should not do full table SCAN: ${planStr}`
    );
  });

  await t.test('EXPLAIN QUERY PLAN confirms equality-first index seek for reminders due check', async () => {
    const { sqlite } = setupTestDb();

    const plan = sqlite
      .prepare(
        `EXPLAIN QUERY PLAN SELECT * FROM reminders WHERE remind_at <= 1000 AND is_fired = 0`
      )
      .all();

    const planStr = JSON.stringify(plan);
    assert.ok(
      planStr.includes('reminders_is_fired_remind_at_idx'),
      `Expected plan to use reminders_is_fired_remind_at_idx, got: ${planStr}`
    );
    assert.ok(!planStr.includes('SCAN reminders'), `Should not SCAN reminders: ${planStr}`);
  });

  await t.test('EXPLAIN QUERY PLAN confirms index search on job_runs for stuck jobs sweep', async () => {
    const { sqlite } = setupTestDb();

    const plan = sqlite
      .prepare(
        `EXPLAIN QUERY PLAN SELECT id FROM job_runs WHERE status = 'RUNNING' AND started_at < 1000`
      )
      .all();

    const planStr = JSON.stringify(plan);
    assert.ok(
      planStr.includes('job_runs_status_started_at_idx'),
      `Expected plan to use job_runs_status_started_at_idx, got: ${planStr}`
    );
  });

  await t.test('runTablePruningSweep deletes only expired read notifications and preserves unread notifications', async () => {
    const { db } = setupTestDb();
    const userId = await seedUser(db);

    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
    const newDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);  // 2 days ago

    // Insert 10 unread notifications (40 days old) -> should NOT be deleted
    for (let i = 0; i < 10; i++) {
      await db.insert(notifications).values({
        id: `unread-old-${i}`,
        userId,
        title: `Unread Old ${i}`,
        message: 'Message',
        status: 'INFO',
        isRead: false,
        createdAt: oldDate,
      });
    }

    // Insert 5 read notifications (40 days old) -> SHOULD be deleted
    for (let i = 0; i < 5; i++) {
      await db.insert(notifications).values({
        id: `read-old-${i}`,
        userId,
        title: `Read Old ${i}`,
        message: 'Message',
        status: 'INFO',
        isRead: true,
        createdAt: oldDate,
      });
    }

    // Insert 5 read notifications (2 days old) -> should NOT be deleted (not expired)
    for (let i = 0; i < 5; i++) {
      await db.insert(notifications).values({
        id: `read-new-${i}`,
        userId,
        title: `Read New ${i}`,
        message: 'Message',
        status: 'INFO',
        isRead: true,
        createdAt: newDate,
      });
    }

    const pruneResult = await runTablePruningSweep(db);
    assert.strictEqual(pruneResult.deletedNotifications, 5);

    // Verify all 10 unread remain
    const unreadRemaining = await db
      .select()
      .from(notifications)
      .where(eq(notifications.isRead, false));
    assert.strictEqual(unreadRemaining.length, 10);

    // Verify only the 5 new read notifications remain
    const readRemaining = await db
      .select()
      .from(notifications)
      .where(eq(notifications.isRead, true));
    assert.strictEqual(readRemaining.length, 5);
  });

  await t.test('runDailySweeps sets 20h throttling lock and skips subsequent invocations within window', async () => {
    const { db } = setupTestDb();
    await seedUser(db);

    // First run (forced or initial run without existing lock): executes daily sweeps
    const firstRun = await runDailySweeps(db, { force: true });
    // After running, lock should exist in sweepLocks with id 'daily_maintenance_sweep'
    const [lock] = await db
      .select()
      .from(sweepLocks)
      .where(eq(sweepLocks.id, 'daily_maintenance_sweep'));
    assert.ok(lock, 'daily_maintenance_sweep lock record should exist');
    assert.ok(
      lock.expiresAt.getTime() > Date.now(),
      'daily_maintenance_sweep should have future expiration'
    );

    // Second run without force: should be skipped!
    const secondRun = await runDailySweeps(db, { force: false });
    assert.strictEqual(secondRun.staleAlerts, 0);
    assert.strictEqual(secondRun.deletedNotifications, 0);
    assert.strictEqual(secondRun.deletedScores, 0);

    // Third run with force: true: should execute despite throttle
    const thirdRun = await runDailySweeps(db, { force: true });
    // Returned an object with proper fields
    assert.ok(typeof thirdRun.deletedNotifications === 'number');
  });

  await t.test('runFastSweeps handles reminders, dirty scores, and stuck tasks without running pruning', async () => {
    const { db } = setupTestDb();
    const userId = await seedUser(db);
    const leadId = crypto.randomUUID();
    await db.insert(leads).values({
      id: leadId,
      name: 'Test Prospect',
      ownerId: userId,
    });

    // Seed an overdue reminder
    const reminderService = new ReminderService(db);
    await reminderService.createReminder(
      leadId,
      userId,
      'Test Reminder',
      'Reminder body',
      new Date(Date.now() - 1000)
    );

    const fastResult = await runFastSweeps(db);
    assert.strictEqual(fastResult.remindersFired, 1);
    assert.strictEqual(fastResult.stuckTasksReset, 0);
    assert.strictEqual(fastResult.stuckJobsReset, 0);

    // Verify reminder is marked fired
    const fired = await db.select().from(reminders).where(eq(reminders.isFired, true));
    assert.strictEqual(fired.length, 1);
  });

  await t.test('runAllSweeps orchestrates fast sweeps and throttles daily maintenance', async () => {
    const { db } = setupTestDb();
    await seedUser(db);

    const result1 = await runAllSweeps(db);
    assert.ok(typeof result1.remindersFired === 'number');
    assert.ok(typeof result1.deletedNotifications === 'number');

    // Clear only the tick lock (sweep_lock) so the next tick can acquire the lock,
    // but leave the daily_maintenance_sweep lock intact to test throttling
    await db.delete(sweepLocks).where(eq(sweepLocks.id, 'sweep_lock'));

    // Run again immediately — daily sweep should be throttled (deletedNotifications should be 0)
    const result2 = await runAllSweeps(db);
    assert.strictEqual(result2.deletedNotifications, 0);
    assert.strictEqual(result2.staleAlerts, 0);
  });
});
