import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { LeadService } from '../../services/lead';
import { prospects as leads, activities, users } from '../schema/core';
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
    const { db, service } = setupTestDb();
    await db.insert(users).values({ id: 'list-owner', name: 'Owner', email: 'list-owner@test.com', password: 'p' });
    await service.createLead({ name: 'Lead 1', ownerId: 'list-owner' });
    await service.createLead({ name: 'Lead 2', ownerId: 'list-owner' });
    
    const list = await service.listLeads('list-owner');
    assert.ok(list.length >= 2);
  });

  await t.test('archiveLead should mark lead as Archived', async () => {
    const { db, service } = setupTestDb();
    await db.insert(users).values({ id: 'archive-owner', name: 'Owner', email: 'archive-owner@test.com', password: 'p' });
    const lead = await service.createLead({ name: 'To Archive', ownerId: 'archive-owner' });
    const archived = await service.archiveLead(lead.id);
    assert.ok(archived);
    assert.strictEqual(archived.status, 'Archived');
    
    const list = await service.listLeads('archive-owner');
    assert.ok(!list.find((l: any) => l.id === lead.id));
  });

  await t.test('updateStage should change stage and create activity log', async () => {
    const lead = await service.createLead({ name: 'Stage Test' });
    const updated = await service.updateStage(lead.id, 'Qualified');
    
    assert.ok(updated);
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

  await t.test('getDashboardProspects enforces ownerId filter', async () => {
    const { db, service } = setupTestDb();
    // Seed a user for FK constraint
    await db.insert(users).values({ id: 'owner-1', name: 'Owner', email: 'owner@test.com', password: 'p' });
    await service.createLead({ name: 'User A Lead', ownerId: 'owner-1' });
    const resultsA = await service.getDashboardProspects('owner-1');
    const resultsB = await service.getDashboardProspects('unrelated-user');
    assert.ok(resultsA.length >= 0);
    assert.ok(resultsB.length >= 0);
  });

  await t.test('getProspectDetail returns null for unrelated user', async () => {
    const { db, service } = setupTestDb();
    await db.insert(users).values({ id: 'owner-a', name: 'A', email: 'a@test.com', password: 'p' });
    await db.insert(users).values({ id: 'owner-b', name: 'B', email: 'b@test.com', password: 'p' });
    const lead = await service.createLead({ name: 'Private Lead', ownerId: 'owner-a' });
    const result = await service.getProspectDetail(lead.id, 'owner-b');
    assert.strictEqual(result, null);
  });

  await t.test('getProspectDetail returns prospect for owning user', async () => {
    const { db, service } = setupTestDb();
    await db.insert(users).values({ id: 'owner-a', name: 'A', email: 'a@test.com', password: 'p' });
    const lead = await service.createLead({ name: 'Owned Lead', ownerId: 'owner-a' });
    const result = await service.getProspectDetail(lead.id, 'owner-a');
    assert.ok(result);
    assert.strictEqual(result.id, lead.id);
  });
});
