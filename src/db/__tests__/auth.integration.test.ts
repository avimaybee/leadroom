import { test } from 'node:test';
import assert from 'node:assert';

process.env.AUTH_SECRET = 'test-only-secret-key-minimum-32-chars-long';
import { setupTestDb as initTestDb } from './test-helpers';
import { AuthService } from '../../services/auth';
import { users } from '../schema';

function setupTestDb() {
  const { db } = initTestDb();
  return { db, service: new AuthService(db as any) };
}


test('AuthService integration', async (t) => {
  const { service } = setupTestDb();

  await t.test('createUser should create a user with hashed password', async () => {
    const user = await service.createUser('John Doe', 'john@example.com', 'password123');
    assert.strictEqual(user.name, 'John Doe');
    assert.strictEqual(user.email, 'john@example.com');
  });

  await t.test('login should work with correct credentials', async () => {
    const result = await service.login('john@example.com', 'password123');
    assert.ok(result);
    assert.ok(result.session);
    assert.strictEqual(result.user.email, 'john@example.com');
  });

  await t.test('login should fail with incorrect password', async () => {
    const result = await service.login('john@example.com', 'wrongpassword');
    assert.strictEqual(result, null);
  });

  await t.test('login should fail with non-existent user', async () => {
    const result = await service.login('nonexistent@example.com', 'password123');
    assert.strictEqual(result, null);
  });
});
