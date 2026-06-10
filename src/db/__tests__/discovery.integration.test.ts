import { test } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { DiscoveryService } from '../../services/discovery';

function setupTestDb() {
  const sqlite = new Database(':memory:');
  
  // Create tables manually for testing without migration files
  sqlite.exec(`
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
