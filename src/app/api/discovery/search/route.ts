export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { searchGoogleMaps } from '@/lib/discovery/apify';
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

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { niche, location, limit } = (await request.json()) as {
      niche?: string;
      location?: string;
      limit?: number;
    };

    if (!niche || !location) {
      return NextResponse.json({ error: 'Niche and location are required' }, { status: 400 });
    }

    // Call Apify to search Google Maps
    const results = await searchGoogleMaps(niche, location, limit || 20);

    return NextResponse.json({ results }, { status: 200 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to execute discovery search';
    console.error('[Discovery Search API] Error:', error);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
