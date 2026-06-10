import { test } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { DiscoveryService } from '../../services/discovery';

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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
      promoted_lead_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const db = drizzle(sqlite);
  return { db, service: new DiscoveryService(db) };
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

  // Verify candidate status updated
  const candidates = await service.listCandidatesByScope('scope_1');
  assert.strictEqual(candidates[0].status, 'PROMOTED');
  assert.strictEqual(candidates[0].promotedLeadId, promotedLead.id);

  // Verify activity log was created
  const results = await db.select().from(require('../schema/core').activities);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].leadId, promotedLead.id);
  assert.strictEqual(results[0].type, 'SYSTEM');
  assert.ok(results[0].summary.includes('Scope: Dentists in Austin'));
});
