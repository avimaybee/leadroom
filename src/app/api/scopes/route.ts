import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { eq } from 'drizzle-orm';
import { DiscoveryService } from '@/services/discovery';
import { discoveryScopes } from '@/db/schema/discovery';
import { CreateDiscoveryScopeSchema } from '@/db/models/discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const db = getDb();
    const service = new DiscoveryService(db);

    if (id) {
      const results = await db.select().from(discoveryScopes).where(eq(discoveryScopes.id, id));
      const scope = results[0] || null;
      return NextResponse.json({ success: true, data: scope });
    }

    const scopes = await service.listScopes();
    return NextResponse.json({ success: true, data: scopes });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateDiscoveryScopeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const db = getDb();
    const service = new DiscoveryService(db);
    
    const id = crypto.randomUUID();
    const scope = await service.createScope(id, parsed.data);

    return NextResponse.json({ success: true, data: scope }, { status: 201 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
