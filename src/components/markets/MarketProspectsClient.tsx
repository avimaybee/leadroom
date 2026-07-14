'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { DiscoverLeadsModal } from './DiscoverLeadsModal';
import { EditCandidateModal } from './EditCandidateModal';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { promoteCandidateAction, discardCandidateAction, checkDiscoveryJobAction } from '@/app/actions/discovery-candidate';
import { ExternalLink, ThumbsUp, ThumbsDown, Users, ChevronDown, ChevronRight, AlertTriangle, Pencil, Loader2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Candidate {
  id: string;
  rawName: string;
  rawWebsiteUrl: string | null;
  rawLocation: string | null;
  rawContactInfo: string | null;
  notes: string | null;
  status: string;
  scopeName: string | null;
}

interface MarketProspectsClientProps {
  marketId: string;
  marketName: string;
  candidates: Candidate[];
}

const DISCARD_REASONS = [
  'Wrong industry',
  'Wrong location',
  'Not a good fit',
  'Duplicate',
  'No website or contact info',
  'Too small / not relevant',
  'Other',
];

function CandidateActions({ candidate, marketId, onActionDone }: { candidate: Candidate; marketId: string; onActionDone: () => void }) {
  const [promoting, setPromoting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [discardReason, setDiscardReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handlePromote = async () => {
    setPromoting(true);
    const form = new FormData();
    form.append('candidateId', candidate.id);
    const result = await promoteCandidateAction(null, form);
    if (result.error) {
      toast.error(result.error);
      setPromoting(false);
    } else {
      toast.success(`${candidate.rawName} promoted to prospect`);
      onActionDone();
    }
  };

  const handleDiscard = async () => {
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      setDiscardReason('');
      setCustomReason('');
      return;
    }
    const finalReason = discardReason === 'Other' ? customReason.trim() : discardReason;
    if (!finalReason) {
      toast.error('Please select or enter a discard reason');
      return;
    }
    setDiscarding(true);
    const form = new FormData();
    form.append('candidateId', candidate.id);
    form.append('marketId', marketId);
    form.append('discardReason', finalReason);
    const result = await discardCandidateAction(null, form);
    if (result?.error) {
      toast.error(result.error);
    }
    setDiscarding(false);
    onActionDone();
  };

  const cancelDiscard = () => {
    setConfirmDiscard(false);
    setDiscardReason('');
    setCustomReason('');
  };

  const handleEditPromoted = useCallback(() => {
    setEditOpen(false);
    onActionDone();
  }, [onActionDone]);

  if (editOpen) {
    return (
      <EditCandidateModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        candidate={candidate}
        onPromoted={handleEditPromoted}
      />
    );
  }

  if (confirmDiscard) {
    return (
      <div className="flex flex-col gap-2 min-w-[240px]">
        <div className="flex items-center gap-1.5 text-label-12 text-destructive">
          <AlertTriangle className="w-3 h-3" />
          <span className="font-semibold">Confirm discard</span>
        </div>
        <select
          value={discardReason}
          onChange={(e) => setDiscardReason(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-label-12"
        >
          <option value="">Select a reason...</option>
          {DISCARD_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {discardReason === 'Other' && (
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Enter custom reason..."
            className="h-8 rounded-md border border-border bg-background px-2 text-label-12"
          />
        )}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-label-12 font-semibold text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleDiscard}
            disabled={discarding || !discardReason}
          >
            {discarding ? 'Discarding...' : 'Yes, Discard'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-label-12 font-semibold"
            onClick={cancelDiscard}
            disabled={discarding}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2.5 text-label-12 font-semibold text-muted-foreground hover:text-foreground"
        onClick={() => setEditOpen(true)}
        disabled={promoting || discarding}
        title="Edit & Promote"
      >
        <Pencil className="w-3.5 h-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2.5 text-label-12 font-semibold text-chart-2 border-chart-2/30 hover:bg-chart-2/10"
        onClick={handlePromote}
        disabled={promoting || discarding}
      >
        <ThumbsUp className="w-3.5 h-3.5 mr-1" />
        {promoting ? 'Promoting...' : 'Promote'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2.5 text-label-12 font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10"
        onClick={handleDiscard}
        disabled={promoting || discarding}
      >
        <ThumbsDown className="w-3.5 h-3.5 mr-1" />
        {discarding ? 'Discarding...' : 'Discard'}
      </Button>
    </div>
  );
}

function DiscoveryJobBanner({ jobId, marketId, onDone }: { jobId: string; marketId: string; onDone: () => void }) {
  const [status, setStatus] = useState('QUEUED');
  const [stage, setStage] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [processed, setProcessed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const result = await checkDiscoveryJobAction(jobId);
      if (!active) return;
      if ('error' in result) {
        setError(result.error);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      setStatus(result.status);
      setStage(result.currentStage);
      setTotal(result.totalItems);
      setProcessed(result.itemsProcessed);
      if (result.status === 'COMPLETED' || result.status === 'FAILED') {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (result.status === 'COMPLETED') {
          setTimeout(onDone, 2000);
        }
      }
    };
    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId, onDone]);

  const isRunning = status === 'QUEUED' || status === 'RUNNING';
  const isComplete = status === 'COMPLETED';
  const isFailed = status === 'FAILED';

  if (isComplete) {
    return (
      <div className="mb-6 rounded-xl border border-chart-2/30 bg-chart-2/5 p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-chart-2/10 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-chart-2" />
        </div>
        <div>
          <p className="text-copy-14 font-semibold text-chart-2">Discovery complete</p>
          <p className="text-label-12 text-muted-foreground">
            {total !== null ? `Found ${total} leads` : 'Search finished'}
          </p>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
          <XCircle className="w-5 h-5 text-destructive" />
        </div>
        <div className="min-w-0">
          <p className="text-copy-14 font-semibold text-destructive">Discovery failed</p>
          <p className="text-label-12 text-muted-foreground truncate">{error || 'Search encountered an error'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
      <div className="relative flex items-center justify-center shrink-0">
        <div className="absolute w-8 h-8 bg-primary/10 rounded-full animate-ping duration-1000" />
        <div className="w-8 h-8 bg-primary/15 rounded-full flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-copy-14 font-semibold">Searching for leads...</p>
        <p className="text-label-12 text-muted-foreground truncate">
          {stage || 'Starting Apify crawler...'}
        </p>
      </div>
    </div>
  );
}

export function MarketProspectsClient({ marketId, marketName, candidates }: MarketProspectsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isDiscoverOpen = searchParams.get('tab') === 'discover';
  const jobId = searchParams.get('jobId');
  const [reviewExpanded, setReviewExpanded] = useState(true);

  const handleCloseDiscover = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('tab');
    router.replace(`/markets/${marketId}/prospects?${p.toString()}`, { scroll: false });
  };

  const handleDiscoveryStarted = useCallback((jobId: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('jobId', jobId);
    p.delete('tab');
    router.replace(`/markets/${marketId}/prospects?${p.toString()}`, { scroll: false });
  }, [router, marketId, searchParams]);

  const handleActionDone = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleDiscoveryDone = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('jobId');
    router.replace(`/markets/${marketId}/prospects?${p.toString()}`, { scroll: false });
    router.refresh();
  }, [router, marketId, searchParams]);

  return (
    <>
      <DiscoverLeadsModal
        isOpen={isDiscoverOpen}
        onClose={handleCloseDiscover}
        marketId={marketId}
        marketName={marketName}
        onDiscoveryStarted={handleDiscoveryStarted}
      />

      {/* Polling indicator for in-progress discovery */}
      {jobId && (
        <DiscoveryJobBanner jobId={jobId} marketId={marketId} onDone={handleDiscoveryDone} />
      )}

      {/* Candidate Review Section */}
      {candidates.length > 0 && (
        <div className="mb-8 rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setReviewExpanded(!reviewExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-chart-5" />
              <span className="text-label-14 font-semibold">Awaiting Review</span>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-chart-5/10 text-chart-5 text-label-12 font-bold">
                {candidates.length}
              </span>
            </div>
            {reviewExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {reviewExpanded && (
            <div className="divide-y divide-border/40">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-copy-14 font-medium truncate">{candidate.rawName}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {candidate.rawWebsiteUrl && (
                          <a
                            href={candidate.rawWebsiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-label-12 text-muted-foreground hover:text-primary transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                            {(() => {
                              try { return new URL(candidate.rawWebsiteUrl).hostname.replace(/^www\./, ''); } catch { return candidate.rawWebsiteUrl; }
                            })()}
                          </a>
                        )}
                        {candidate.rawLocation && (
                          <span className="text-label-12 text-muted-foreground">{candidate.rawLocation}</span>
                        )}
                        {candidate.notes && (
                          <span className="text-label-12 text-muted-foreground truncate">{candidate.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <CandidateActions candidate={candidate} marketId={marketId} onActionDone={handleActionDone} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
