import { test } from 'node:test';
import { setupTestDb as initTestDb } from './test-helpers';
import { LeadService } from '../../services/lead';
import * as assert from 'node:assert';
import { researchSnapshots, outreachDrafts } from '../schema';

function setupTestDb() {
  const { db } = initTestDb();
  const leadService = new LeadService(db as any);
  return { db, leadService };
}

test('Stage auto tasks (replaces playbooks)', async (t) => {
  await t.test('Contacted creates default tasks', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Test Lead', stage: 'New' });
    // Seed requirements: research snapshot + outreach draft
    await db.insert(researchSnapshots).values({ id: crypto.randomUUID(), leadId: lead.id, companySummary: 'Test', confidenceLevel: 'HIGH', createdAt: new Date() });
    await db.insert(outreachDrafts).values({ id: crypto.randomUUID(), leadId: lead.id, channel: 'EMAIL', status: 'DRAFT', subject: 'Test', body: 'Test body', origin: 'AI_GENERATED', createdAt: new Date(), updatedAt: new Date() });
    await leadService.updateStage(lead.id, 'Contacted');
    const leadTasks = await leadService.getTasks(lead.id);

    assert.strictEqual(leadTasks.length, 2);
    assert.ok(leadTasks.some((t: any) => t.title === 'Check for reply'));
    assert.ok(leadTasks.some((t: any) => t.title === 'Follow up if no reply'));
  });

  await t.test('In Research creates default review task', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Test Lead', stage: 'New' });
    // Seed requirement: research snapshot
    await db.insert(researchSnapshots).values({ id: crypto.randomUUID(), leadId: lead.id, companySummary: 'Test', confidenceLevel: 'HIGH', createdAt: new Date() });
    await leadService.updateStage(lead.id, 'In Research');
    const tasks = await leadService.getTasks(lead.id);
    assert.ok(tasks.some((t: any) => t.title === 'Review prospect research'));
  });

  await t.test('Meeting Booked creates log-outcome task', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Test Lead' });
    await db.insert(researchSnapshots).values({ id: crypto.randomUUID(), leadId: lead.id, companySummary: 'Test', confidenceLevel: 'HIGH', createdAt: new Date() });
    await db.insert(outreachDrafts).values({ id: crypto.randomUUID(), leadId: lead.id, channel: 'EMAIL', status: 'DRAFT', subject: 'Test', body: 'Test body', origin: 'AI_GENERATED', createdAt: new Date(), updatedAt: new Date() });
    await leadService.updateStage(lead.id, 'Meeting Booked');
    const tasks = await leadService.getTasks(lead.id);
    assert.ok(tasks.some((t: any) => t.title === 'Log meeting outcome'));
  });

  await t.test('idempotent — does not create duplicate open tasks', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Test Lead' });
    // Seed requirements: research snapshot + outreach draft
    await db.insert(researchSnapshots).values({ id: crypto.randomUUID(), leadId: lead.id, companySummary: 'Test', confidenceLevel: 'HIGH', createdAt: new Date() });
    await db.insert(outreachDrafts).values({ id: crypto.randomUUID(), leadId: lead.id, channel: 'EMAIL', status: 'DRAFT', subject: 'Test', body: 'Test body', origin: 'AI_GENERATED', createdAt: new Date(), updatedAt: new Date() });
    await leadService.updateStage(lead.id, 'Contacted');
    const tasksAfterFirst = await leadService.getTasks(lead.id);
    assert.strictEqual(tasksAfterFirst.length, 2);

    // call updateStage again with same stage — should not duplicate
    await leadService.updateStage(lead.id, 'Contacted');
    const tasksAfterSecond = await leadService.getTasks(lead.id);
    assert.strictEqual(tasksAfterSecond.length, 2);
  });

  await t.test('stages without auto tasks create none', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Test Lead' });
    await leadService.updateStage(lead.id, 'New');
    const tasks = await leadService.getTasks(lead.id);
    assert.strictEqual(tasks.length, 0);
  });
});
