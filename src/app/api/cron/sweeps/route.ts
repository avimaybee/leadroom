import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { runAllSweeps } from '@/services/sweeps';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const result = await runAllSweeps(db);
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...result,
  });
}
