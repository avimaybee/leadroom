import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { DiscoveryService } from '@/services/discovery';
import { CreateCandidateLeadSchema } from '@/db/models/discovery';
import { fetchSiteContent } from '@/lib/scraper';
import { runTriageAI } from '@/lib/ai';

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

    if (candidate) {
      const runTriage = async () => {
        let triagePriority: 'HIGH' | 'MEDIUM' | 'SKIP' = 'HIGH';
        let triageReason = 'No website detected.';

        if (candidate.rawWebsiteUrl) {
          try {
            const siteContent = await fetchSiteContent(candidate.rawWebsiteUrl);
            const triageResult = await runTriageAI(db, siteContent.content.substring(0, 5000));
            triagePriority = triageResult.status === 'MODERN' ? 'SKIP' : 'MEDIUM';
            triageReason = triageResult.reason;
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            triagePriority = 'HIGH';
            triageReason = `Website failed to load or is unreachable. Error: ${errMsg}`;
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
