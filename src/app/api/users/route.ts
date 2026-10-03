import { getLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { users } from '@/db/schema/core';
import { eq } from 'drizzle-orm';

const log = getLogger('UsersAPI');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const [currentUser] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return NextResponse.json({ data: currentUser ? [currentUser] : [] });
  } catch (error: unknown) {
    log.error('GET error', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
