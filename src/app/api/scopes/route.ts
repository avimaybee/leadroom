import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { eq, and } from 'drizzle-orm';
import { DiscoveryService } from '@/services/discovery';
import { discoveryScopes } from '@/db/schema/discovery';
import { CreateDiscoveryScopeSchema } from '@/db/models/discovery';
import { getUserId } from '@/lib/auth';

const log = getLogger('ScopesAPI');

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
    log.error('GET error', error);
    return NextResponse.json({ success: false, error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json()) as { id?: string; name?: string };
    const { id, name } = body;

    if (!id || !name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Scope id and name are required' }, { status: 400 });
    }

    const db = getDb();
    const service = new DiscoveryService(db);
    const scope = await service.updateScopeName(id, name.trim());

    if (!scope) {
      return NextResponse.json({ success: false, error: 'Scope not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: scope });
  } catch (error: unknown) {
    log.error('PATCH error', error);
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
    log.error('POST error', error);
    return NextResponse.json({ success: false, error: 'An internal error occurred' }, { status: 500 });
  }
}
