import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { DiscoveryService } from '@/services/discovery';
import { CreateCandidateLeadSchema } from '@/db/models/discovery';
import { fetchSiteContent } from '@/lib/scraper';

import { getUserId } from '@/lib/auth';

const CandidatePatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['NEW', 'REVIEWED', 'PROMOTED', 'DISCARDED']),
});

const log = getLogger('CandidatesAPI');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scopeId = searchParams.get('scopeId');
    if (!scopeId) {
      return NextResponse.json({ success: false, error: 'scopeId parameter is required' }, { status: 400 });
    }

    const db = getDb();
    const service = new DiscoveryService(db);
    const candidates = await service.listCandidatesByScope(scopeId, userId);
    return NextResponse.json({ success: true, data: candidates });
  } catch (error: unknown) {
    log.error('GET error', error);
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
    log.error('POST error', error);
    return NextResponse.json({ success: false, error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CandidatePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'id and status parameters are required' }, { status: 400 });
    }
    const { id, status } = parsed.data;

    const db = getDb();
    const service = new DiscoveryService(db);

    if (status === 'PROMOTED') {
      const lead = await service.promoteCandidate(id, userId);
      return NextResponse.json({ success: true, data: lead });
    } else {
      const candidate = await service.updateCandidateStatus(id, status);
      return NextResponse.json({ success: true, data: candidate });
    }
  } catch (error: unknown) {
    log.error('Candidate route failed', error);
    const knownErrors = ['not found', 'has already been promoted', 'failed to'];
    const msg = error instanceof Error ? error.message : '';
    const isKnown = knownErrors.some(k => msg.toLowerCase().includes(k.toLowerCase()));
    if (isKnown) {
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    log.error('PATCH error', error);
    return NextResponse.json({ success: false, error: 'An internal error occurred' }, { status: 500 });
  }
}
