const ENCRYPTION_KEY_VAR = 'DB_ENCRYPTION_KEY';

async function getKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(text: string, secret: string): Promise<string> {
  if (!text) return '';
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  const buffer = new Uint8Array(iv.length + encrypted.byteLength);
  buffer.set(iv, 0);
  buffer.set(new Uint8Array(encrypted), iv.length);
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function decrypt(hexString: string, secret: string): Promise<string> {
  if (!hexString) return '';
  try {
    const key = await getKey(secret);
    const matches = hexString.match(/.{1,2}/g);
    if (!matches) return hexString;

    const parsedBytes = matches.map(byte => parseInt(byte, 16));
    if (parsedBytes.some(isNaN)) {
      return hexString;
    }

    const bytes = new Uint8Array(parsedBytes);
    if (bytes.length < 13) {
      return hexString;
    }

    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return hexString;
  }
}
