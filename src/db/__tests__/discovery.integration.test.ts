import { test } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { DiscoveryService } from '../../services/discovery';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const sqlite = new Database(':memory:');
  
  // Create tables manually for testing without migration files
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
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
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      type TEXT NOT NULL,
      summary TEXT NOT NULL,
      timestamp INTEGER
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
  return { db, service: new DiscoveryService(db as any) };
}

test('DiscoveryService - createScope and listScopes works', async () => {
  const { service } = setupTestDb();

  const scopeInput = {
    name: 'Dentists in Austin',
    description: 'Austin area dentist offices',
    industryFilter: 'Healthcare/Dental',
    geographyFilter: 'Austin, TX',
    createdByUserId: 'user_admin',
  };

  const created = await service.createScope('scope_1', scopeInput);
  assert.ok(created);
  assert.strictEqual(created.id, 'scope_1');
  assert.strictEqual(created.name, 'Dentists in Austin');
  assert.strictEqual(created.createdByUserId, 'user_admin');
  assert.ok(created.createdAt);

  const list = await service.listScopes();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].id, 'scope_1');
});

test('DiscoveryService - createCandidateLead and listCandidatesByScope works', async () => {
  const { service } = setupTestDb();

  // Create parent scope
  await service.createScope('scope_1', {
    name: 'Dentists in Austin',
    createdByUserId: 'user_admin',
  });

  const candidateInput = {
    discoveryScopeId: 'scope_1',
    rawName: 'Austin Smiles Dentistry',
    rawWebsiteUrl: 'https://austinsmiles.com',
    status: 'NEW' as const,
  };

  const created = await service.createCandidateLead('candidate_1', candidateInput);
  assert.ok(created);
  assert.strictEqual(created.id, 'candidate_1');
  assert.strictEqual(created.rawName, 'Austin Smiles Dentistry');
  assert.strictEqual(created.discoveryScopeId, 'scope_1');

  const list = await service.listCandidatesByScope('scope_1');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].id, 'candidate_1');
});

test('DiscoveryService - updateCandidateStatus works', async () => {
  const { service } = setupTestDb();
  await service.createCandidateLead('cand_1', {
    rawName: 'Test Candidate',
    status: 'NEW',
  });

  const updated = await service.updateCandidateStatus('cand_1', 'REVIEWED');
  assert.ok(updated);
  assert.strictEqual(updated.status, 'REVIEWED');
});

test('DiscoveryService - promoteCandidate works', async () => {
  const { db, service } = setupTestDb();

  // Create parent scope
  await service.createScope('scope_1', {
    name: 'Dentists in Austin',
    createdByUserId: 'user_admin',
  });

  // Create candidate
  await service.createCandidateLead('cand_1', {
    discoveryScopeId: 'scope_1',
    rawName: 'Austin Smiles Dentistry',
    rawWebsiteUrl: 'https://austinsmiles.com',
    rawLocation: 'Austin, TX',
    status: 'NEW',
    triagePriority: 'MEDIUM',
    triageReason: 'Website outdated',
  });

  // Create test user to satisfy foreign key constraint
  await db.insert(require('../schema/core').users).values({
    id: 'owner_123',
    name: 'Owner User',
    email: 'owner@test.com',
    password: 'password_hash',
  });

  // Promote
  const promotedLead = await service.promoteCandidate('cand_1', 'owner_123');
  assert.ok(promotedLead);
  assert.strictEqual(promotedLead.name, 'Austin Smiles Dentistry');
  assert.strictEqual(promotedLead.website, 'https://austinsmiles.com');
  assert.strictEqual(promotedLead.city, 'Austin, TX');
  assert.strictEqual(promotedLead.ownerId, 'owner_123');
  assert.strictEqual(promotedLead.stage, 'New');
  assert.strictEqual(promotedLead.triagePriority, 'MEDIUM');
  assert.strictEqual(promotedLead.triageReason, 'Website outdated');

  // Verify baseline score calculated
  const [score] = await db.select().from(require('../schema/audits').leadScores).where(eq(require('../schema/audits').leadScores.leadId, promotedLead.id));
  assert.ok(score);
  assert.strictEqual(score.scoreLabel, 'Low'); // 10 base + 15 website + 5 location + 5 triage medium = 35 -> Low (< 45)
  assert.ok(score.scoreValue > 0);

  // Verify candidate status updated
  const candidates = await service.listCandidatesByScope('scope_1');
  assert.strictEqual(candidates[0].status, 'PROMOTED');
  assert.strictEqual(candidates[0].promotedLeadId, promotedLead.id);

  // Verify activity logs were created
  const results = await db.select().from(require('../schema/core').activities);
  assert.strictEqual(results.length, 2);
  
  const systemLog = results.find(r => r.type === 'SYSTEM');
  assert.ok(systemLog);
  assert.strictEqual(systemLog.leadId, promotedLead.id);
  assert.ok(systemLog.summary.includes('Scope: Dentists in Austin'));

  const scoreLog = results.find(r => r.type === 'Score updated');
  assert.ok(scoreLog);
  assert.strictEqual(scoreLog.leadId, promotedLead.id);
});
