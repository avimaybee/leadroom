'use client';

// TODO: install rehype-sanitize (npm install rehype-sanitize) and add import rehypeSanitize from 'rehype-sanitize',
// then pass rehypePlugins={[rehypeSanitize]} to ReactMarkdown below
import ReactMarkdown from 'react-markdown';
import { FileText } from 'lucide-react';
import { AuditSnapshot, LeadScore } from './types';
import { ActionState } from '@/app/actions/audits';
import { ScoreBreakdown } from '@/components/prospects/ScoreBreakdown';

interface AuditDisplayProps {
  leadId: string;
  audit: AuditSnapshot | null;
  score: LeadScore | null;
  manualOverrideScoreAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  fitReasoning: string | null;
  researchTasks: any[];
}

export function AuditDisplay({
  leadId,
  audit,
  fitScore,
  confidenceScore,
  priorityTier,
  fitReasoning,
  researchTasks,
}: AuditDisplayProps) {
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

  return (
    <div className="space-y-8 animate-fade-in">
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
                      <ReactMarkdown rehypePlugins={[]}>{audit.keyStrengths}</ReactMarkdown>
                    ) : (
                      'No strengths noted.'
                    )}
                  </div>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border space-y-2">
                  <span className="text-label-12 font-semibold text-destructive block">Key Weaknesses</span>
                  <div className="text-copy-13 text-card-foreground font-medium leading-relaxed bg-muted/30 p-3 rounded-md prose-markdown">
                    {audit.keyWeaknesses ? (
                      <ReactMarkdown rehypePlugins={[]}>{audit.keyWeaknesses}</ReactMarkdown>
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
                    <ReactMarkdown rehypePlugins={[]}>{audit.recommendedImprovements}</ReactMarkdown>
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
            {fitScore !== null && confidenceScore !== null && priorityTier !== null ? (
              <ScoreBreakdown
                fitScore={fitScore}
                confidenceScore={confidenceScore}
                priorityTier={priorityTier}
                breakdown={breakdown}
                fitReasoning={fitReasoning}
              />
            ) : (
              <div className="text-center py-8 space-y-2">
                <span className="text-label-12 font-semibold text-muted-foreground uppercase block">Priority Score</span>
                <p className="text-copy-13 text-muted-foreground leading-relaxed">
                  No score calculated yet. Run research to evaluate fit and confidence.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
