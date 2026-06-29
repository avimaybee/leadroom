import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { users } from '@/db/schema/core';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const allUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, userId));

    const userList = await db
      .select({ id: users.id, name: users.name })
      .from(users);

    return NextResponse.json({ data: userList });
  } catch (error: unknown) {
    console.error('[Users API] GET error:', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
