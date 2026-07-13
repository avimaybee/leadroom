import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema/core';
import { encrypt } from '@/lib/auth';
import { eq } from 'drizzle-orm';

const log = getLogger('FirebaseAuthAPI');

const FIREBASE_API_KEY = 'AIzaSyCaf1FHg56-HIa-39FkPEY3146guGiZCX8';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json() as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    // Verify the Firebase ID token using Google's Identity Toolkit API
    const verifyResp = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
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
    const isSecure = request.url.startsWith('https://');
    response.headers.append(
      'Set-Cookie',
      `session=${session}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=86400`
    );

    return response;
  } catch (error: unknown) {
    log.error('Firebase auth error', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
