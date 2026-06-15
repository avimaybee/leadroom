import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function getSecretKey(): Uint8Array {
  let secret: string | undefined;
  // Try Cloudflare context first (production worker)
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const cf = getCloudflareContext();
    secret = (cf?.env as any)?.AUTH_SECRET;
  } catch (e) {}
  // Fall back to process.env (local dev / tests)
  if (!secret) {
    secret = (typeof process !== 'undefined' ? process.env : undefined)?.AUTH_SECRET;
  }
  if (!secret) {
    throw new Error(
      'AUTH_SECRET environment variable is required but not set. ' +
      'Set it in .env.local (local dev) or as a Cloudflare secret (production). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  expiresAt: Date;
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecretKey());
}

export async function decrypt(session: string | undefined): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, getSecretKey(), {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}

export async function verifySession(session: string | undefined) {
  return decrypt(session);
}

export async function hashPassword(password: string, saltHex?: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  
  let saltBytes: Uint8Array;
  if (saltHex) {
    const matched = saltHex.match(/.{1,2}/g);
    if (!matched) throw new Error('Invalid salt hex format');
    saltBytes = new Uint8Array(matched.map(byte => parseInt(byte, 16)));
  } else {
    saltBytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  }
  
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256 // 32 bytes (256 bits)
  );
  
  const derivedHex = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const saltStr = Array.from(saltBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  return `${saltStr}:${derivedHex}`;
}

export async function verifyPassword(password: string, hashedPasswordHex: string): Promise<boolean> {
  const parts = hashedPasswordHex.split(':');
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;
  
  const computed = await hashPassword(password, saltHex);
  return computed === hashedPasswordHex;
}

/**
 * Returns the authenticated user ID from the session cookie.
 * Returns null if unauthenticated.
 * In test mode, returns a fixed test user ID.
 */
export async function getUserId(): Promise<string | null> {
  if (process.env.NODE_ENV === 'test') {
    return 'user_123';
  }
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    const payload = await decrypt(sessionToken);
    return payload?.userId || null;
  } catch (e) {
    return null;
  }
}

