const { setupTestDb } = require('../src/db/__tests__/test-helpers');
const { DiscoveryService } = require('../src/services/discovery');

async function main() {
  try {
    const { db } = setupTestDb();
    const service = new DiscoveryService(db);

    // Create user_admin
    await db.insert(require('../src/db/schema/core').users).values({
      id: 'user_admin',
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password_hash',
    });

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
    await db.insert(require('../src/db/schema/core').users).values({
      id: 'owner_123',
      name: 'Owner User',
      email: 'owner@test.com',
      password: 'password_hash',
    });

    // Promote
    console.log('Running promoteCandidate...');
    const promotedLead = await service.promoteCandidate('cand_1', 'owner_123');
    console.log('Promote successful:', promotedLead);
  } catch (err) {
    console.error('ERROR ENCOUNTERED:');
    console.error(err);
  }
}

main();
