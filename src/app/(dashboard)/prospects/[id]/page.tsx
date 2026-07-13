export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { prospects } from '@/db/schema/core';
import { researchTasks } from '@/db/schema/jobs';
import { markets } from '@/db/schema/strategy';
import { contacts } from '@/db/schema/research';
import { outreachDrafts } from '@/db/schema/outreach';
import { eq, and, isNull } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';
import { ShieldAlert, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { ProspectScorePanel } from '@/components/prospects/ProspectScorePanel';
import { ProspectEvidencePanel } from '@/components/prospects/ProspectEvidencePanel';
import { OutreachSection } from '@/components/prospects/OutreachSection';

interface PainSignal {
  signal: string;
  evidenceQuote: string;
  sourceUrl: string;
  matchStrength?: string;
}

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const userId = await getUserId();

  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!prospect) notFound();

  const [market] = prospect.marketId
    ? await db.select({ name: markets.name }).from(markets).where(eq(markets.id, prospect.marketId)).limit(1)
    : [null];

  const taskRows = await db
    .select()
    .from(researchTasks)
    .where(eq(researchTasks.prospectId, id));

  const contactRows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.leadId, id), isNull(contacts.deletedAt)));

  const draftRows = await db
    .select()
    .from(outreachDrafts)
    .where(eq(outreachDrafts.leadId, id))
    .orderBy(outreachDrafts.createdAt);

  // Gather evidence from completed research tasks
  const allSignals: PainSignal[] = [];
  let companySummary: string | null = null;

  for (const task of taskRows) {
    if (task.status === 'COMPLETED' && task.extractedSignals) {
      try {
        const signals = JSON.parse(task.extractedSignals);
        if (Array.isArray(signals)) {
          allSignals.push(...signals.map((s: any) => ({
            signal: s.signalName || s.signal || '',
            evidenceQuote: s.evidenceQuote || '',
            sourceUrl: s.sourceUrl || '',
            matchStrength: s.matchStrength || '',
          })));
        }
      } catch {}
    }
    if (task.status === 'COMPLETED' && task.taskType === 'WEBSITE_ANALYST' && task.rawArtifacts) {
      try {
        const raw = JSON.parse(task.rawArtifacts);
        if (raw.summary) companySummary = raw.summary;
      } catch {}
    }
  }

  const domain = prospect.website ? new URL(prospect.website).hostname.replace(/^www\./, '') : null;

  const breakdownItems = allSignals.map(s => ({
    factor: s.signal,
    contribution: s.matchStrength === 'strong' ? 10 : s.matchStrength === 'partial' ? 5 : 2,
    evidenceQuote: s.evidenceQuote,
    sourceUrl: s.sourceUrl,
  }));

  const isDisqualified = prospect.priorityTier === 'disqualified';
  const isLowConfidence = prospect.confidenceScore !== null && prospect.confidenceScore < 50;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-copy-14 text-muted-foreground">
        <Link href="/prospects" className="hover:text-foreground transition-colors">Prospects</Link>
        <span className="text-muted-foreground/30">/</span>
        <span className="font-medium text-foreground">{prospect.company || prospect.name}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-heading-2xl">{prospect.company || prospect.name}</h1>
        <p className="text-copy-14 text-muted-foreground mt-1">
          {domain && <>{domain} &middot; </>}
          {market?.name && <>{market.name} &middot; </>}
          Added {prospect.createdAt ? new Date(prospect.createdAt).toLocaleDateString() : 'Unknown'}
        </p>
      </div>

      {/* Disqualified banner */}
      {isDisqualified && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="label-14">Disqualified</p>
            <p className="copy-14">{prospect.disqualifiedReason || prospect.fitReasoning || 'Prospect matched a disqualifier rule.'}</p>
          </div>
        </div>
      )}

      {/* Low-confidence banner */}
      {isLowConfidence && !isDisqualified && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-chart-5/10 text-chart-5 border border-chart-5/20">
          <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="label-14">Low data confidence</p>
            <p className="copy-14">
              Scores may be unreliable — consider gathering more data before acting.
            </p>
          </div>
        </div>
      )}

      {/* Main grid: 12 columns, 7/5 split */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Evidence */}
        <div className="col-span-12 lg:col-span-7">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="label-14 text-foreground uppercase mb-4">Company Evidence</h3>
            <ProspectEvidencePanel
              companyName={prospect.company || prospect.name}
              domain={domain}
              summary={companySummary}
              painSignals={allSignals}
              contacts={contactRows.map(c => ({
                id: c.id,
                fullName: c.fullName,
                roleTitle: c.roleTitle,
                email: c.email,
                isPrimary: c.isPrimary,
              }))}
              researchTasks={taskRows.map(t => ({
                id: t.id,
                taskType: t.taskType,
                status: t.status,
                extractedSignals: t.extractedSignals,
                errorMessage: t.errorMessage,
                confidence: t.confidence,
              }))}
            />
          </div>
        </div>

        {/* Right: Score + Outreach */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="label-14 text-foreground uppercase mb-4">Score Breakdown</h3>
            <ProspectScorePanel
              prospectId={id}
              fitScore={prospect.fitScore}
              confidenceScore={prospect.confidenceScore}
              priorityTier={prospect.priorityTier}
              breakdown={breakdownItems}
              fitReasoning={prospect.fitReasoning}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="label-14 text-foreground uppercase mb-4">Outreach</h3>
            <OutreachSection
              prospectId={id}
              drafts={draftRows.map(d => ({
                id: d.id,
                subject: d.subject ?? null,
                body: d.body,
                status: d.status,
                channel: d.channel,
                citedEvidence: d.citedEvidence ?? null,
                riskFlags: d.riskFlags ?? null,
                rejectionReason: d.rejectionReason ?? null,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
