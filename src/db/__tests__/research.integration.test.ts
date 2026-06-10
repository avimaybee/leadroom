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

    CREATE TABLE job_runs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      target_lead_id TEXT REFERENCES leads(id),
      triggered_by_user_id TEXT REFERENCES users(id),
      error_summary TEXT,
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

  await t.test('enrichLead should run enrichment and save snapshot', async () => {
    const lead = await leadService.createLead({
      name: 'Innovative Tech Solutions',
      company: 'Innovative Tech',
      industry: 'Software Development',
      website: 'https://innovativetech.io',
    });

    const snapshot = await researchService.enrichLead(lead.id, null);
    assert.ok(snapshot);
    assert.strictEqual(snapshot.leadId, lead.id);
    assert.strictEqual(snapshot.origin, 'AI_GENERATED');
    assert.ok(snapshot.companySummary);
    assert.ok(snapshot.opportunityHypotheses);
    assert.strictEqual(snapshot.confidenceLevel, 'MEDIUM'); // fallback mock default

    // Verify JobRun was completed
    const runs = await db.select().from(jobRuns).where(eq(jobRuns.targetLeadId, lead.id));
    assert.strictEqual(runs.length, 1);
    assert.strictEqual(runs[0].status, 'COMPLETED');
    assert.strictEqual(runs[0].jobType, 'ENRICHMENT');

    // Verify system activity log was created
    const logs = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const enrichmentLog = logs.find((l: any) => l.type === 'Research generated');
    assert.ok(enrichmentLog);
  });

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
});
