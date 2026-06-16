import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { DiscoveryService } from '@/services/discovery';
import { CreateCandidateLeadSchema } from '@/db/models/discovery';
import { fetchSiteContent } from '@/lib/scraper';
import { heuristicSiteTriage } from '@/lib/ai';
import { getUserId } from '@/lib/auth';

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
    const candidates = await service.listCandidatesByScope(scopeId);
    return NextResponse.json({ success: true, data: candidates });
  } catch (error: unknown) {
    console.error('[Candidates API] GET error:', error);
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

    if (candidate) {
      const runTriage = async () => {
        let triagePriority: 'HIGH' | 'MEDIUM' | 'SKIP' = 'HIGH';
        let triageReason = 'No website detected.';

        if (candidate.rawWebsiteUrl) {
          try {
            const siteContent = await fetchSiteContent(candidate.rawWebsiteUrl);
            const triageResult = heuristicSiteTriage(siteContent.content.substring(0, 5000));
            triagePriority = triageResult.isModern ? 'SKIP' : 'MEDIUM';
            triageReason = triageResult.reason;
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            triagePriority = 'HIGH';
            triageReason = 'Website failed to load or is unreachable';
          }
        }

        const disService = new DiscoveryService(db);
        await disService.updateCandidateTriage(candidate.id, triagePriority, triageReason);
      };

      let ctx: any = undefined;
      try {
        const { getCloudflareContext } = require('@opennextjs/cloudflare');
        ctx = getCloudflareContext().ctx;
      } catch (e) {}

      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(runTriage());
      } else {
        runTriage().catch((err) => console.error('[Candidates API] Manual candidate triage background error:', err));
      }
    }

    return NextResponse.json({ success: true, data: candidate }, { status: 201 });
  } catch (error: unknown) {
    console.error('[Candidates API] POST error:', error);
    return NextResponse.json({ success: false, error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { id, status } = await request.json() as {
      id: string;
      status: 'NEW' | 'REVIEWED' | 'PROMOTED' | 'DISCARDED';
    };

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'id and status parameters are required' }, { status: 400 });
    }

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
    const knownErrors = ['not found', 'has already been promoted', 'failed to'];
    const msg = error instanceof Error ? error.message : '';
    const isKnown = knownErrors.some(k => msg.toLowerCase().includes(k.toLowerCase()));
    if (isKnown) {
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    console.error('[Candidates API] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'An internal error occurred' }, { status: 500 });
  }
}
