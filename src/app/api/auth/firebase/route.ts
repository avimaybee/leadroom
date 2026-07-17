import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema/core';
import { encrypt } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { eq } from 'drizzle-orm';

const log = getLogger('FirebaseAuthAPI');

const FirebaseAuthSchema = z.object({
  idToken: z.string().min(1),
});

function getFirebaseApiKey(): string {
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const cfEnv = getCloudflareContext().env;
    if (cfEnv?.NEXT_PUBLIC_FIREBASE_API_KEY) return cfEnv.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (cfEnv?.FIREBASE_API_KEY) return cfEnv.FIREBASE_API_KEY;
  } catch {}
  return process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit(`firebase:${ip}`, 20, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.reset - Date.now()) / 1000)) } },
      );
    }

    const body = await request.json();
    const parsed = FirebaseAuthSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }
    const { idToken } = parsed.data;

    const apiKey = getFirebaseApiKey();

    // Verify the Firebase ID token using Google's Identity Toolkit API
    const verifyResp = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!verifyResp.ok) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const verifyData = await verifyResp.json() as any;
    const firebaseUser = verifyData?.users?.[0];
    if (!firebaseUser?.email) {
      return NextResponse.json({ error: 'Invalid user data' }, { status: 401 });
    }

    const db = getDb();

    // Look up existing user by Firebase UID or email
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, firebaseUser.email))
      .limit(1);

    if (!user) {
      // Create new user from Firebase data
      const [newUser] = await db.insert(users).values({
        id: crypto.randomUUID(),
        name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        email: firebaseUser.email,
        password: '__firebase__',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      user = newUser;
    }

    const session = await encrypt({
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    response.headers.append(
      'Set-Cookie',
      `__Secure-session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
    );

    return response;
  } catch (error: unknown) {
    log.error('Firebase auth error', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
