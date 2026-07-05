export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { runAllSweeps } from '@/services/sweeps';

export async function GET(request: Request) {
  // Optional: check secret token in headers to authorize cron trigger if configured
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const results = await runAllSweeps(db);
    return NextResponse.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    console.error('Cron sweeps error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'An error occurred during sweeps' 
    }, { status: 500 });
  }
}
