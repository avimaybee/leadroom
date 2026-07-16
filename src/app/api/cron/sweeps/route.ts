export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { getLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { runAllSweeps } from '@/services/sweeps';

const log = getLogger('CronSweepsAPI');

function timingSafeCompare(expected: string, actual: string): boolean {
  try {
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(actual);
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    log.warn('CRON_SECRET not configured — sweeps endpoint disabled');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ') || !timingSafeCompare(cronSecret, authHeader.slice(7))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const results = await runAllSweeps(db);
    return NextResponse.json({
      success: true,
      ...results
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An error occurred during sweeps';
    log.error('Cron sweeps error', error);
    return NextResponse.json({ 
      success: false, 
      error: message 
    }, { status: 500 });
  }
}
