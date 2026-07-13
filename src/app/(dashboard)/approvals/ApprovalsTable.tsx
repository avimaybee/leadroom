'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, X, Send, TriangleAlert, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { approveDraftAction, rejectDraftAction } from '@/app/actions/outcomes';
import { markAsSentAction } from '@/app/actions/outreach';
import { useRouter } from 'next/navigation';

interface DraftRow {
  id: string;
  leadId: string;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  citedEvidence: string | null;
  riskFlags: string | null;
  prospectName: string | null;
  prospectCompany: string | null;
  fitScore: number | null;
  priorityTier: string | null;
  marketName: string | null;
  createdAt: Date | null;
}

interface ApprovalsTableProps {
  drafts: DraftRow[];
}

type FilterTab = 'all' | 'risk' | 'approved' | 'rejected';

export function ApprovalsTable({ drafts }: ApprovalsTableProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');

  const filteredDrafts = drafts.filter(d => {
    if (filter === 'all') return d.status === 'DRAFT';
    if (filter === 'risk') {
      try {
        const flags = d.riskFlags ? JSON.parse(d.riskFlags) : [];
        return flags.length > 0 && d.status === 'DRAFT';
      } catch { return false; }
    }
    if (filter === 'approved') return d.status === 'APPROVED';
    if (filter === 'rejected') return d.status === 'REJECTED';
    return true;
  });

  const handleAction = async (draftId: string, action: 'approve' | 'reject' | 'sent') => {
    setActionLoading(draftId);
    let result: any;
    if (action === 'approve') {
      result = await approveDraftAction(draftId);
    } else if (action === 'reject') {
      const reason = window.prompt('Reason for rejection:');
      if (!reason || !reason.trim()) { setActionLoading(null); return; }
      result = await rejectDraftAction(draftId, reason.trim());
    } else {
      result = await markAsSentAction(draftId);
    }
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Marked sent');
      router.refresh();
    }
    setActionLoading(null);
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: drafts.filter(d => d.status === 'DRAFT').length },
    {
      key: 'risk',
      label: 'Risk-Flagged',
      count: drafts.filter(d => {
        try { return d.riskFlags && JSON.parse(d.riskFlags).length > 0 && d.status === 'DRAFT'; } catch { return false; }
      }).length,
    },
    { key: 'approved', label: 'Approved', count: drafts.filter(d => d.status === 'APPROVED').length },
    { key: 'rejected', label: 'Rejected', count: drafts.filter(d => d.status === 'REJECTED').length },
  ];

  return (
    <div>
      <div className="flex items-center gap-1 mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-label-12 transition-colors ${
              filter === t.key
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t.label}
            <span className="opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredDrafts.length === 0 && (
          <div className="text-center py-12 text-copy-14 text-muted-foreground">
            {filter === 'all' ? 'No pending drafts.' : 'None found.'}
          </div>
        )}

        {filteredDrafts.map(d => {
          let riskFlags: string[] = [];
          let citedEvidence: { sentence: string; evidenceQuote: string; sourceUrl: string }[] = [];
          try { riskFlags = d.riskFlags ? JSON.parse(d.riskFlags) : []; } catch {}
          try { citedEvidence = d.citedEvidence ? JSON.parse(d.citedEvidence) : []; } catch {}
          const isExpanded = expandedId === d.id;
          const isDraft = d.status === 'DRAFT';

          return (
            <div
              key={d.id}
              className={`rounded-xl border border-border overflow-hidden transition-shadow ${
                isDraft ? 'hover:shadow-sm' : 'opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/prospects/${d.leadId}`}
                      className="text-copy-14 font-medium text-foreground hover:text-primary transition-colors truncate"
                    >
                      {d.prospectName || 'Unknown'}
                    </Link>
                    {d.prospectCompany && (
                      <span className="text-copy-13 text-muted-foreground truncate">{d.prospectCompany}</span>
                    )}
                    {d.fitScore != null && (
                      <span className={`text-label-12 font-semibold shrink-0 ${
                        d.fitScore >= 70 ? 'text-chart-2' : d.fitScore >= 40 ? 'text-chart-4' : 'text-muted-foreground'
                      }`}>
                        {d.fitScore}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {d.priorityTier && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-label-11 font-semibold ${
                        d.priorityTier === 'tier1' ? 'bg-chart-2/10 text-chart-2'
                          : d.priorityTier === 'tier2' ? 'bg-muted/50 text-muted-foreground'
                          : d.priorityTier === 'disqualified' ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted/30 text-muted-foreground'
                      }`}>
                        {d.priorityTier === 'tier1' ? 'T1'
                          : d.priorityTier === 'tier2' ? 'T2'
                          : d.priorityTier === 'tier3' ? 'T3'
                          : d.priorityTier === 'disqualified' ? 'DQ'
                          : d.priorityTier}
                      </span>
                    )}
                    {riskFlags.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-chart-5/10 border border-chart-5/20 px-1.5 py-0.5">
                        <TriangleAlert className="w-3 h-3 text-chart-5" />
                        <span className="text-label-11 text-chart-5">{riskFlags.length} risk</span>
                      </span>
                    )}
                    {d.channel && (
                      <span className="text-label-11 text-muted-foreground uppercase bg-muted/50 px-1.5 py-0.5 rounded">
                        {d.channel}
                      </span>
                    )}
                    {d.status !== 'DRAFT' && (
                      <span className={`text-label-11 uppercase ${
                        d.status === 'APPROVED' ? 'text-chart-2' : 'text-destructive'
                      }`}>
                        {d.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isDraft && (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading === d.id}
                        onClick={() => handleAction(d.id, 'approve')}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-chart-2 text-white text-label-12 hover:bg-chart-2/90 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === d.id}
                        onClick={() => handleAction(d.id, 'reject')}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border text-label-12 hover:bg-muted/50 disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>
                    </>
                  )}
                  {d.status === 'APPROVED' && (
                    <button
                      type="button"
                      disabled={actionLoading === d.id}
                      onClick={() => handleAction(d.id, 'sent')}
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-primary text-primary-foreground text-label-12 hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Mark Sent
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
                  {d.subject && (
                    <div>
                      <span className="text-label-12 text-muted-foreground block mb-0.5">Subject</span>
                      <p className="text-copy-14 font-medium">{d.subject}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-label-12 text-muted-foreground block mb-0.5">Body</span>
                    <div className="text-copy-14 whitespace-pre-wrap bg-muted/20 rounded-md p-3 max-h-[200px] overflow-y-auto">
                      {d.body}
                    </div>
                  </div>

                  {citedEvidence.length > 0 && (
                    <div>
                      <span className="text-label-12 text-muted-foreground block mb-1">Cited Evidence</span>
                      <div className="space-y-2">
                        {citedEvidence.map((e, i) => (
                          <div key={i} className="border-l-2 border-border pl-3">
                            <p className="text-copy-13 italic text-muted-foreground">&ldquo;{e.evidenceQuote}&rdquo;</p>
                            {e.sourceUrl && (
                              <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-label-12 text-primary hover:underline">
                                <ExternalLink className="w-3 h-3" />
                                {e.sourceUrl}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {riskFlags.length > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-chart-5/10 border border-chart-5/20">
                      <TriangleAlert className="w-4 h-4 text-chart-5 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-label-12 text-chart-5 font-semibold block mb-1">Risk Flags</span>
                        <ul className="space-y-0.5">
                          {riskFlags.map((f, i) => (
                            <li key={i} className="text-copy-13 text-chart-5">&bull; {f}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
