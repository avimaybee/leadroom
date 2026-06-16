import { test } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { LeadService } from '../../services/lead';
import { leads, activities } from '../schema/core';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const sqlite = new Database(':memory:');
  
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      city TEXT,
      region TEXT,
      industry TEXT,
      stage TEXT NOT NULL DEFAULT 'New',
      status TEXT NOT NULL DEFAULT 'Active',
      triage_priority TEXT DEFAULT 'UNASSESSED',
      triage_reason TEXT,
      owner_id TEXT REFERENCES users(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      type TEXT NOT NULL,
      summary TEXT NOT NULL,
      timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE discovery_scopes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      industry_filter TEXT,
      geography_filter TEXT,
      company_size_filter TEXT,
      business_type_filter TEXT,
      digital_presence_filter TEXT,
      notes TEXT,
      created_by_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE candidate_leads (
      id TEXT PRIMARY KEY,
      discovery_scope_id TEXT REFERENCES discovery_scopes(id),
      raw_name TEXT NOT NULL,
      raw_website_url TEXT,
      raw_contact_info TEXT,
      raw_location TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'NEW',
      triage_priority TEXT DEFAULT 'UNASSESSED' NOT NULL,
      triage_reason TEXT,
      promoted_lead_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      lead_id TEXT REFERENCES leads(id),
      due_date INTEGER,
      status TEXT NOT NULL DEFAULT 'Open',
      priority TEXT NOT NULL DEFAULT 'Medium',
      created_at INTEGER,
      updated_at INTEGER,
      completed_at INTEGER
    );

    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      author_id TEXT REFERENCES users(id),
      body TEXT NOT NULL,
      created_at INTEGER
    );

    CREATE TABLE audits (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      created_by_user_id TEXT REFERENCES users(id),
      origin TEXT NOT NULL DEFAULT 'AI_GENERATED',
      website_quality_score INTEGER,
      design_aesthetic_score INTEGER,
      messaging_clarity_score INTEGER,
      social_presence_score INTEGER,
      overall_branding_score INTEGER,
      key_strengths TEXT,
      key_weaknesses TEXT,
      recommended_improvements TEXT,
      is_modern INTEGER,
      triage_reason TEXT,
      opportunity_notes TEXT,
      sources TEXT,
      job_run_id TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE lead_scores (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      score_value INTEGER NOT NULL,
      score_label TEXT,
      rationale_summary TEXT,
      factors TEXT,
      origin TEXT NOT NULL DEFAULT 'RULE_BASED',
      is_current INTEGER NOT NULL DEFAULT 1,
      created_by_user_id TEXT REFERENCES users(id),
      job_run_id TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  const db = drizzle(sqlite);
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
