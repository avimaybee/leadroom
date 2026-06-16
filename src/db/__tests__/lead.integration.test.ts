import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { LeadService } from '../../services/lead';
import { leads, activities } from '../schema/core';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const { db } = initTestDb();
  return { db, service: new LeadService(db as any) };
}

test('LeadService integration', async (t) => {
  const { service } = setupTestDb();

  await t.test('createLead should create a lead and log activity', async () => {
    const lead = await service.createLead({
      name: 'Jane Smith',
      company: 'Jane Corp',
      industry: 'Technology',
    });
    assert.strictEqual(lead.name, 'Jane Smith');
    assert.strictEqual(lead.company, 'Jane Corp');
    assert.strictEqual(lead.stage, 'New');

    const logs = await service['db'].select().from(activities).where(eq(activities.leadId, lead.id));
    const creationLog = logs.find((l: any) => l.type === 'Lead created');
    assert.ok(creationLog);
  });

  await t.test('listLeads should return active leads', async () => {
    await service.createLead({ name: 'Lead 1' });
    await service.createLead({ name: 'Lead 2' });
    
    const list = await service.listLeads();
    assert.ok(list.length >= 2);
  });

  await t.test('archiveLead should mark lead as Archived', async () => {
    const lead = await service.createLead({ name: 'To Archive' });
    const archived = await service.archiveLead(lead.id);
    assert.strictEqual(archived.status, 'Archived');
    
    const list = await service.listLeads();
    assert.ok(!list.find((l: any) => l.id === lead.id));
  });

  await t.test('updateStage should change stage and create activity log', async () => {
    const lead = await service.createLead({ name: 'Stage Test' });
    const updated = await service.updateStage(lead.id, 'Qualified');
    
    assert.strictEqual(updated.stage, 'Qualified');

    const logs = await service['db'].select().from(activities).where(eq(activities.leadId, lead.id));
    
    const stageLog = logs.find((l: any) => l.type === 'Stage changed');
    assert.ok(stageLog);
    assert.strictEqual(stageLog.summary, 'Stage changed from New to Qualified');
  });

  await t.test('addNote should insert a note and log activity', async () => {
    const lead = await service.createLead({ name: 'Note Test Lead' });
    const note = await service.addNote(lead.id, null, 'This is a test note for our client.');
    assert.ok(note);
    assert.strictEqual(note.body, 'This is a test note for our client.');

    const notesList = await service.getNotes(lead.id);
    assert.strictEqual(notesList.length, 1);
    assert.strictEqual(notesList[0].id, note.id);

    const logs = await service.getActivities(lead.id);
    const noteLog = logs.find((l: any) => l.type === 'Note added');
    assert.ok(noteLog);
    assert.ok(noteLog.summary.includes('This is a test note'));
  });

  await t.test('addTask and toggleTaskStatus should manage tasks', async () => {
    const lead = await service.createLead({ name: 'Task Test Lead' });
    const task = await service.addTask(lead.id, 'Follow up call', 'Call next Monday', null, 'High');
    assert.ok(task);
    assert.strictEqual(task.title, 'Follow up call');
    assert.strictEqual(task.status, 'Open');

    const tasksList = await service.getTasks(lead.id);
    assert.strictEqual(tasksList.length, 1);
    assert.strictEqual(tasksList[0].id, task.id);

    const toggled = await service.toggleTaskStatus(task.id, 'Open');
    assert.strictEqual(toggled.status, 'Completed');
    assert.ok(toggled.completedAt);

    const logs = await service.getActivities(lead.id);
    const taskLog = logs.find((l: any) => l.type === 'Task updated');
    assert.ok(taskLog);
    assert.ok(taskLog.summary.includes('marked as Completed'));
  });
});
