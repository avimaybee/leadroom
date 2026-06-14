import { test } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { ResearchService } from '../../services/research';
import { LeadService } from '../../services/lead';
import { activities } from '../schema/core';
import { jobRuns, researchSnapshots, contacts } from '../schema/research';
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

    CREATE TABLE provider_configs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL UNIQUE,
      api_key TEXT NOT NULL,
      model_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE job_runs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      target_lead_id TEXT REFERENCES leads(id),
      triggered_by_user_id TEXT REFERENCES users(id),
      error_summary TEXT,
      external_run_id TEXT,
      job_meta TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE research_snapshots (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      created_by_user_id TEXT REFERENCES users(id),
      origin TEXT NOT NULL DEFAULT 'AI_GENERATED',
      snapshot_title TEXT,
      company_summary TEXT,
      products_services_summary TEXT,
      digital_presence_notes TEXT,
      website_notes TEXT,
      branding_notes TEXT,
      pain_points_hypotheses TEXT,
      opportunity_hypotheses TEXT,
      sources TEXT,
      confidence_level TEXT NOT NULL DEFAULT 'UNKNOWN',
      user_remarks TEXT,
      job_run_id TEXT REFERENCES job_runs(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE contacts (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      full_name TEXT,
      role_title TEXT,
      email TEXT,
      phone TEXT,
      linkedin_url TEXT,
      other_profile_url TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      confidence_level TEXT NOT NULL DEFAULT 'UNKNOWN',
      source_type TEXT NOT NULL DEFAULT 'MANUAL',
      created_by_user_id TEXT REFERENCES users(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      deleted_at INTEGER
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
  return {
    db,
    leadService: new LeadService(db),
    researchService: new ResearchService(db),
  };
}

test('ResearchService integration', async (t) => {
  const { leadService, researchService, db } = setupTestDb();

  await t.test('saveResearchSnapshot should store manual edits historically', async () => {
    const lead = await leadService.createLead({ name: 'Manual Edit Test' });
    
    const snapshot = await researchService.saveResearchSnapshot(lead.id, {
      companySummary: 'Handwritten summary',
      productsServicesSummary: 'Handwritten products',
      digitalPresenceNotes: 'Social active',
      websiteNotes: 'Clean UX',
      brandingNotes: 'Excellent theme',
      painPointsHypotheses: 'Scaling operations',
      opportunityHypotheses: 'New logo redesign',
      sources: ['https://customsource.com'],
      confidenceLevel: 'HIGH',
    }, null);

    assert.ok(snapshot);
    assert.strictEqual(snapshot.origin, 'MANUAL');
    assert.strictEqual(snapshot.companySummary, 'Handwritten summary');

    const latest = await researchService.getLatestResearch(lead.id);
    assert.strictEqual(latest?.id, snapshot.id);

    // Verify activity log
    const logs = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const manualLog = logs.find((l: any) => l.type === 'Research updated');
    assert.ok(manualLog);
  });

  await t.test('addContact and getContacts should manage stakeholder list', async () => {
    const lead = await leadService.createLead({ name: 'Contact Holder Corp' });

    const c1 = await researchService.addContact(lead.id, {
      fullName: 'Alice Manager',
      roleTitle: 'Product Manager',
      email: 'alice@holder.com',
      isPrimary: false,
    }, null);

    const c2 = await researchService.addContact(lead.id, {
      fullName: 'Bob VP',
      roleTitle: 'VP Marketing',
      email: 'bob@holder.com',
      isPrimary: true,
    }, null);

    const list = await researchService.getContacts(lead.id);
    assert.strictEqual(list.length, 2);
    
    // Bob should be first because he is primary
    assert.strictEqual(list[0].id, c2.id);
    assert.strictEqual(list[0].isPrimary, 1);
    
    // Alice should be second
    assert.strictEqual(list[1].id, c1.id);
    assert.strictEqual(list[1].isPrimary, 0);

    // If we add another primary contact, Bob should be demoted
    const c3 = await researchService.addContact(lead.id, {
      fullName: 'Charlie CEO',
      roleTitle: 'CEO',
      email: 'charlie@holder.com',
      isPrimary: true,
    }, null);

    const updatedList = await researchService.getContacts(lead.id);
    assert.strictEqual(updatedList[0].id, c3.id);
    assert.strictEqual(updatedList[0].isPrimary, 1);
    
    const bobUpdated = updatedList.find((c: any) => c.id === c2.id);
    assert.strictEqual(bobUpdated?.isPrimary, 0);
  });

  await t.test('updateContact should modify contact details and handle primary swap', async () => {
    const { leadService, researchService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Contact Update Test' });

    const c1 = await researchService.addContact(lead.id, {
      fullName: 'Alice Developer',
      isPrimary: true,
    }, null);

    const c2 = await researchService.addContact(lead.id, {
      fullName: 'Bob Engineer',
      isPrimary: false,
    }, null);

    // Update c2 to be primary
    await researchService.updateContact(lead.id, c2.id, {
      fullName: 'Bob Manager',
      isPrimary: true,
    }, null);

    const list = await researchService.getContacts(lead.id);
    const updatedC1 = list.find(c => c.id === c1.id);
    const updatedC2 = list.find(c => c.id === c2.id);

    assert.strictEqual(updatedC2?.fullName, 'Bob Manager');
    assert.strictEqual(updatedC2?.isPrimary, 1);
    // Alice should be demoted
    assert.strictEqual(updatedC1?.isPrimary, 0);
  });

  await t.test('deleteContact should soft delete the contact and set deletedAt', async () => {
    const { leadService, researchService, db } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Contact Delete Test' });

    const c1 = await researchService.addContact(lead.id, {
      fullName: 'Alice Developer',
    }, null);

    await researchService.deleteContact(lead.id, c1.id, null);

    const list = await researchService.getContacts(lead.id);
    // getContacts filters out soft deleted contacts
    assert.strictEqual(list.length, 0);

    // Verify contact still exists in DB but with deletedAt set
    const [dbContact] = await db.select().from(contacts).where(eq(contacts.id, c1.id)).limit(1);
    assert.ok(dbContact);
    assert.ok(dbContact.deletedAt);
  });
});
