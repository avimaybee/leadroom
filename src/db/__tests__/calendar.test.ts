import { test } from 'node:test';
import * as assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { googleCalendarTokens, users, prospects as leads, tasks } from '../schema/core';
import { eq, sql } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';

async function createTestUser(db: any): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    name: 'Test User',
    email: `${id}@test.com`,
    password: 'test-hash',
  });
  return id;
}

test('CalendarService', async (t) => {
  await t.test('isConfigured returns false without env vars', async () => {
    const { db } = initTestDb();
    const { CalendarService } = await import('../../services/calendar');
    const service = new CalendarService(db as any);
    assert.strictEqual(await service.isConfigured(), false);
  });

  await t.test('getAuthUrl returns null without env vars', async () => {
    const { db } = initTestDb();
    const { CalendarService } = await import('../../services/calendar');
    const service = new CalendarService(db as any);
    assert.strictEqual(await service.getAuthUrl('test-user'), null);
  });

  await t.test('disconnect removes tokens', async () => {
    const { db } = initTestDb();
    const { CalendarService } = await import('../../services/calendar');
    const service = new CalendarService(db as any);
    const userId = await createTestUser(db);

    await db.insert(googleCalendarTokens).values({
      id: crypto.randomUUID(),
      userId,
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
    });

    const before = await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId));
    assert.strictEqual(before.length, 1);

    await service.disconnect(userId);

    const after = await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId));
    assert.strictEqual(after.length, 0);
  });

  await t.test('getStatus returns connected when token exists', async () => {
    const { db } = initTestDb();
    const { CalendarService } = await import('../../services/calendar');
    const service = new CalendarService(db as any);
    const userId = await createTestUser(db);

    await db.insert(googleCalendarTokens).values({
      id: crypto.randomUUID(),
      userId,
      accessToken: 'test-token',
    });

    const status = await service.getStatus(userId);
    assert.strictEqual(status.connected, true);
  });

  await t.test('getStatus returns not connected when no token', async () => {
    const { db } = initTestDb();
    const { CalendarService } = await import('../../services/calendar');
    const service = new CalendarService(db as any);

    const status = await service.getStatus('no-user');
    assert.strictEqual(status.connected, false);
  });

  await t.test('syncTasksToCalendar returns 0 when no token', async () => {
    const { db } = initTestDb();
    const { CalendarService } = await import('../../services/calendar');
    const service = new CalendarService(db as any);

    const result = await service.syncTasksToCalendar('no-user');
    assert.strictEqual(result.synced, 0);
    assert.strictEqual(result.errors, 0);
  });

  await t.test('syncTasksToCalendar updates task on success and failure', async () => {
    const { db } = initTestDb();
    const { CalendarService } = await import('../../services/calendar');
    const service = new CalendarService(db as any);
    const userId = await createTestUser(db);
    const secret = process.env.DB_ENCRYPTION_KEY || 'fallback_key_dev';

    await db.insert(googleCalendarTokens).values({
      id: crypto.randomUUID(),
      userId,
      accessToken: await encrypt('valid-token', secret),
    });

    const leadId = crypto.randomUUID();
    await db.insert(leads).values({
      id: leadId,
      name: 'Test Lead',
      status: 'Active',
      stage: 'New',
    });

    const taskId1 = crypto.randomUUID();
    const taskId2 = crypto.randomUUID();
    const futureDate = new Date(Date.now() + 3600 * 1000);
    
    await db.insert(tasks).values({
      id: taskId1,
      leadId,
      title: 'Task 1',
      status: 'Open',
      dueDate: futureDate,
      assigneeId: userId,
      priority: 'High',
    });

    await db.insert(tasks).values({
      id: taskId2,
      leadId,
      title: 'Task 2',
      status: 'Open',
      dueDate: futureDate,
      assigneeId: userId,
      priority: 'High',
    });

    const originalFetch = global.fetch;
    let callCount = 0;
    global.fetch = async (url: any, init: any) => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({ id: 'evt-12345' }),
        } as any;
      } else {
        return {
          ok: false,
          text: async () => 'Calendar Limit Exceeded',
        } as any;
      }
    };

    try {
      const result = await service.syncTasksToCalendar(userId);
      assert.strictEqual(result.synced, 1);
      assert.strictEqual(result.errors, 1);

      const [t1] = await db.select().from(tasks).where(eq(tasks.id, taskId1));
      assert.strictEqual(t1.googleCalendarSyncStatus, 'Synced');
      assert.strictEqual(t1.googleCalendarEventId, 'evt-12345');
      assert.strictEqual(t1.googleCalendarSyncError, null);

      const [t2] = await db.select().from(tasks).where(eq(tasks.id, taskId2));
      assert.strictEqual(t2.googleCalendarSyncStatus, 'Error');
      assert.strictEqual(t2.googleCalendarSyncError, 'Calendar Limit Exceeded');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
