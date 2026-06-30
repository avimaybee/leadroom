'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Globe, Mail, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScoreBreakdown } from '@/components/prospects/ScoreBreakdown';
import { EvidenceCard } from '@/components/prospects/EvidenceCard';
import { DraftReview } from '@/components/prospects/outreach/DraftReview';
import { OutcomeLogger } from '@/components/prospects/outreach/OutcomeLogger';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { generateOutreachDraftAction } from '@/app/actions/outreach';
import { approveDraftAction, rejectDraftAction, logOutcomeAction } from '@/app/actions/outcomes';

interface ProspectData {
  id: string;
  name: string;
  company: string | null;
  website: string | null;
  email: string | null;
  stage: string;
  status: string;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  disqualifiedReason: string | null;
  fitReasoning: string | null;
}

interface ResearchTaskData {
  taskType: string | null;
  status: string | null;
  extractedSignals: string | null;
  confidence: number | null;
  errorMessage: string | null;
}

interface DraftData {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  citedEvidence: string | null;
  riskFlags: string | null;
  rejectionReason: string | null;
}

interface Props {
  prospect: ProspectData;
  researchTasks: ResearchTaskData[];
  initialDrafts?: DraftData[];
}

function parseSignals(raw: string | null): Array<{ signalName: string; matchedIcpRule: string; matchStrength: string; evidenceQuote: string; sourceUrl: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ProspectDetailClient({ prospect, researchTasks, initialDrafts = [] }: Props) {
  const [showOverride, setShowOverride] = useState(false);
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [drafts, setDrafts] = useState<DraftData[]>(initialDrafts);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('score');

  const approvedDraftId = drafts.find((d) => d.status === 'APPROVED')?.id ?? null;

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const result = await generateOutreachDraftAction(prospect.id, 'EMAIL');
      if (result.success && result.drafts) {
        setDrafts(result.drafts.map((d: any) => ({
          id: d.id,
          subject: d.subject ?? null,
          body: d.body,
          status: d.status,
          citedEvidence: (d as any).citedEvidence ?? null,
          riskFlags: (d as any).riskFlags ?? null,
          rejectionReason: (d as any).rejectionReason ?? null,
        })));
        setActiveTab('outreach');
      } else if (result.error) {
        setGenerateError(result.error);
      }
    } catch {
      setGenerateError('Unexpected error while generating draft. Check your AI provider configuration.');
    } finally {
      setGenerating(false);
    }
  }, [prospect.id]);

  const handleApprove = useCallback(async (draftId: string) => {
    try {
      const result = await approveDraftAction(draftId);
      if (result.success && result.drafts) {
        setDrafts(result.drafts.map((d: any) => ({
          id: d.id,
          subject: d.subject ?? null,
          body: d.body,
          status: d.status,
          citedEvidence: (d as any).citedEvidence ?? null,
          riskFlags: (d as any).riskFlags ?? null,
          rejectionReason: (d as any).rejectionReason ?? null,
        })));
      }
    } catch {
      // silently fail
    }
  }, []);

  const handleReject = useCallback(async (draftId: string, reason: string) => {
    try {
      const result = await rejectDraftAction(draftId, reason);
      if (result.success && result.drafts) {
        setDrafts(result.drafts.map((d: any) => ({
          id: d.id,
          subject: d.subject ?? null,
          body: d.body,
          status: d.status,
          citedEvidence: (d as any).citedEvidence ?? null,
          riskFlags: (d as any).riskFlags ?? null,
          rejectionReason: (d as any).rejectionReason ?? null,
        })));
      }
    } catch {
      // silently fail
    }
  }, []);

  const handleLogOutcome = useCallback(async (data: { outcomeType: string; notes: string }) => {
    await logOutcomeAction({
      prospectId: prospect.id,
      draftId: approvedDraftId,
      outcomeType: data.outcomeType,
      notes: data.notes,
    });
  }, [prospect.id, approvedDraftId]);

  const allSignals = researchTasks.flatMap((t) => parseSignals(t.extractedSignals));
  const avgConfidence = researchTasks.length > 0
    ? Math.round(researchTasks.reduce((s, t) => s + (t.confidence ?? 0), 0) / researchTasks.length)
    : 0;

  const breakdown = allSignals.map((s) => ({
    factor: `${s.matchedIcpRule} (${s.matchStrength})`,
    contribution: s.matchStrength === 'strong' ? 20 : s.matchStrength === 'partial' ? 10 : 5,
    evidenceQuote: s.evidenceQuote,
    sourceUrl: s.sourceUrl,
  }));

  const displayFitScore = prospect.fitScore ?? 0;
  const displayConfidence = prospect.confidenceScore ?? avgConfidence;
  const displayTier = prospect.priorityTier ?? 'tier3';

  const hasFailedTasks = researchTasks.some((t) => t.status === 'FAILED');
  const isLowConfidence = displayConfidence < 50;

  return (
    <div className="space-y-6 animate-fade-in text-left">
      <nav className="flex items-center gap-2 text-copy-14 text-muted-foreground">
        <Link href="/" className="hover:text-primary transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{prospect.name}</span>
      </nav>

      {isLowConfidence && (
        <div className="flex items-center gap-2 rounded-lg bg-chart-5/10 border border-chart-5/30 px-4 py-3 text-copy-14 text-chart-5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Low confidence score ({displayConfidence}). Research data may be sparse or unreliable.
        </div>
      )}

      {hasFailedTasks && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-copy-14 text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Some research tasks failed. Results may be incomplete.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-heading-lg font-semibold">{prospect.company || prospect.name}</h2>
            <div className="space-y-3">
              {prospect.website && (
                <a href={`https://${prospect.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-copy-14 text-primary hover:underline">
                  <Globe className="w-4 h-4" />
                  {prospect.website}
                </a>
              )}
              {prospect.email && (
                <div className="flex items-center gap-2 text-copy-14 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  {prospect.email}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{prospect.stage}</Badge>
              <Badge variant={prospect.status === 'Active' ? 'default' : 'secondary'}>{prospect.status}</Badge>
              {prospect.disqualifiedReason && (
                <Badge variant="destructive">Disqualified: {prospect.disqualifiedReason}</Badge>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-label-12 text-muted-foreground uppercase">Research Tasks</h3>
            {researchTasks.length === 0 ? (
              <p className="text-copy-14 text-muted-foreground">Research in progress &mdash; check back soon.</p>
            ) : (
              <div className="space-y-2">
                {researchTasks.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-copy-14">
                    <span>{t.taskType ?? 'Unknown'}</span>
                    <Badge variant={t.status === 'COMPLETED' ? 'default' : t.status === 'FAILED' ? 'destructive' : 'secondary'}>
                      {t.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-label-12 text-muted-foreground uppercase">Signals Found ({allSignals.length})</h3>
            {allSignals.length === 0 ? (
              <p className="text-copy-14 text-muted-foreground">No signals extracted yet.</p>
            ) : (
              <div className="space-y-2">
                {allSignals.map((s, i) => (
                  <EvidenceCard key={i} evidenceQuote={s.evidenceQuote} sourceUrl={s.sourceUrl} confidence={avgConfidence} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="score">Score & Evidence</TabsTrigger>
              <TabsTrigger value="outreach">Outreach</TabsTrigger>
              <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
            </TabsList>
            <TabsContent value="score" className="mt-4 space-y-4">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-label-12 text-muted-foreground uppercase">Fit Score</h3>
                  <Button variant="outline" size="xs" onClick={() => setShowOverride(true)}>
                    Override
                  </Button>
                </div>
                <ScoreBreakdown
                  fitScore={displayFitScore}
                  confidenceScore={displayConfidence}
                  priorityTier={displayTier}
                  breakdown={breakdown}
                  fitReasoning={prospect.fitReasoning}
                />
              </div>

              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="text-label-12 text-muted-foreground uppercase">Recommendations</h3>
                {prospect.priorityTier === 'tier1' ? (
                  <p className="text-copy-14 text-foreground">Strong fit. Consider drafting outreach.</p>
                ) : prospect.priorityTier === 'tier2' ? (
                  <p className="text-copy-14 text-foreground">Moderate fit. Research more before outreach.</p>
                ) : prospect.priorityTier === 'disqualified' ? (
                  <p className="text-copy-14 text-destructive">{prospect.disqualifiedReason ?? 'Disqualified based on ICP rules.'}</p>
                ) : (
                  <p className="text-copy-14 text-muted-foreground">Low fit score. Nurture or skip.</p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="outreach" className="mt-4">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 text-label-12 text-muted-foreground uppercase">Outreach Draft</h3>
                {generateError && (
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 mb-4 text-copy-14 text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{generateError}</span>
                  </div>
                )}
                <DraftReview
                  drafts={drafts}
                  generating={generating}
                  onGenerate={handleGenerate}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </div>
            </TabsContent>
            <TabsContent value="outcomes" className="mt-4">
              <OutcomeLogger
                draftId={approvedDraftId}
                prospectId={prospect.id}
                onLog={handleLogOutcome}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showOverride} onOpenChange={setShowOverride}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Score</DialogTitle>
            <DialogDescription>Set a manual fit score and explain why.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="override-value">Fit Score (0&ndash;100)</Label>
              <Input id="override-value" type="number" min={0} max={100} value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} placeholder="70" />
            </div>
            <div>
              <Label htmlFor="override-reason">Reason</Label>
              <Input id="override-reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Why are you overriding?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverride(false)}>Cancel</Button>
            <Button onClick={() => { setShowOverride(false); }} disabled={!overrideValue || !overrideReason}>
              Apply Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
