'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ExternalLink, Search, FileText, Trash2, X, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { formatUTC } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Scope {
  id: string;
  name: string;
  description: string | null;
  industryFilter: string | null;
  geographyFilter: string | null;
  companySizeFilter: string | null;
  businessTypeFilter: string | null;
  notes: string | null;
  createdAt: string;
}

interface Candidate {
  id: string;
  discoveryScopeId: string | null;
  rawName: string;
  rawWebsiteUrl: string | null;
  rawContactInfo: string | null;
  rawLocation: string | null;
  notes: string | null;
  status: 'NEW' | 'REVIEWED' | 'PROMOTED' | 'DISCARDED';
  triagePriority: 'UNASSESSED' | 'HIGH' | 'MEDIUM' | 'SKIP';
  triageReason: string | null;
  promotedLeadId: string | null;
  createdAt: string;
}

interface RecentRun {
  id: string;
  status: string;
  niche: string;
  location: string;
  scopeId: string | null;
  createdAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
}

export default function ScopeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [scope, setScope] = useState<Scope | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab control: 'pending', 'promoted', 'discarded'
  const [activeTab, setActiveTab] = useState<'pending' | 'promoted' | 'discarded'>('pending');
  
  // Modal state for manual candidate
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({
    rawName: '',
    rawWebsiteUrl: '',
    rawLocation: '',
    rawContactInfo: '',
    notes: '',
  });
  const [modalError, setModalError] = useState('');
  const [submittingCandidate, setSubmittingCandidate] = useState(false);
  
  // Refine Search / Find More Leads Modal
  const [isRefineModalOpen, setIsRefineModalOpen] = useState(false);
  const [refineForm, setRefineForm] = useState({
    niche: '',
    location: '',
    limit: 1,
  });
  
  // Recent runs history & Polling status
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [activeJobRun, setActiveJobRun] = useState<RecentRun | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [isRecentRunsExpanded, setIsRecentRunsExpanded] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Enrichment progress (from discovery jobs)
  const [enrichProgress, setEnrichProgress] = useState<{
    totalItems: number;
    itemsProcessed: number;
    currentStage: string;
  } | null>(null);

  // Current logged in user ID
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [isSpecsExpanded, setIsSpecsExpanded] = useState(false);

  const fetchRecentRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/discovery/recent?scopeId=${id}`);
      if (res.ok) {
        const data = await res.json() as any;
        if (data.success && Array.isArray(data.data)) {
          setRecentRuns(data.data);
          
          // Check if there is a running/queued job
          const activeRun = data.data.find(
            (run: any) => run.status === 'RUNNING' || run.status === 'QUEUED'
          );
          if (activeRun) {
            setActiveJobRun(activeRun);
            setPollingJobId(activeRun.id);
          } else {
            setActiveJobRun(null);
            setPollingJobId(null);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load recent discovery runs:', e);
    }
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [scopeRes, candidatesRes] = await Promise.all([
        fetch(`/api/scopes?id=${id}`),
        fetch(`/api/candidates?scopeId=${id}`),
      ]);

      if (!scopeRes.ok) throw new Error('Failed to load campaign');
      if (!candidatesRes.ok) throw new Error('Failed to load candidates');

      const scopeData = (await scopeRes.json()) as { data: Scope };
      const candidatesData = (await candidatesRes.json()) as { data: Candidate[] };

      setScope(scopeData.data);
      setCandidates(candidatesData.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while fetching data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch user profile
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json() as Promise<{ user: { id: string; name: string } }>;
        throw new Error('Not logged in');
      })
      .then(data => {
        setCurrentUser(data.user);
      })
      .catch(() => {
        console.warn('Unable to retrieve current user info');
      });

    // Fetch Campaign and Candidates
    fetchData();
    fetchRecentRuns();
  }, [id, fetchRecentRuns]);

  // Polling loop to check crawler job status
  const checkJobStatus = useCallback(
    async (jobId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error('Failed to verify search progress');

        const raw = await res.json() as {
          status: string;
          errorSummary?: string;
          totalItems?: number;
          itemsProcessed?: number;
          currentStage?: string;
        };

        // Always refetch candidates so triage badges appear as enrichment runs
        const candidatesRes = await fetch(`/api/candidates?scopeId=${id}`);
        if (candidatesRes.ok) {
          const data = await candidatesRes.json() as { data: Candidate[] };
          setCandidates(data.data);
        }

        // Update enrichment progress (even for 0 values while still queued)
        if (raw.totalItems != null) {
          setEnrichProgress({
            totalItems: raw.totalItems,
            itemsProcessed: raw.itemsProcessed ?? 0,
            currentStage: raw.currentStage || 'Starting...',
          });

          if (raw.status === 'COMPLETED' || raw.status === 'FAILED') {
            // Clear progress after a brief delay so user sees "Complete"
            setTimeout(() => setEnrichProgress(null), 2000);
          }
        }

        if (raw.status === 'COMPLETED') {
          await fetchRecentRuns();
          return true; // done
        } else if (raw.status === 'FAILED') {
          await fetchRecentRuns();
          return true; // done
        }
        return false; // still running
      } catch (err: unknown) {
        console.error('Polling failed, will retry:', err);
        return false; // continue polling — don't let transient errors freeze the UI
      }
    },
    [id, fetchRecentRuns],
  );

  useEffect(() => {
    if (!pollingJobId) return;

    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (stopped) return;
      const done = await checkJobStatus(pollingJobId);
      if (!done && !stopped) {
        timeoutId = setTimeout(poll, 6000); // 6s between polls
      }
    };

    poll();

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
    };
  }, [pollingJobId, checkJobStatus]);

  const handleUpdateStatus = async (candidateId: string, status: 'PROMOTED' | 'DISCARDED') => {
    try {
      const payload = { id: candidateId, status };

      const res = await fetch('/api/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = 'Failed to update candidate status';
        try {
          const errData = JSON.parse(errText);
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      // Re-fetch data
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating candidate';
      alert(msg);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSubmittingCandidate(true);

    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCandidate,
          discoveryScopeId: id,
          status: 'NEW',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = 'Failed to add candidate';
        try {
          const errData = JSON.parse(errText);
          errMsg = errData.error?.rawName?._errors?.[0] || errData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      // Reset modal state
      setNewCandidate({
        rawName: '',
        rawWebsiteUrl: '',
        rawLocation: '',
        rawContactInfo: '',
        notes: '',
      });
      setIsModalOpen(false);
      // Re-fetch list
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting candidate';
      setModalError(msg);
    } finally {
      setSubmittingCandidate(false);
    }
  };

  const handleRefineSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineForm.niche || !refineForm.location) return;

    setIsRefineModalOpen(false);
    
    // Optimistically show starting state
    setActiveJobRun({
      id: 'starting',
      status: 'QUEUED',
      niche: refineForm.niche,
      location: refineForm.location,
      scopeId: id,
      createdAt: new Date().toISOString(),
      finishedAt: null,
      errorSummary: null,
    });

    try {
      const res = await fetch('/api/discovery/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: refineForm.niche.trim(),
          location: refineForm.location.trim(),
          limit: refineForm.limit,
          scopeId: id,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Failed to start search');
      }

      const data = await res.json() as { jobId: string };
      setPollingJobId(data.jobId);
      await fetchRecentRuns();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to launch refined search');
      await fetchRecentRuns();
    }
  };

  const handleCancelSearch = async () => {
    if (!activeJobRun || activeJobRun.id === 'starting') return;
    if (!confirm('Are you sure you want to cancel the active discovery search?')) return;

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/jobs/${activeJobRun.id}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to cancel search');
      }
      setPollingJobId(null);
      setActiveJobRun(null);
      setEnrichProgress(null);
      await fetchRecentRuns();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error canceling search');
    } finally {
      setIsCancelling(false);
    }
  };
  
  const handleBulkDiscardSkip = async () => {
    const skipCandidates = candidates.filter(
      (c) => (c.status === 'NEW' || c.status === 'REVIEWED') && c.triagePriority === 'SKIP'
    );
    if (skipCandidates.length === 0) return;

    if (!confirm(`Are you sure you want to discard all ${skipCandidates.length} low-priority (SKIP) candidates?`)) {
      return;
    }

    try {
      setLoading(true);
      await Promise.all(
        skipCandidates.map((c) =>
          fetch('/api/candidates', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: c.id, status: 'DISCARDED' }),
          })
        )
      );
      await fetchData();
    } catch (err: unknown) {
      alert('Failed to discard some candidates.');
    } finally {
      setLoading(false);
    }
  };

  const priorityMap: Record<string, number> = {
    HIGH: 1,
    MEDIUM: 2,
    UNASSESSED: 3,
    SKIP: 4,
  };

  const filteredCandidates = candidates
    .filter((c) => {
      if (activeTab === 'pending') return c.status === 'NEW' || c.status === 'REVIEWED';
      if (activeTab === 'promoted') return c.status === 'PROMOTED';
      return c.status === 'DISCARDED';
    })
    .sort((a, b) => {
      const orderA = priorityMap[a.triagePriority || 'UNASSESSED'] ?? 3;
      const orderB = priorityMap[b.triagePriority || 'UNASSESSED'] ?? 3;
      return orderA - orderB;
    });

  if (loading && !scope) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !scope) {
    return (
      <div className="bg-destructive/10 text-destructive p-6 rounded-2xl border border-destructive/20 max-w-xl mx-auto mt-10">
        <h3 className="font-bold text-lg">Error loading campaign</h3>
        <p className="mt-1 text-sm">{error || 'Campaign not found.'}</p>
        <Link href="/scopes" className="mt-4 inline-block font-semibold text-sm underline">
          &larr; Back to Campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in relative text-left">
      {/* Back and Breadcrumbs */}
      <div className="space-y-1.5 text-left">
        <Link
          href="/scopes"
          className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 transition w-fit py-2.5 pr-4 -my-2.5 -ml-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaigns
        </Link>
      </div>

      {/* Campaign Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-card-foreground tracking-tight capitalize">{scope.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure and qualify leads within this campaign segment.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setRefineForm({
                niche: scope.industryFilter || '',
                location: scope.geographyFilter || '',
                limit: 1,
              });
              setIsRefineModalOpen(true);
            }}
            disabled={!!activeJobRun}
          >
            Find More Leads
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="outline"
          >
            + Add Candidate Manually
          </Button>
        </div>
      </div>

      {/* Enrichment Progress Card */}
      {activeJobRun && (
        <div className="bg-card p-6 rounded-2xl border border-primary/20 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-card-foreground">
                {enrichProgress?.totalItems
                  ? `Enriching ${enrichProgress.itemsProcessed} of ${enrichProgress.totalItems} candidates`
                  : `Scanning for "${activeJobRun.niche}" in "${activeJobRun.location}"`}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate leading-relaxed">
                {enrichProgress?.currentStage || `Discovering businesses from Google Maps...`}
              </p>
            </div>
            {enrichProgress && enrichProgress.totalItems > 0 && (
              <span className="text-xs font-bold text-muted-foreground shrink-0">
                {Math.round((enrichProgress.itemsProcessed / enrichProgress.totalItems) * 100)}%
              </span>
            )}
          </div>

          {enrichProgress && enrichProgress.totalItems > 0 && (
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{
                  width: `${(enrichProgress.itemsProcessed / enrichProgress.totalItems) * 100}%`,
                }}
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-border/40">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Candidates appear as they are discovered. Priority badges populate as enrichment completes.
            </p>
            {activeJobRun.id !== 'starting' && (
              <Button
                onClick={handleCancelSearch}
                variant="outline"
                size="sm"
                disabled={isCancelling}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20 shrink-0 w-fit"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Search'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Campaign Specifications Panel (Collapsible Row) */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4 transition-all duration-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-card-foreground">Campaign Specifications</span>
            <span className="text-xs text-muted-foreground font-bold uppercase">•</span>
            <span className="text-xs text-muted-foreground font-bold capitalize">
              {scope.industryFilter || 'All Industries'} &middot; {scope.geographyFilter || 'All Locations'}
            </span>
          </div>
          <Button
            onClick={() => setIsSpecsExpanded(!isSpecsExpanded)}
            variant="link"
            size="sm"
          >
            {isSpecsExpanded ? 'Collapse Details' : 'Show Full Details'}
          </Button>
        </div>

        {isSpecsExpanded ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-border animate-fade-in">
            <div className="space-y-1">
              <span className="block text-xs font-bold text-card-foreground">Description</span>
              <span className="text-sm text-foreground font-semibold block leading-relaxed">
                {scope.description || 'No description provided.'}
              </span>
            </div>
            {scope.industryFilter && (
              <div className="space-y-1">
                <span className="block text-xs font-bold text-card-foreground">Target Industry</span>
                <span className="text-sm text-foreground font-semibold block">{scope.industryFilter}</span>
              </div>
            )}
            {scope.geographyFilter && (
              <div className="space-y-1">
                <span className="block text-xs font-bold text-card-foreground">Geography</span>
                <span className="text-sm text-foreground font-semibold block">{scope.geographyFilter}</span>
              </div>
            )}
            {scope.companySizeFilter && (
              <div className="space-y-1">
                <span className="block text-xs font-bold text-card-foreground">Company Size</span>
                <span className="text-sm text-foreground font-semibold block">{scope.companySizeFilter}</span>
              </div>
            )}
            {scope.notes && (
              <div className="md:col-span-4 pt-3 border-t border-border space-y-1">
                <span className="block text-xs font-bold text-card-foreground">Campaign Notes</span>
                <p className="text-sm text-muted-foreground bg-muted p-4 rounded-xl leading-relaxed whitespace-pre-wrap font-semibold">
                  {scope.notes}
                </p>
              </div>
            )}
          </div>
        ) : (
          scope.description && (
            <p className="text-sm text-muted-foreground font-medium truncate pt-3 border-t border-border/60">
              {scope.description}
            </p>
          )
        )}
      </div>

      {/* Main Candidate list */}
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['pending', 'promoted', 'discarded'] as const).map((tab) => (
            <Button
              key={tab}
              onClick={() => setActiveTab(tab)}
              variant="ghost"
              className={`pb-4 px-6 font-semibold text-sm border-b-2 transition-all duration-200 rounded-none ${
                activeTab === tab
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'pending' ? 'Pending Review' : tab === 'promoted' ? 'Promoted' : 'Discarded'} ({candidates.filter((c) => {
                if (tab === 'pending') return c.status === 'NEW' || c.status === 'REVIEWED';
                if (tab === 'promoted') return c.status === 'PROMOTED';
                return c.status === 'DISCARDED';
              }).length})
            </Button>
          ))}
        </div>

        {/* List display */}
        <div className="space-y-4">
          {filteredCandidates.length === 0 ? (
            candidates.length === 0 ? (
              /* True Empty State - 0 prospects overall */
              <div className="bg-card border border-border/80 rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-6 shadow-sm my-4 animate-fade-in">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto">
                  <Search className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-card-foreground">No prospects found in this campaign yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Run an automated Google Maps scan with this campaign's specifications to crawl local businesses and populate your candidate list.
                  </p>
                </div>
                <div className="flex justify-center items-center gap-3 pt-2">
                  <Button
                    onClick={() => {
                      setRefineForm({
                        niche: scope.industryFilter || '',
                        location: scope.geographyFilter || '',
                        limit: 20,
                      });
                      setIsRefineModalOpen(true);
                    }}
                  >
                    Find Leads
                  </Button>
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    variant="outline"
                  >
                    Add Manually
                  </Button>
                </div>
              </div>
            ) : (
              /* Tab Empty State - some prospects exist but none in activeTab */
              <div className="bg-card border border-border/80 rounded-2xl p-10 text-center max-w-xl mx-auto space-y-4 shadow-sm my-4 animate-fade-in">
                <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-muted-foreground mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-card-foreground capitalize">No prospects in {activeTab}</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    There are no prospects qualified under the "{activeTab}" filter for this campaign.
                  </p>
                </div>
                {activeTab !== 'pending' && (
                  <Button onClick={() => setActiveTab('pending')} variant="link" size="sm">
                    View Pending Review
                  </Button>
                )}
              </div>
            )
          ) : (
            <>
              {activeTab === 'pending' && candidates.some(c => (c.status === 'NEW' || c.status === 'REVIEWED') && c.triagePriority === 'SKIP') && (
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-muted border border-border/60 p-4 rounded-2xl shadow-sm mb-4 text-left">
                  <div className="text-xs text-muted-foreground font-semibold leading-relaxed">
                    Sorted by priority: outdated or offline websites are pushed to the top; modern sites are greyed out at the bottom.
                  </div>
                  <Button
                    onClick={handleBulkDiscardSkip}
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Discard all low-priority (SKIP) candidates
                  </Button>
                </div>
              )}
              {filteredCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className={`bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between md:items-start gap-6 transition-all duration-200 border-l-4 ${
                    candidate.triagePriority === 'HIGH' ? 'border-l-destructive shadow-sm' :
                    candidate.triagePriority === 'MEDIUM' ? 'border-l-chart-3' :
                    candidate.triagePriority === 'SKIP' ? 'opacity-65 bg-muted/30 border-l-muted' :
                    'border-l-blue-400/50'
                  }`}
                >
                  <div className="space-y-3 flex-1 min-w-0">                    <div className="flex flex-wrap items-center gap-2">
                      {candidate.status === 'PROMOTED' && candidate.promotedLeadId ? (
                        <Link href={`/leads/${candidate.promotedLeadId}`} className="hover:underline group block">
                          <h4 className="font-extrabold text-primary text-lg leading-snug mr-1 group-hover:text-primary/80 transition-colors">
                            {candidate.rawName}
                          </h4>
                        </Link>
                      ) : (
                        <h4 className="font-extrabold text-card-foreground text-lg leading-snug mr-1">
                          {candidate.rawName}
                        </h4>
                      )}
                      
                      {/* Priority Tag */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
                        candidate.triagePriority === 'HIGH' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                        candidate.triagePriority === 'MEDIUM' ? 'bg-chart-3/15 text-chart-3 border-chart-3/30' :
                        candidate.triagePriority === 'SKIP' ? 'bg-muted text-muted-foreground border-border' :
                        'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      }`}>
                        {candidate.triagePriority === 'HIGH' && <ShieldAlert className="w-3 h-3 shrink-0" />}
                        {candidate.triagePriority === 'MEDIUM' && <AlertTriangle className="w-3 h-3 shrink-0" />}
                        {candidate.triagePriority === 'UNASSESSED' && <Clock className="w-3 h-3 shrink-0 animate-pulse text-blue-500" />}
                        {candidate.triagePriority === 'UNASSESSED' ? 'Pending Triage' : `${candidate.triagePriority} Priority`}
                      </span>

                      {/* Location Tag */}
                      {candidate.rawLocation && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-muted text-muted-foreground border border-border/30">
                          {candidate.rawLocation}
                        </span>
                      )}

                      {/* Industry Tag parsed from notes */}
                      {candidate.notes && candidate.notes.startsWith('Industry: ') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                          {candidate.notes.replace('Industry: ', '')}
                        </span>
                      )}
                    </div>
                    
                    {candidate.rawWebsiteUrl && (
                      <a
                        href={candidate.rawWebsiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline text-sm font-semibold flex items-center gap-1.5 w-fit"
                      >
                        <ExternalLink className="w-4 h-4 shrink-0" />
                        <span className="truncate max-w-[220px] sm:max-w-md md:max-w-lg block">
                          {candidate.rawWebsiteUrl}
                        </span>
                      </a>
                    )}

                    {candidate.triageReason && (
                      <p className="text-xs font-semibold text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/50 leading-relaxed text-left w-fit max-w-full">
                        <span className="font-bold text-foreground">Triage:</span> {candidate.triageReason}
                      </p>
                    )}

                    {candidate.rawContactInfo && (
                      <div className="text-xs font-semibold text-muted-foreground">
                        <span className="font-bold text-foreground">Contact:</span> {candidate.rawContactInfo}
                      </div>
                    )}

                    {candidate.notes && !candidate.notes.startsWith('Industry: ') && (
                      <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border whitespace-pre-wrap leading-relaxed">
                        <span className="font-bold text-foreground">Notes:</span> {candidate.notes}
                      </p>
                    )}
                  </div>

                  {/* Right hand Actions */}
                  <div className="flex md:flex-col gap-2 shrink-0 md:items-stretch justify-end md:min-w-[130px]">
                    {candidate.status !== 'PROMOTED' && candidate.status !== 'DISCARDED' && (
                      <>
                        <Button
                          onClick={() => handleUpdateStatus(candidate.id, 'PROMOTED')}
                          size="sm"
                          className="w-full justify-center font-bold"
                        >
                          Promote to Lead
                        </Button>
                        <Button
                          onClick={() => handleUpdateStatus(candidate.id, 'DISCARDED')}
                          variant="outline"
                          size="sm"
                          className="w-full justify-center font-bold"
                        >
                          Discard
                        </Button>
                      </>
                    )}
                    {candidate.status === 'PROMOTED' && candidate.promotedLeadId && (
                      <Link
                        href={`/leads/${candidate.promotedLeadId}`}
                        className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-chart-2/20 text-chart-2 border border-chart-2/30 hover:bg-chart-2/30 hover:text-chart-2/95 transition-colors text-center"
                      >
                        Research Lead &rarr;
                      </Link>
                    )}

                    {candidate.status === 'DISCARDED' && (
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
                        Discarded
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Collapsible Recent Crawls Section */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4 transition-all duration-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-card-foreground">Campaign Discovery History</span>
            <span className="text-xs text-muted-foreground font-bold uppercase">•</span>
            <span className="text-xs text-muted-foreground font-bold">
              {recentRuns.length} recent runs
            </span>
          </div>
          <Button
            onClick={() => setIsRecentRunsExpanded(!isRecentRunsExpanded)}
            variant="link"
            size="sm"
          >
            {isRecentRunsExpanded ? 'Hide History' : 'Show History'}
          </Button>
        </div>

        {isRecentRunsExpanded && (
          <div className="pt-4 border-t border-border animate-fade-in">
            {recentRuns.length === 0 ? (
              <p className="text-xs text-muted-foreground font-medium py-2">No recent discovery runs have been triggered for this campaign.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground font-bold uppercase text-xs tracking-wider border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Keyword/Niche</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground font-medium">
                    {recentRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-muted/50 transition">
                        <td className="px-4 py-3 font-bold text-card-foreground">{run.niche}</td>
                        <td className="px-4 py-3">{run.location}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            run.status === 'COMPLETED' ? 'bg-chart-2/10 text-chart-2 border border-chart-2/20' :
                            run.status === 'FAILED' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                            run.status === 'RUNNING' || run.status === 'QUEUED' ? 'bg-chart-5/10 text-chart-5 border border-chart-5/20 animate-pulse' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatUTC(run.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Candidate Intake Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <h3 className="font-extrabold text-card-foreground text-lg">Add Prospect Candidate</h3>
              <Button
                onClick={() => setIsModalOpen(false)}
                variant="ghost"
                size="icon-xs"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleAddCandidate} className="space-y-4">
              {modalError && (
                <div className="bg-destructive/10 text-destructive p-3.5 rounded-xl text-xs font-semibold border border-destructive/20">
                  {modalError}
                </div>
              )}

              <div>
                <Label className="mb-1.5 block">Business Name *</Label>
                <Input
                  required
                  type="text"
                  placeholder="e.g. Austin Smiles Dentistry"
                  value={newCandidate.rawName}
                  onChange={(e) => setNewCandidate({ ...newCandidate, rawName: e.target.value })}
                />
              </div>

              <div>
                <Label className="mb-1.5 block">Website URL</Label>
                <Input
                  type="url"
                  placeholder="e.g. https://austinsmiles.com"
                  value={newCandidate.rawWebsiteUrl}
                  onChange={(e) => setNewCandidate({ ...newCandidate, rawWebsiteUrl: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Location</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Austin, TX"
                    value={newCandidate.rawLocation}
                    onChange={(e) => setNewCandidate({ ...newCandidate, rawLocation: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Contact Info</Label>
                  <Input
                    type="text"
                    placeholder="e.g. hello@website.com"
                    value={newCandidate.rawContactInfo}
                    onChange={(e) => setNewCandidate({ ...newCandidate, rawContactInfo: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block">Internal Prospect Notes</Label>
                <Textarea
                  placeholder="e.g. Website has poor SEO; no live chat system implemented..."
                  rows={3}
                  value={newCandidate.notes}
                  onChange={(e) => setNewCandidate({ ...newCandidate, notes: e.target.value })}
                />
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-3">
                <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline">
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingCandidate}>
                  {submittingCandidate ? 'Saving...' : 'Add Candidate'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refine Search / Find More Leads Modal (Credit Protection) */}
      {isRefineModalOpen && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <h3 className="font-extrabold text-card-foreground text-lg">Find More Leads</h3>
              <Button
                onClick={() => setIsRefineModalOpen(false)}
                variant="ghost"
                size="icon-xs"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="bg-chart-5/10 border border-chart-5/20 text-chart-5 p-4 rounded-xl text-xs font-semibold leading-relaxed flex gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-1">Credit Allocation Warning</span>
                Apify restarts from scratch on every run. To avoid paying for duplicate results, refine your search criteria by entering a specific Zip code, suburb, or a keyword variation.
              </div>
            </div>

            <form onSubmit={handleRefineSearchSubmit} className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Niche / Keyword</Label>
                <Input
                  required
                  type="text"
                  placeholder="e.g. Roofers, Dentists"
                  value={refineForm.niche}
                  onChange={(e) => setRefineForm({ ...refineForm, niche: e.target.value })}
                />
              </div>

              <div>
                <Label className="mb-1.5 block">Refined Location (City, Zip Code, Suburb)</Label>
                <Input
                  required
                  type="text"
                  placeholder="e.g. Austin TX 78701, Plano"
                  value={refineForm.location}
                  onChange={(e) => setRefineForm({ ...refineForm, location: e.target.value })}
                />
              </div>

              <div>
                <Label className="mb-1.5 block">Limit</Label>
                <select
                  value={refineForm.limit}
                  onChange={(e) => setRefineForm({ ...refineForm, limit: Number(e.target.value) })}
                  className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value={1}>1 Lead</option>
                  <option value={5}>5 Leads</option>
                  <option value={10}>10 Leads</option>
                  <option value={20}>20 Leads</option>
                  <option value={30}>30 Leads</option>
                  <option value={50}>50 Leads</option>
                </select>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-3">
                <Button type="button" onClick={() => setIsRefineModalOpen(false)} variant="outline">
                  Cancel
                </Button>
                <Button type="submit">
                  Start Scan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
