import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Calendar is disabled' }, { status: 503 });
}
