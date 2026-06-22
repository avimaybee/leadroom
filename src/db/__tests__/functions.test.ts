import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { drizzle } from 'drizzle-orm/better-sqlite3';

// Ensure test environment
(process.env as any).NODE_ENV = 'test';

import { users } from '../schema/core';
import { GET as getScopes, POST as postScope } from '../../app/api/scopes/route';
import { GET as getCandidates, POST as postCandidate, PATCH as patchCandidate } from '../../app/api/candidates/route';
import { DiscoveryService } from '../../services/discovery';
import { MockD1Database } from '@/db/local-mock';

function setupTestDb() {
  const { sqlite } = initTestDb();
  const mockD1 = new MockD1Database(sqlite);
  // Inject mock into process.env.DB for getDb() to fetch
  (process as any).env = { ...process.env, DB: mockD1 };
  return { mockD1, sqlite };
}

test('API Endpoint - POST /api/scopes creates a scope successfully', async () => {
  setupTestDb();
  
  const payload = {
    name: 'Real Estate Agents',
    createdByUserId: 'user_123'
  };

  const request = new Request('https://localhost/api/scopes', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });

  const response = await postScope(request as any);
  if (response.status !== 201) {
    console.log('POST /api/scopes Error response body:', await response.text());
  }
  assert.strictEqual(response.status, 201);

  const body = await response.json() as any;
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.name, 'Real Estate Agents');
  assert.strictEqual(body.data.createdByUserId, 'user_123');
  assert.ok(body.data.id);
});

test('API Endpoint - GET /api/scopes returns empty list initially', async () => {
  setupTestDb();
  
  const request = new Request('https://localhost/api/scopes');

  const response = await getScopes(request as any);
  if (response.status !== 200) {
    console.log('GET /api/scopes Error response body:', await response.text());
  }
  assert.strictEqual(response.status, 200);

  const body = await response.json() as any;
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.length, 0);
});

test('API Endpoint - POST /api/candidates creates a candidate successfully', async () => {
  setupTestDb();

  const payload = {
    rawName: 'Dream Homes Realty',
    rawWebsiteUrl: 'https://dreamhomes.com',
    status: 'NEW'
  };

  const request = new Request('https://localhost/api/candidates', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });

  const response = await postCandidate(request as any);
  if (response.status !== 201) {
    console.log('POST /api/candidates Error response body:', await response.text());
  }
  assert.strictEqual(response.status, 201);

  const body = await response.json() as any;
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.rawName, 'Dream Homes Realty');
  assert.strictEqual(body.data.rawWebsiteUrl, 'https://dreamhomes.com');
  assert.ok(body.data.id);
});

test('API Endpoint - PATCH /api/candidates updates status successfully', async () => {
  const { sqlite } = setupTestDb();
  const db = drizzle(sqlite);
  const service = new DiscoveryService(db as any);

  // Setup candidate
  await service.createCandidateLead('cand_123', {
    rawName: 'Dream Homes Realty',
    status: 'NEW'
  });

  const payload = {
    id: 'cand_123',
    status: 'DISCARDED'
  };

  const request = new Request('https://localhost/api/candidates', {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });

  const response = await patchCandidate(request as any);
  if (response.status !== 200) {
    console.log('PATCH /api/candidates status Error response body:', await response.text());
  }
  assert.strictEqual(response.status, 200);

  const body = await response.json() as any;
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.status, 'DISCARDED');
});

test('API Endpoint - PATCH /api/candidates promotes candidate successfully', async () => {
  const { sqlite } = setupTestDb();
  const db = drizzle(sqlite);
  const service = new DiscoveryService(db as any);

  // Insert user to avoid FK error
  await db.insert(users).values({
    id: 'user_123',
    name: 'Owner User',
    email: 'owner@test.com',
    password: 'password_hash',
  });

  // Setup scope
  await service.createScope('scope_1', {
    name: 'Real Estate Agents',
    createdByUserId: 'user_123'
  });

  // Setup candidate
  await service.createCandidateLead('cand_123', {
    discoveryScopeId: 'scope_1',
    rawName: 'Dream Homes Realty',
    status: 'NEW'
  });

  const payload = {
    id: 'cand_123',
    status: 'PROMOTED',
    ownerId: 'user_123'
  };

  const request = new Request('https://localhost/api/candidates', {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });

  const response = await patchCandidate(request as any);
  if (response.status !== 200) {
    console.log('PATCH /api/candidates promote Error response body:', await response.text());
  }
  assert.strictEqual(response.status, 200);

  const body = await response.json() as any;
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.name, 'Dream Homes Realty');
  assert.strictEqual(body.data.ownerId, 'user_123');
});
