'use client';

import { useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CitedEvidence {
  sentence: string;
  evidenceQuote: string;
  sourceUrl: string;
}

interface Draft {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  citedEvidence: string | null;
  riskFlags: string | null;
  rejectionReason: string | null;
}

interface DraftReviewProps {
  drafts: Draft[];
  onGenerate: () => Promise<void>;
  onApprove: (draftId: string) => Promise<void>;
  onReject: (draftId: string, reason: string) => Promise<void>;
  generating: boolean;
}

export function DraftReview({ drafts, onGenerate, onApprove, onReject, generating }: DraftReviewProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const activeDraft = drafts.find((d) => d.status === 'DRAFT');
  const approvedDraft = drafts.find((d) => d.status === 'APPROVED');
  const rejectedDrafts = drafts.filter((d) => d.status === 'REJECTED');

  const displayDraft = activeDraft || approvedDraft;

  const parseEvidence = (raw: string | null): CitedEvidence[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const parseRiskFlags = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handleApprove = async (draftId: string) => {
    setActionLoading(draftId);
    await onApprove(draftId);
    setActionLoading(null);
  };

  const handleReject = async (draftId: string) => {
    if (!rejectReason.trim()) return;
    setActionLoading(draftId);
    await onReject(draftId, rejectReason);
    setRejectingId(null);
    setRejectReason('');
    setActionLoading(null);
  };

  if (drafts.length === 0 && !generating) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <p className="text-copy-14 text-muted-foreground">No outreach drafts yet.</p>
        <Button onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Generate Draft
        </Button>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-5/6" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
        <div className="flex items-center gap-2 text-copy-14 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating draft from signals...
        </div>
      </div>
    );
  }

  if (!displayDraft) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <p className="text-copy-14 text-muted-foreground">All drafts have been reviewed.</p>
        <Button onClick={onGenerate} disabled={generating}>
          Generate New Draft
        </Button>
        {rejectedDrafts.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-label-12 text-muted-foreground uppercase">Previously rejected</p>
            {rejectedDrafts.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-copy-14 text-destructive">
                <XCircle className="w-3.5 h-3.5" />
                {d.rejectionReason || 'No reason given'}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const evidence = parseEvidence(displayDraft.citedEvidence);
  const riskFlags = parseRiskFlags(displayDraft.riskFlags);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-label-12 text-muted-foreground uppercase">
          {displayDraft.status === 'APPROVED' ? 'Approved Draft' : 'Active Draft'}
        </h3>
        <div className="flex items-center gap-2">
          {displayDraft.status === 'APPROVED' ? (
            <Badge variant="default" className="bg-chart-2">Approved</Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>
      </div>

      {riskFlags.length > 0 && (
        <div className="space-y-1">
          {riskFlags.map((flag, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-chart-5/10 border border-chart-5/30 px-3 py-2 text-copy-14 text-chart-5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {flag}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          {displayDraft.subject && (
            <div>
              <span className="text-label-12 text-muted-foreground">Subject</span>
              <p className="text-copy-14 font-medium text-foreground mt-0.5">{displayDraft.subject}</p>
            </div>
          )}
          <div>
            <span className="text-label-12 text-muted-foreground">Body</span>
            <div className="text-copy-14 text-foreground mt-0.5 whitespace-pre-wrap leading-relaxed">
              {displayDraft.body}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <span className="text-label-12 text-muted-foreground">Cited Evidence</span>
          {evidence.length === 0 ? (
            <p className="text-copy-14 text-muted-foreground italic">No evidence citations.</p>
          ) : (
            evidence.map((c, i) => (
              <div key={i} className="border-l-2 border-primary/40 pl-3 space-y-1">
                <p className="text-copy-14 text-foreground">&ldquo;{c.evidenceQuote}&rdquo;</p>
                <p className="text-label-12 text-muted-foreground">
                  Used in: <span className="italic">{c.sentence.length > 80 ? c.sentence.slice(0, 80) + '...' : c.sentence}</span>
                </p>
                {c.sourceUrl && (
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-label-12 text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" />
                    {c.sourceUrl}
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {displayDraft.status === 'APPROVED' ? (
        <div className="flex items-center gap-2 rounded-lg bg-chart-2/10 border border-chart-2/30 px-4 py-3 text-copy-14 text-chart-2">
          <CheckCircle2 className="w-4 h-4" />
          Approved — sending was not performed. Log an outcome when ready.
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleApprove(displayDraft.id)}
            disabled={actionLoading === displayDraft.id}
          >
            {actionLoading === displayDraft.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Approve
          </Button>
          <Button variant="destructive" onClick={() => setRejectingId(displayDraft.id)}>
            Reject
          </Button>
          <Button variant="outline" onClick={onGenerate} disabled={generating}>
            Regenerate
          </Button>
        </div>
      )}

      {rejectingId === displayDraft.id && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Label htmlFor="reject-reason">Reason for rejection</Label>
          <Input id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why are you rejecting this draft?" />
          <div className="flex gap-2">
            <Button variant="destructive" onClick={() => handleReject(displayDraft.id)} disabled={!rejectReason.trim() || actionLoading === displayDraft.id}>
              Confirm Reject
            </Button>
            <Button variant="outline" onClick={() => { setRejectingId(null); setRejectReason(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {rejectedDrafts.length > 0 && (
        <div className="space-y-2">
          <span className="text-label-12 text-muted-foreground uppercase">Previously rejected</span>
          {rejectedDrafts.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-copy-14 text-destructive">
              <XCircle className="w-3.5 h-3.5" />
              {d.rejectionReason || 'No reason given'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
