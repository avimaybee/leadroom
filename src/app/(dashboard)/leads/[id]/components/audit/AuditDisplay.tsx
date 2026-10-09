'use client';

import { useState, useActionState } from 'react';
import { SafeMarkdown } from '@/components/SafeMarkdown';
import { FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { AuditSnapshot, LeadScore } from './types';
import { ActionState } from '@/app/actions/audits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScoreBreakdown } from '@/components/prospects/ScoreBreakdown';

interface AuditDisplayProps {
  leadId: string;
  audit: AuditSnapshot | null;
  score: LeadScore | null;
  manualOverrideScoreAction: (_prevState: ActionState, _formData: FormData) => Promise<ActionState>;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  fitReasoning: string | null;
  researchTasks: any[];
}

const TASK_TYPE_LABELS: Record<string, string> = {
  WEBSITE_ANALYSIS: 'Website Analysis',
  ICP_FIT_ANALYSIS: 'ICP Fit Analysis',
  PAIN_SIGNAL_ANALYSIS: 'Pain Signal Analysis',
  CONTACT_MAPPING: 'Contact Mapping',
  RESEARCH_SNAPSHOT: 'Research Snapshot',
};

export function AuditDisplay({
  leadId,
  audit,
  score,
  manualOverrideScoreAction,
  fitScore,
  confidenceScore,
  priorityTier,
  fitReasoning,
  researchTasks,
}: AuditDisplayProps) {
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [state, formAction] = useActionState(manualOverrideScoreAction, undefined);

  const getPriorityLabelColor = (label: string | null) => {
    switch (label?.toUpperCase()) {
      case 'HIGH':
        return 'bg-destructive/10 text-destructive border border-destructive/20';
      case 'MEDIUM':
        return 'bg-chart-5/10 text-chart-5 border border-chart-5/20';
      case 'LOW':
        return 'bg-muted text-muted-foreground border border-border';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const parseSignals = (raw: string | null) => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const allSignals = (researchTasks || []).flatMap((t) => parseSignals(t.extractedSignals));
  const breakdown = allSignals.map((s: any) => ({
    factor: `${s.matchedIcpRule} (${s.matchStrength})`,
    contribution: s.matchStrength === 'strong' ? 20 : s.matchStrength === 'partial' ? 10 : 5,
    evidenceQuote: s.evidenceQuote,
    sourceUrl: s.sourceUrl,
  }));

  const hasFailedTasks = (researchTasks || []).some((t) => t.status === 'FAILED');
  const tasks = (researchTasks || []).filter((t) => t.status !== 'COMPLETED' || t.extractedSignals);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Failed research task warning */}
      {hasFailedTasks && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
          <XCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-label-14">Some research tasks failed</p>
            <p className="text-copy-14 text-muted-foreground mt-0.5">
              Results may be incomplete. Retry failed tasks from the Research Queue.
            </p>
          </div>
        </div>
      )}

      {/* Full-width Operational Controls Card */}
      <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <span className="text-label-12 font-semibold text-card-foreground block">Score Controls</span>
            <h4 className="text-label-14 font-semibold text-muted-foreground mt-1">Manual Score Override</h4>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={() => setShowOverrideForm(!showOverrideForm)}
              variant="outline"
              size="sm"
            >
              {showOverrideForm ? 'Hide Override' : 'Override Score'}
            </Button>
          </div>
        </div>

        {/* Override Form Panel */}
        {showOverrideForm && (
          <form action={formAction} className="border-t border-border pt-4 space-y-4 animate-fade-in">
            <input type="hidden" name="leadId" value={leadId} />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>New Score (0-100)</Label>
                <Input
                  type="number"
                  name="scoreValue"
                  required
                  min={0}
                  max={100}
                  defaultValue={score?.scoreValue ?? ''}
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label>Override Rationale / Justification</Label>
                <Input
                  type="text"
                  name="rationale"
                  required
                  placeholder="e.g. Spoke with owner, high website project budget"
                />
              </div>
            </div>
            {state?.error && <p className="text-destructive text-label-12 font-semibold">{state.error}</p>}
            {state?.success && <p className="text-chart-2 text-label-12 font-semibold">Manual override applied.</p>}
            <div className="flex justify-end gap-2">
              <Button type="submit" size="xs">Apply Override</Button>
            </div>
          </form>
        )}

        {!showOverrideForm && (
          <p className="text-label-12 text-muted-foreground font-semibold">
            Audit data and score populate automatically when research enrichment runs. Override a score when your
            judgment differs from the model.
          </p>
        )}
      </div>

      {/* Research Tasks status list */}
      {tasks.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-label-12 font-semibold text-card-foreground uppercase">Research Tasks</h4>
            <span className="text-label-12 text-muted-foreground">
              {tasks.filter((t) => t.status === 'COMPLETED').length}/{tasks.length} completed
            </span>
          </div>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <div className="min-w-0">
                  <p className="text-copy-14 text-foreground font-medium">
                    {TASK_TYPE_LABELS[task.taskType] || task.taskType || 'Research Task'}
                  </p>
                  {task.errorMessage && (
                    <p className="text-label-12 text-destructive mt-0.5 truncate">{task.errorMessage}</p>
                  )}
                </div>
                {task.status === 'COMPLETED' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-label-12 font-semibold bg-chart-2/10 text-chart-2 border border-chart-2/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                  </span>
                ) : task.status === 'FAILED' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-label-12 font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                    <XCircle className="w-3 h-3" />
                    Failed
                  </span>
                ) : task.status === 'RUNNING' || task.status === 'QUEUED' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-label-12 font-semibold bg-chart-5/10 text-chart-5 border border-chart-5/20">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {task.status === 'RUNNING' ? 'Running' : 'Queued'}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold bg-muted text-muted-foreground border border-border">
                    {task.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2-Column Grid for Score & Details */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column (2/3 width): Observations & Recommendations */}
        <div className="xl:col-span-2 space-y-6">
          {audit ? (
            <div className="space-y-6">
              <h4 className="text-label-12 font-semibold text-card-foreground">Observations & Opportunities</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card p-5 rounded-xl border border-border space-y-2">
                  <span className="text-label-12 font-semibold text-chart-2 block">Key Strengths</span>
                  <div className="text-copy-13 text-card-foreground font-medium leading-relaxed bg-muted/30 p-3 rounded-md prose-markdown">
                    {audit.keyStrengths ? (
                      <SafeMarkdown>{audit.keyStrengths}</SafeMarkdown>
                    ) : (
                      'No strengths noted.'
                    )}
                  </div>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border space-y-2">
                  <span className="text-label-12 font-semibold text-destructive block">Key Weaknesses</span>
                  <div className="text-copy-13 text-card-foreground font-medium leading-relaxed bg-muted/30 p-3 rounded-md prose-markdown">
                    {audit.keyWeaknesses ? (
                      <SafeMarkdown>{audit.keyWeaknesses}</SafeMarkdown>
                    ) : (
                      'No weaknesses noted.'
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-card p-6 rounded-xl border border-border space-y-3">
                <span className="text-label-12 font-semibold text-primary block">Recommended Creative Improvements</span>
                <div className="text-copy-13 text-muted-foreground font-medium leading-relaxed bg-primary/5 p-4 rounded-md prose-markdown">
                  {audit.recommendedImprovements ? (
                    <SafeMarkdown>{audit.recommendedImprovements}</SafeMarkdown>
                  ) : (
                    'No creative recommendations generated.'
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center space-y-4 h-full flex flex-col justify-center items-center">
              <FileText className="w-12 h-12 text-muted-foreground" />
              <div className="space-y-1">
                <h4 className="text-label-14 font-semibold text-card-foreground">No Web Presence Audit Found</h4>
                <p className="text-label-12 text-muted-foreground max-w-sm mx-auto font-medium">
                  The design audit populates automatically when you run research on this prospect.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1/3 width): Stack Priority Score */}
        <div className="xl:col-span-1 space-y-6">
          {/* Priority Score Card */}
          <div className="bg-card p-6 rounded-xl border border-border flex flex-col space-y-4">
            {score ? (
              <>
                <div>
                  <span className="text-label-12 font-semibold text-card-foreground block">Lead Priority Score</span>
                  <div className="flex items-baseline mt-2">
                    <span className="heading-3xl font-semibold text-card-foreground">{score.scoreValue ?? 0}</span>
                    <span className="heading-xl font-semibold text-muted-foreground ml-1">/100</span>
                  </div>
                  {score.scoreLabel && (
                    <span
                      aria-label={`${score.scoreLabel} Priority`}
                      className={`inline-flex items-center px-2.5 py-0.5 mt-3 rounded-md text-label-12 font-semibold ${getPriorityLabelColor(score.scoreLabel)}`}
                    >
                      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                        score.scoreLabel?.toUpperCase() === 'HIGH' ? 'bg-destructive animate-pulse' :
                        score.scoreLabel?.toUpperCase() === 'MEDIUM' ? 'bg-chart-5' : 'bg-muted-foreground'
                      }`} />
                      {score.scoreLabel} Priority
                    </span>
                  )}
                </div>

                <div className="pt-4 border-t border-border mt-2">
                  <h5 className="text-label-12 font-semibold text-card-foreground mb-2">AI Rationale</h5>
                  <p className="text-copy-13 text-muted-foreground font-medium leading-relaxed">
                    {score.rationaleSummary || 'No rationale recorded for the current score.'}
                  </p>

                  {score.factors && (
                    <div className="mt-4 space-y-2">
                      <h6 className="text-label-12 uppercase text-muted-foreground">Key Scoring Factors</h6>
                      <ul className="space-y-1.5">
                        {(() => {
                          try {
                            const factors = JSON.parse(score.factors);
                            if (Array.isArray(factors)) {
                              return factors.map((factor, i) => (
                                <li key={i} className="text-copy-13 text-card-foreground font-medium flex items-start">
                                  <span className="mr-2 text-primary mt-0.5">•</span>
                                  <span className="leading-relaxed">{factor}</span>
                                </li>
                              ));
                            }
                          } catch {
                            return null;
                          }
                          return null;
                        })()}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 space-y-2">
                <span className="text-label-12 font-semibold text-muted-foreground uppercase block">Priority Score</span>
                <p className="text-copy-13 text-muted-foreground leading-relaxed">
                  No score calculated yet. Run research to evaluate fit and confidence.
                </p>
              </div>
            )}
          </div>

          {/* Live fit / confidence breakdown from lead columns */}
          {fitScore !== null && confidenceScore !== null && priorityTier !== null && (
            <div className="bg-card p-6 rounded-xl border border-border flex flex-col space-y-4">
              <ScoreBreakdown
                fitScore={fitScore}
                confidenceScore={confidenceScore}
                priorityTier={priorityTier}
                breakdown={breakdown}
                fitReasoning={fitReasoning}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
