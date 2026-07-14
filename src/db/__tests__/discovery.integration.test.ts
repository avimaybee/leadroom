import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { DiscoveryService } from '../../services/discovery';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const { db } = initTestDb();
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

test('DiscoveryService - updateCandidateStatus with discard reason works', async () => {
  const { service } = setupTestDb();
  await service.createCandidateLead('cand_discard', {
    rawName: 'Discard Test',
    status: 'NEW',
  });

  const updated = await service.updateCandidateStatus('cand_discard', 'DISCARDED', 'Wrong industry');
  assert.ok(updated);
  assert.strictEqual(updated.status, 'DISCARDED');
  assert.strictEqual(updated.discardReason, 'Wrong industry');
});

test('DiscoveryService - updateCandidate edits fields', async () => {
  const { service } = setupTestDb();
  await service.createCandidateLead('cand_edit', {
    rawName: 'Old Name',
    rawWebsiteUrl: 'https://old.com',
    rawLocation: 'Old City',
    status: 'NEW',
  });

  const updated = await service.updateCandidate('cand_edit', {
    rawName: 'New Name',
    rawWebsiteUrl: 'https://new.com',
    rawLocation: 'New City',
  });
  assert.ok(updated);
  assert.strictEqual(updated.rawName, 'New Name');
  assert.strictEqual(updated.rawWebsiteUrl, 'https://new.com');
  assert.strictEqual(updated.rawLocation, 'New City');
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

  // Verify baseline score calculated
  const [score] = await db.select().from(require('../schema/audits').leadScores).where(eq(require('../schema/audits').leadScores.leadId, promotedLead.id));
  assert.ok(score);
  assert.strictEqual(score.scoreValue, 30);
  assert.ok(score.scoreValue > 0);

  // Poll database until the background simulation job finishes
  const { jobRuns } = require('../schema/research');
  for (let i = 0; i < 40; i++) {
    const [job] = await db.select().from(jobRuns).where(eq(jobRuns.targetLeadId, promotedLead.id)).limit(1);
    if (job && (job.status === 'COMPLETED' || job.status === 'FAILED')) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Verify candidate status updated
  const candidates = await service.listCandidatesByScope('scope_1');
  assert.strictEqual(candidates[0].status, 'PROMOTED');
  assert.strictEqual(candidates[0].promotedLeadId, promotedLead.id);

  // Verify activity logs were created
  const results = await db.select().from(require('../schema/core').activities);
  
  const systemLog = results.find(r => r.type === 'SYSTEM');
  assert.ok(systemLog);
  assert.strictEqual(systemLog.leadId, promotedLead.id);
  assert.ok(systemLog.summary.includes('Scope: Dentists in Austin'));

  const scoreLog = results.find(r => r.type === 'Score updated');
  assert.ok(scoreLog);
  assert.strictEqual(scoreLog.leadId, promotedLead.id);
});
