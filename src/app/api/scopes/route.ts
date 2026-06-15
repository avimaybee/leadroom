import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { eq, and } from 'drizzle-orm';
import { DiscoveryService } from '@/services/discovery';
import { discoveryScopes } from '@/db/schema/discovery';
import { CreateDiscoveryScopeSchema } from '@/db/models/discovery';
import { getUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const db = getDb();
    const service = new DiscoveryService(db);

    if (id) {
      const results = await db.select().from(discoveryScopes)
        .where(and(eq(discoveryScopes.id, id), eq(discoveryScopes.createdByUserId, userId)));
      const scope = results[0] || null;
      if (!scope) {
        return NextResponse.json({ success: false, error: 'Scope not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: scope });
    }

    const scopes = await service.listScopes(userId);
    return NextResponse.json({ success: true, data: scopes });
  } catch (error: unknown) {
    console.error('[Scopes API] GET error:', error);
    return NextResponse.json({ success: false, error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

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
    console.error('[Scopes API] POST error:', error);
    return NextResponse.json({ success: false, error: 'An internal error occurred' }, { status: 500 });
  }
}
