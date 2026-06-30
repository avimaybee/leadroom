import { test } from 'node:test';
import assert from 'node:assert';
import { encrypt, decrypt } from '../../crypto';

test('crypto encryption and decryption', async (t) => {
  const secret = 'my_super_secret_key_1234567890';

  await t.test('encrypt and decrypt returns original text', async () => {
    const originalText = 'hello world! 123';
    const encrypted = await encrypt(originalText, secret);
    assert.notStrictEqual(encrypted, originalText);
    
    const decrypted = await decrypt(encrypted, secret);
    assert.strictEqual(decrypted, originalText);
  });

  await t.test('decrypt empty string returns empty string', async () => {
    const decrypted = await decrypt('', secret);
    assert.strictEqual(decrypted, '');
  });

  await t.test('decrypt plaintext fallback on non-hex string', async () => {
    const plaintext = 'AIzaSyAl-t6qvZbBu5ht948fJNxOFxLwVF0kgo0';
    const decrypted = await decrypt(plaintext, secret);
    // Should fallback to returning the original string instead of crashing
    assert.strictEqual(decrypted, plaintext);
  });

  await t.test('decrypt plaintext fallback on invalid hex length', async () => {
    const invalidHex = 'aabbcc'; // Too short to have 12-byte IV + data
    const decrypted = await decrypt(invalidHex, secret);
    assert.strictEqual(decrypted, invalidHex);
  });

  await t.test('decrypt fallback on wrong decryption key', async () => {
    const originalText = 'sensitive info';
    const encrypted = await encrypt(originalText, secret);
    
    // Decrypting with wrong secret should fail decryption and fallback to returning the encrypted string
    const decrypted = await decrypt(encrypted, 'wrong_secret_key');
    assert.strictEqual(decrypted, encrypted);
  });
});
