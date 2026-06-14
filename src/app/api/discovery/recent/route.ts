export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { eq, desc } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';

async function getUserId() {
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

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  try {
    const runs = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.jobType, 'DISCOVERY_SEARCH'))
      .orderBy(desc(jobRuns.createdAt))
      .limit(5);

    const formattedRuns = runs.map((run) => {
      let niche = '';
      let location = '';
      let scopeId: string | null = null;
      try {
        if (run.jobMeta) {
          const meta = JSON.parse(run.jobMeta);
          niche = meta.niche || '';
          location = meta.location || '';
          scopeId = meta.scopeId || null;
        }
      } catch (e) {
        console.error('Failed to parse jobMeta:', e);
      }

      return {
        id: run.id,
        status: run.status,
        niche,
        location,
        scopeId,
        createdAt: run.createdAt,
        finishedAt: run.finishedAt,
        errorSummary: run.errorSummary,
      };
    });

    return NextResponse.json({ success: true, data: formattedRuns });
  } catch (error: unknown) {
    console.error('Failed to fetch recent discovery jobs:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
