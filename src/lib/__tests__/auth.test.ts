import { test } from 'node:test';
import assert from 'node:assert';
import { verifySession } from '../auth.js';

test('auth guard', async (t) => {
  await t.test('verifySession should return null for missing session', async () => {
    const session = await verifySession(undefined);
    assert.strictEqual(session, null);
  });

  await t.test('verifySession should return null for invalid session', async () => {
    const session = await verifySession('invalid-token');
    assert.strictEqual(session, null);
  });
});
