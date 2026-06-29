import { test } from 'node:test';
import { setupTestDb as initTestDb } from './test-helpers';
import { LeadService } from '../../services/lead';
import { playbooks, playbookTasks, tasks } from '../schema/core';
import { eq } from 'drizzle-orm';
import * as assert from 'node:assert';

function setupTestDb() {
  const { db } = initTestDb();
  const leadService = new LeadService(db as any);
  return { db, leadService };
}

test('Playbooks', async (t) => {
  await t.test('no playbook defined — no tasks created on stage change', async () => {
    const { leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Test Lead', stage: 'New' });
    const updated = await leadService.updateStage(lead.id, 'Outreach Sent');
    const leadTasks = await leadService.getTasks(lead.id);
    assert.strictEqual(leadTasks.length, 0);
  });

  await t.test('playbook creates tasks when lead enters matching stage', async () => {
    const { db, leadService } = setupTestDb();
    const pbId = crypto.randomUUID();
    await db.insert(playbooks).values({ id: pbId, stage: 'Outreach Sent', name: 'Outreach Playbook', isActive: true });
    await db.insert(playbookTasks).values([
      { id: crypto.randomUUID(), playbookId: pbId, title: 'Check email open status', daysOffset: 3, priority: 'High', category: 'Follow-up' },
      { id: crypto.randomUUID(), playbookId: pbId, title: 'Send follow-up ping', daysOffset: 7, priority: 'Medium', category: 'Follow-up' },
    ]);

    const lead = await leadService.createLead({ name: 'Test Lead', stage: 'New' });
    const updated = await leadService.updateStage(lead.id, 'Outreach Sent');
    const leadTasks = await leadService.getTasks(lead.id);

    assert.strictEqual(leadTasks.length, 2);
    assert.ok(leadTasks.some((t: any) => t.title === 'Check email open status'));
    assert.ok(leadTasks.some((t: any) => t.title === 'Send follow-up ping'));
    assert.strictEqual(leadTasks[0].priority, 'High');
    assert.strictEqual(leadTasks[0].category, 'Follow-up');
  });

  await t.test('idempotent — does not create duplicate open tasks', async () => {
    const { db, leadService } = setupTestDb();
    const pbId = crypto.randomUUID();
    await db.insert(playbooks).values({ id: pbId, stage: 'Meeting', name: 'Meeting Playbook', isActive: true });
    await db.insert(playbookTasks).values([
      { id: crypto.randomUUID(), playbookId: pbId, title: 'Send recap email', daysOffset: 1, priority: 'High', category: 'Follow-up' },
    ]);

    const lead = await leadService.createLead({ name: 'Test Lead' });
    await leadService.updateStage(lead.id, 'Meeting');
    const tasksAfterFirst = await leadService.getTasks(lead.id);
    assert.strictEqual(tasksAfterFirst.length, 1);

    // call updateStage again with same stage — should not duplicate
    await leadService.updateStage(lead.id, 'Meeting');
    const tasksAfterSecond = await leadService.getTasks(lead.id);
    assert.strictEqual(tasksAfterSecond.length, 1);
  });

  await t.test('inactive playbook does not create tasks', async () => {
    const { db, leadService } = setupTestDb();
    const pbId = crypto.randomUUID();
    await db.insert(playbooks).values({ id: pbId, stage: 'Auditing', name: 'Audit Playbook', isActive: false });
    await db.insert(playbookTasks).values([
      { id: crypto.randomUUID(), playbookId: pbId, title: 'Run audit', daysOffset: 0, priority: 'Medium' },
    ]);

    const lead = await leadService.createLead({ name: 'Test Lead' });
    await leadService.updateStage(lead.id, 'Auditing');
    const leadTasks = await leadService.getTasks(lead.id);
    assert.strictEqual(leadTasks.length, 0);
  });

  await t.test('playbook fires on createLead when stage matches', async () => {
    const { db, leadService } = setupTestDb();
    const pbId = crypto.randomUUID();
    await db.insert(playbooks).values({ id: pbId, stage: 'Audited', name: 'Post-Audit', isActive: true });
    await db.insert(playbookTasks).values([
      { id: crypto.randomUUID(), playbookId: pbId, title: 'Review audit results', daysOffset: 1, priority: 'Medium' },
    ]);

    const lead = await leadService.createLead({ name: 'Audited Lead', stage: 'Audited' });
    const leadTasks = await leadService.getTasks(lead.id);
    assert.strictEqual(leadTasks.length, 1);
    assert.strictEqual(leadTasks[0].title, 'Review audit results');
  });
});
