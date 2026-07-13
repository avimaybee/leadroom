'use client';

import { useState } from 'react';
import { Loader2, FileText, CheckCircle2, ShieldAlert, TriangleAlert, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { generateOutreachDraftAction, markAsSentAction } from '@/app/actions/outreach';
import { approveDraftAction, rejectDraftAction, logOutcomeAction } from '@/app/actions/outcomes';
import { clientLog } from '@/lib/client-logger';
import { handleClientError, handleClientSuccess } from '@/lib/actions/toast-error';

interface Draft {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  channel: string;
  citedEvidence: string | null;
  riskFlags: string | null;
  rejectionReason: string | null;
}

interface OutreachSectionProps {
  prospectId: string;
  drafts: Draft[];
}

export function OutreachSection({ prospectId, drafts }: OutreachSectionProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    clientLog.info('OutreachSection', 'Generating draft', { prospectId });
    try {
      const result = await generateOutreachDraftAction(prospectId, 'EMAIL');
      if (result.error) {
        setError(result.error);
        handleClientError('OutreachSection', 'Generate draft', new Error(result.error), result.error);
      } else {
        handleClientSuccess('OutreachSection', 'Generate draft', 'Draft generated', { prospectId });
      }
    } catch (err) {
      handleClientError('OutreachSection', 'Generate draft', err, 'Failed to generate draft');
    }
    setGenerating(false);
  };

  const handleApprove = async (draftId: string) => {
    setActionLoading(draftId);
    clientLog.info('OutreachSection', 'Approving draft', { draftId });
    try {
      const result = await approveDraftAction(draftId);
      if (result.error) {
        handleClientError('OutreachSection', 'Approve draft', new Error(result.error), result.error);
      } else {
        handleClientSuccess('OutreachSection', 'Approve draft', 'Draft approved', { draftId });
      }
    } catch (err) {
      handleClientError('OutreachSection', 'Approve draft', err, 'Failed to approve draft');
    }
    setActionLoading(null);
  };

  const handleReject = async (draftId: string) => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason || !reason.trim()) return;
    setActionLoading(draftId);
    clientLog.info('OutreachSection', 'Rejecting draft', { draftId, reason: reason.trim() });
    try {
      const result = await rejectDraftAction(draftId, reason.trim());
      if (result.error) {
        handleClientError('OutreachSection', 'Reject draft', new Error(result.error), result.error);
      } else {
        handleClientSuccess('OutreachSection', 'Reject draft', 'Draft rejected', { draftId });
      }
    } catch (err) {
      handleClientError('OutreachSection', 'Reject draft', err, 'Failed to reject draft');
    }
    setActionLoading(null);
  };

  const handleMarkSent = async (draftId: string) => {
    setActionLoading(draftId);
    clientLog.info('OutreachSection', 'Marking as sent', { draftId });
    try {
      const result = await markAsSentAction(draftId);
      if (result.error) {
        handleClientError('OutreachSection', 'Mark sent', new Error(result.error), result.error);
      } else {
        handleClientSuccess('OutreachSection', 'Mark sent', 'Marked as sent', { draftId });
      }
    } catch (err) {
      handleClientError('OutreachSection', 'Mark sent', err, 'Failed to mark as sent');
    }
    setActionLoading(null);
  };

  const handleLogOutcome = async (draftId: string) => {
    const outcomeType = window.prompt('Outcome (REPLIED/BOUNCE/UNSUBSCRIBE/OTHER):');
    if (!outcomeType || !outcomeType.trim()) return;
    setActionLoading(draftId);
    clientLog.info('OutreachSection', 'Logging outcome', { prospectId, draftId, outcomeType: outcomeType.trim() });
    try {
      const result = await logOutcomeAction({
        prospectId,
        draftId,
        outcomeType: outcomeType.trim(),
        notes: '',
      });
      if (result.error) {
        handleClientError('OutreachSection', 'Log outcome', new Error(result.error), result.error);
      } else {
        toast.success('Outcome logged');
        clientLog.info('OutreachSection', 'Outcome logged', { prospectId, outcomeType: outcomeType.trim() });
      }
    } catch (err) {
      handleClientError('OutreachSection', 'Log outcome', err, 'Failed to log outcome');
    }
    setActionLoading(null);
  };

  const activeDraft = drafts.find(d => d.status === 'DRAFT' || d.status === 'APPROVED');

  return (
    <div className="space-y-4">
      {generating && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0" />
          <div>
            <p className="text-label-14 font-medium">Generating...</p>
            <p className="text-copy-13 text-muted-foreground">Analyzing signals and drafting...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-copy-14 text-destructive">{error}</p>
        </div>
      )}

      {drafts.length === 0 && !generating && (
        <div className="text-center py-6">
          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-copy-14 text-muted-foreground">No outreach drafts yet.</p>
          <p className="text-copy-13 text-muted-foreground mt-1">
            Uses your Offer + ICP signals to personalize. Review before approving.
          </p>
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 mt-3 h-9 px-3 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {generating && <Loader2 className="w-4 h-4 animate-spin" />}
            {generating ? 'Generating...' : 'Generate Draft'}
          </button>
        </div>
      )}

      {drafts.map((d) => {
        let riskFlags: string[] = [];
        let citedEvidence: { sentence: string; evidenceQuote: string; sourceUrl: string }[] = [];

        try { riskFlags = d.riskFlags ? JSON.parse(d.riskFlags) : []; } catch {}
        try { citedEvidence = d.citedEvidence ? JSON.parse(d.citedEvidence) : []; } catch {}

        return (
          <div key={d.id} className="space-y-3">
            {d.status === 'SENT' && (
              <div className="bg-primary/10 text-primary rounded-xl p-4 flex items-center gap-3">
                <Send className="w-5 h-5 shrink-0" />
                <span className="text-label-14 font-semibold">Sent</span>
                <span className="text-copy-13 text-primary/80">Sent via {d.channel}</span>
                <button
                  type="button"
                  disabled={actionLoading === d.id}
                  onClick={() => handleLogOutcome(d.id)}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-primary/30 text-label-12 hover:bg-primary/5 disabled:opacity-50 ml-auto"
                >
                  {actionLoading === d.id && <Loader2 className="w-3 h-3 animate-spin" />}
                  Log Outcome
                </button>
              </div>
            )}

            {d.status === 'APPROVED' && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-chart-2/10 border border-chart-2/20">
                <CheckCircle2 className="w-4 h-4 text-chart-2 shrink-0" />
                <span className="text-label-12 text-chart-2 font-semibold">Approved</span>
              </div>
            )}

            {d.status === 'REJECTED' && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <span className="text-label-12 text-destructive font-semibold block">Rejected</span>
                  {d.rejectionReason && (
                    <p className="text-copy-13 text-destructive mt-0.5">{d.rejectionReason}</p>
                  )}
                </div>
              </div>
            )}

            {d.subject && (
              <div>
                <span className="text-label-12 text-muted-foreground block mb-1">Subject</span>
                <p className="text-copy-14 font-medium">{d.subject}</p>
              </div>
            )}
            <div>
              <span className="text-label-12 text-muted-foreground block mb-1">Body</span>
              <div className="text-copy-14 whitespace-pre-wrap text-foreground bg-muted/20 rounded-md p-3 max-h-[200px] overflow-y-auto">
                {d.body}
              </div>
            </div>

            {riskFlags.length > 0 && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-chart-5/10 border border-chart-5/20">
                <TriangleAlert className="w-4 h-4 text-chart-5 shrink-0 mt-0.5" />
                <div>
                  <span className="text-label-12 text-chart-5 font-semibold block">Risk Flags</span>
                  <ul className="mt-1 space-y-0.5">
                    {riskFlags.map((f, i) => (
                      <li key={i} className="text-copy-13 text-chart-5">&bull; {f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {citedEvidence.length > 0 && (
              <details className="group">
                <summary className="text-label-12 text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Cited Evidence ({citedEvidence.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {citedEvidence.map((e, i) => (
                    <div key={i} className="border-l-2 border-border pl-3">
                      <p className="text-copy-13 italic text-muted-foreground">&ldquo;{e.evidenceQuote}&rdquo;</p>
                      {e.sourceUrl && (
                        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-label-12 text-primary hover:underline decoration-border underline-offset-4">
                          {e.sourceUrl}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {d.status === 'DRAFT' && (
              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={actionLoading === d.id}
                  onClick={() => handleApprove(d.id)}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-chart-2 text-white text-label-12 hover:bg-chart-2/90 transition-colors disabled:opacity-50"
                >
                  {actionLoading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Approve
                </button>
                <button
                  type="button"
                  disabled={actionLoading === d.id}
                  onClick={() => handleReject(d.id)}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border text-label-12 hover:bg-muted/50 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  Reject
                </button>
              </div>
            )}

            {d.status === 'APPROVED' && (
              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={actionLoading === d.id}
                  onClick={() => handleMarkSent(d.id)}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-primary text-primary-foreground text-label-12 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {actionLoading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Mark as Sent
                </button>
              </div>
            )}

            {d.status === 'REJECTED' && (
              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={generating}
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border text-label-12 hover:bg-muted/50 disabled:opacity-50"
                >
                  {generating && <Loader2 className="w-3 h-3 animate-spin" />}
                  Regenerate with feedback
                </button>
              </div>
            )}
          </div>
        );
      })}

      {drafts.length > 0 && !activeDraft && (
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerate}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors disabled:opacity-50 w-full justify-center"
        >
          {generating && <Loader2 className="w-4 h-4 animate-spin" />}
          {generating ? 'Generating...' : 'Generate New Draft'}
        </button>
      )}

      {drafts.length > 0 && (
        <a
          href={`/prospects/${prospectId}/outreach`}
          className="label-12 underline decoration-border underline-offset-4 text-muted-foreground hover:text-foreground transition-colors block text-center"
        >
          Open full Outreach Assistant
        </a>
      )}
    </div>
  );
}
