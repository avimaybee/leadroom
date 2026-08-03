import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { DiscoveryService } from '@/services/discovery';
import { CreateCandidateLeadSchema } from '@/db/models/discovery';

import { getUserId } from '@/lib/auth';
import { getSafeErrorMessage } from '@/lib/errors';

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
      return NextResponse.json({ success: true, data: [] });
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
    const candidate = await service.createCandidateLead(id, parsed.data, userId);

    return NextResponse.json({ success: true, data: candidate }, { status: 201 });
  } catch (error: unknown) {
    log.error('POST error', error);
    const msg = getSafeErrorMessage(error, 'Failed to create candidate lead.');
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
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
      const candidate = await service.updateCandidateStatus(id, status, null, userId);
      return NextResponse.json({ success: true, data: candidate });
    }
  } catch (error: unknown) {
    log.error('Candidate route failed', error);
    const msg = getSafeErrorMessage(error, 'An internal error occurred');
    const status = msg.toLowerCase().includes('forbidden') ? 403 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
