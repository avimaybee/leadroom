import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { DiscoveryService } from '@/services/discovery';
import { CreateCandidateLeadSchema } from '@/db/models/discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scopeId = searchParams.get('scopeId');
    if (!scopeId) {
      return NextResponse.json({ success: false, error: 'scopeId parameter is required' }, { status: 400 });
    }

    const db = getDb();
    const service = new DiscoveryService(db);
    const candidates = await service.listCandidatesByScope(scopeId);
    return NextResponse.json({ success: true, data: candidates });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateCandidateLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const db = getDb();
    const service = new DiscoveryService(db);

    const id = crypto.randomUUID();
    const candidate = await service.createCandidateLead(id, parsed.data);

    return NextResponse.json({ success: true, data: candidate }, { status: 201 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, status, ownerId } = await request.json() as {
      id: string;
      status: 'NEW' | 'REVIEWED' | 'PROMOTED' | 'DISCARDED';
      ownerId?: string;
    };

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'id and status parameters are required' }, { status: 400 });
    }

    const db = getDb();
    const service = new DiscoveryService(db);

    if (status === 'PROMOTED') {
      if (!ownerId) {
        return NextResponse.json({ success: false, error: 'ownerId is required for promotion' }, { status: 400 });
      }
      const lead = await service.promoteCandidate(id, ownerId);
      return NextResponse.json({ success: true, data: lead });
    } else {
      const candidate = await service.updateCandidateStatus(id, status);
      return NextResponse.json({ success: true, data: candidate });
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
