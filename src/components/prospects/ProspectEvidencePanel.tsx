'use client';

import { ExternalLink, Loader2 } from 'lucide-react';

interface PainSignal {
  signal: string;
  evidenceQuote: string;
  sourceUrl: string;
  matchStrength?: string;
}

interface Contact {
  id: string;
  fullName: string | null;
  roleTitle: string | null;
  email: string | null;
  isPrimary: number | boolean;
}

interface ResearchTask {
  id: string;
  taskType: string;
  status: string;
  extractedSignals: string | null;
  errorMessage: string | null;
  confidence: number | null;
}

interface ProspectEvidencePanelProps {
  companyName: string;
  domain: string | null;
  summary: string | null;
  painSignals: PainSignal[];
  contacts: Contact[];
  researchTasks: ResearchTask[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-chart-5/10 text-chart-5',
  RUNNING: 'bg-primary/10 text-primary',
  COMPLETED: 'bg-chart-2/10 text-chart-2',
  FAILED: 'bg-destructive/10 text-destructive',
};

const TASK_LABELS: Record<string, string> = {
  WEBSITE_ANALYST: 'Website Analysis',
  ICP_FIT: 'ICP Fit Assessment',
  PAIN_EXTRACTOR: 'Pain Signal Extraction',
  DISQUALIFIER_CHECK: 'Disqualifier Check',
};

export function ProspectEvidencePanel({
  companyName,
  domain,
  summary,
  painSignals,
  contacts,
  researchTasks,
}: ProspectEvidencePanelProps) {
  return (
    <div className="space-y-6">
      {summary && (
        <div>
          <label className="label-12 uppercase text-muted-foreground block mb-2">Company Summary</label>
          <p className="text-copy-14 text-foreground leading-relaxed">{summary}</p>
          {domain && (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 text-label-12 text-primary hover:underline decoration-border underline-offset-4"
            >
              <ExternalLink className="w-3 h-3" />
              {domain}
            </a>
          )}
        </div>
      )}

      {painSignals.length > 0 && (
        <div>
          <label className="label-12 uppercase text-muted-foreground block mb-2">Pain Signals Found</label>
          <div className="space-y-3">
            {painSignals.map((signal, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="text-copy-14 font-medium text-foreground">{signal.signal}</p>
                {signal.matchStrength && (
                  <span className={`text-label-12 font-semibold ${
                    signal.matchStrength === 'strong' ? 'text-chart-2' : signal.matchStrength === 'partial' ? 'text-chart-5' : 'text-muted-foreground'
                  }`}>
                    {signal.matchStrength}
                  </span>
                )}
                {signal.evidenceQuote && (
                  <p className="text-copy-13 italic text-muted-foreground border-l-2 border-border pl-3 mt-1">
                    &ldquo;{signal.evidenceQuote}&rdquo;
                  </p>
                )}
                {signal.sourceUrl && (
                  <a
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-label-12 text-primary hover:underline decoration-border underline-offset-4"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {signal.sourceUrl}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <div>
          <label className="label-12 uppercase text-muted-foreground block mb-2">Contacts</label>
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-copy-14">
                <span className="font-medium">{c.fullName || 'Unknown'}</span>
                {c.isPrimary && <span className="text-label-12 text-primary font-semibold">Primary</span>}
                {c.roleTitle && <span className="text-muted-foreground">&middot; {c.roleTitle}</span>}
                {c.email && <span className="text-muted-foreground">&middot; {c.email}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {researchTasks.length > 0 && (
        <div>
          <label className="label-12 uppercase text-muted-foreground block mb-2">Research Tasks</label>
          <div className="flex flex-wrap gap-2">
            {researchTasks.map((t) => (
              <span
                key={t.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-label-12 font-semibold ${STATUS_COLORS[t.status] || 'bg-muted/10 text-muted-foreground'}`}
              >
                {t.status === 'RUNNING' && <Loader2 className="w-3 h-3 animate-spin" />}
                {TASK_LABELS[t.taskType] || t.taskType}
                {t.confidence !== null && t.confidence !== undefined && ` (${t.confidence}%)`}
              </span>
            ))}
          </div>
        </div>
      )}

      {!summary && painSignals.length === 0 && contacts.length === 0 && researchTasks.length === 0 && (
        <p className="text-copy-14 text-muted-foreground text-center py-8">
          No research data available yet. Research tasks may still be running.
        </p>
      )}
    </div>
  );
}
