import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getLogger } from '@/lib/logger';
import { sql } from 'drizzle-orm';

const log = getLogger('HealthAPI');

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus = 'unknown';
  try {
    const db = getDb();
    await db.run(sql`SELECT 1 AS ok`);
    dbStatus = 'ok';
  } catch (e) {
    dbStatus = 'error';
    log.error('Health check DB failure', e);
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
  });
}
