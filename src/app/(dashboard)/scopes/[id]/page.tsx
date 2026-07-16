'use client';

import { useState, useEffect, useCallback, use, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ExternalLink, Search, FileText, Trash2, X, AlertTriangle, Clock, ShieldAlert, Settings, Info, Edit } from 'lucide-react';
import { formatUTC } from '@/lib/date';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNotifications } from '@/components/NotificationProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [scope, setScope] = useState<Scope | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab control: 'pending' (Review), 'promoted', 'discarded', 'history' (Run History) synced to URL
  const rawTab = searchParams.get('tab');
  const activeTab = (rawTab === 'promoted' || rawTab === 'discarded' || rawTab === 'pending' || rawTab === 'history') ? rawTab : 'pending';
  
  const setActiveTab = useCallback((tab: 'pending' | 'promoted' | 'discarded' | 'history') => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', tab);
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);
  
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
  const [isCancelling, setIsCancelling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Settings sheet states
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [newScopeName, setNewScopeName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  // Custom Alert Dialog for Bulk Discard
  const [isBulkDiscardOpen, setIsBulkDiscardOpen] = useState(false);
  const [discardProgress, setDiscardProgress] = useState(false);

  // Enrichment progress (from discovery jobs)
  const [enrichProgress, setEnrichProgress] = useState<{
    totalItems: number;
    itemsProcessed: number;
    currentStage: string;
  } | null>(null);

  // Current logged in user ID
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

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

  const fetchData = useCallback(async () => {
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
      setNewScopeName(scopeData.data.name);
      setCandidates(candidatesData.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while fetching data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const { recentJobUpdates } = useNotifications();

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
  }, [id, fetchRecentRuns, fetchData]);

  const prevPollingJobId = useRef<string | null>(null);

  useEffect(() => {
    if (prevPollingJobId.current && !pollingJobId) {
      fetchData();
    }
    prevPollingJobId.current = pollingJobId;
  }, [pollingJobId, fetchData]);

  useEffect(() => {
    if (!pollingJobId) return;

    intervalRef.current = setInterval(() => {
      fetchRecentRuns();
    }, 10000);

    const status = recentJobUpdates[pollingJobId];
    if (status === 'SUCCESS' || status === 'ERROR') {
      setPollingJobId(null);
      setEnrichProgress(null);
      fetchRecentRuns();
      fetchData();
    }

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pollingJobId, recentJobUpdates, fetchRecentRuns, fetchData]);

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

  const handleRename = async (overrideName?: string) => {
    const nameToUse = (overrideName !== undefined ? overrideName : newScopeName).trim();
    if (!nameToUse || !scope) return;
    setIsRenaming(true);
    try {
      const res = await fetch('/api/scopes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scope.id, name: nameToUse }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        throw new Error(errData.error || 'Failed to rename campaign');
      }
      setScope(prev => prev ? { ...prev, name: nameToUse } : prev);
      setNewScopeName(nameToUse);
      setIsSettingsSheetOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error renaming campaign';
      alert(msg);
      setNewScopeName(scope.name);
      alert(msg);
    } finally {
      setIsRenaming(false);
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

    setDiscardProgress(true);
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
      setIsBulkDiscardOpen(false);
      await fetchData();
    } catch (err: unknown) {
      alert('Failed to discard some candidates.');
    } finally {
      setLoading(false);
      setDiscardProgress(false);
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
      // Sort by triage priority first (HIGH > MEDIUM > UNASSESSED > SKIP)
      const orderA = priorityMap[a.triagePriority || 'UNASSESSED'] ?? 3;
      const orderB = priorityMap[b.triagePriority || 'UNASSESSED'] ?? 3;
      if (orderA !== orderB) return orderA - orderB;
      // Then by most recently created
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
      <div className="bg-destructive/10 text-destructive p-6 rounded-2xl border border-destructive/20 max-w-xl mx-auto mt-10 text-left">
        <h3 className="text-heading-lg">Error loading campaign</h3>
        <p className="mt-1 text-copy-14">{error || 'Campaign not found.'}</p>
        <Link href="/scopes" className="mt-4 inline-block text-label-14 underline">
          &larr; Back to Campaigns
        </Link>
      </div>
    );
  }

  const specSummaryParts = [];
  if (scope.industryFilter) specSummaryParts.push(`Industry: ${scope.industryFilter}`);
  if (scope.geographyFilter) specSummaryParts.push(`Location: ${scope.geographyFilter}`);
  specSummaryParts.push(`Total Prospects: ${candidates.length}`);
  const specsHeaderSummary = specSummaryParts.join(' \u2022 ');

  return (
    <div className="space-y-6 animate-fade-in relative text-left">
      {/* Standard Identity/Breadcrumb Header */}
      <header className="space-y-4 border-b border-border/70 pb-6">
        <nav className="flex items-center gap-2 text-label-14 text-muted-foreground">
          <Link href="/scopes" className="hover:text-foreground transition-colors">Campaigns</Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="font-medium text-foreground">{scope.name}</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <Input
                autoFocus
                value={newScopeName}
                onChange={(e) => setNewScopeName(e.target.value)}
                onBlur={async () => {
                  setIsEditingName(false);
                  if (newScopeName.trim() && newScopeName.trim() !== scope.name) {
                    await handleRename(newScopeName);
                  }
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    setIsEditingName(false);
                    if (newScopeName.trim() && newScopeName.trim() !== scope.name) {
                      await handleRename(newScopeName);
                    }
                  } else if (e.key === 'Escape') {
                    setNewScopeName(scope.name);
                    setIsEditingName(false);
                  }
                }}
                className="text-heading-3xl font-bold bg-transparent border-b border-dashed border-border focus:border-primary focus:ring-0 outline-none w-full max-w-xl p-0 h-auto rounded-none capitalize"
              />
            ) : (
              <h1 
                onClick={() => setIsEditingName(true)}
                className="text-heading-3xl text-card-foreground capitalize font-bold cursor-pointer hover:text-primary/80 transition-colors flex items-center gap-2 group w-fit"
                title="Click to rename"
              >
                {scope.name}
                <Edit className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
              </h1>
            )}
            <p className="text-copy-14 text-muted-foreground mt-1.5 leading-relaxed">
              {specsHeaderSummary}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 lg:mt-1">
            {activeJobRun ? (
              <Button
                onClick={handleCancelSearch}
                variant="destructive"
                disabled={isCancelling}
                className="font-semibold text-label-12"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Running Scan'}
              </Button>
            ) : (
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
                Find More Leads
              </Button>
            )}
            
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="outline"
            >
              Add Candidate
            </Button>

            {/* Campaign Specifications settings sheet trigger */}
            <Sheet open={isSettingsSheetOpen} onOpenChange={setIsSettingsSheetOpen}>
              <SheetTrigger
                render={
                  <Button variant="outline" size="icon" title="Campaign Settings" aria-label="Campaign Settings">
                    <Settings className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </Button>
                }
              />
              <SheetContent className="space-y-0 overflow-hidden">
                <SheetHeader>
                  <SheetTitle className="text-heading-lg">Campaign Settings</SheetTitle>
                  <SheetDescription className="text-copy-14">
                    Configure specifications and metadata for outreach discovery.
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-3 border-t border-border/50 pt-3 text-label-12">

                  {/* Specifications (Read-Only context details) */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <h4 className="text-label-12 uppercase text-muted-foreground">Campaign Specifications</h4>
                    
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <div>
                        <span className="block text-label-12 text-muted-foreground">Industry</span>
                        <span className="text-copy-14 text-foreground">{scope.industryFilter || 'All'}</span>
                      </div>
                      <div>
                        <span className="block text-label-12 text-muted-foreground">Geography</span>
                        <span className="text-copy-14 text-foreground">{scope.geographyFilter || 'All'}</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-label-12 text-muted-foreground">Description</span>
                      <p className="text-copy-13 text-foreground bg-muted/40 p-2 rounded-md leading-relaxed">
                        {scope.description || 'No description provided.'}
                      </p>
                    </div>

                    {scope.notes && (
                      <div>
                        <span className="block text-label-12 text-muted-foreground">Internal Notes</span>
                        <p className="text-copy-13 text-foreground bg-muted/40 p-2 rounded-md whitespace-pre-wrap leading-relaxed">
                          {scope.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <SheetFooter>
                  <SheetClose
                    render={
                      <Button variant="outline" className="w-full">Close Panel</Button>
                    }
                  />
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Enrichment Progress Card when scan is active */}
      {activeJobRun && (
        <div className="bg-card p-5 rounded-md border border-primary/20 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center text-primary shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-label-14 font-semibold text-card-foreground">
                {enrichProgress?.totalItems
                  ? `Enriching ${enrichProgress.itemsProcessed} of ${enrichProgress.totalItems} candidates`
                  : `Scanning for "${activeJobRun.niche}" in "${activeJobRun.location}"`}
              </h3>
              <p className="text-label-12 text-muted-foreground mt-0.5 truncate leading-relaxed">
                {enrichProgress?.currentStage || `Discovering businesses from Google Maps...`}
              </p>
            </div>
            {enrichProgress && enrichProgress.totalItems > 0 && (
              <span className="text-label-12 font-semibold text-muted-foreground shrink-0">
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
        </div>
      )}

      {/* Sub-workspace navigation: linked tabs synced to URL */}
      <div className="space-y-6">
        <div className="flex border-b border-border">
          {([
            { key: 'pending', label: 'Pending Review' },
            { key: 'promoted', label: 'Promoted' },
            { key: 'discarded', label: 'Discarded' },
            { key: 'history', label: 'Run History' }
          ] as const).map((tab) => {
            let countLabel = '';
            if (tab.key === 'pending') {
              countLabel = ` (${candidates.filter(c => c.status === 'NEW' || c.status === 'REVIEWED').length})`;
            } else if (tab.key === 'promoted') {
              countLabel = ` (${candidates.filter(c => c.status === 'PROMOTED').length})`;
            } else if (tab.key === 'discarded') {
              countLabel = ` (${candidates.filter(c => c.status === 'DISCARDED').length})`;
            } else {
              countLabel = ` (${recentRuns.length})`;
            }

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-4 px-6 font-semibold text-label-14 border-b-2 transition-all duration-200 outline-none cursor-pointer ${
                  activeTab === tab.key
                    ? 'border-b-primary text-primary font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}{countLabel}
              </button>
            );
          })}
        </div>

        {/* Tab Workspace content */}
        <div className="space-y-4">
          {activeTab === 'history' ? (
            /* Run History view */
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              {recentRuns.length === 0 ? (
                  <p className="text-label-12 text-muted-foreground font-semibold py-6 text-center">
                  No recent discovery runs have been triggered for this campaign.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-copy-14">
                    <thead className="bg-muted/50 text-muted-foreground text-label-12 uppercase border-b border-border">
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
                          <td className="px-4 py-3 font-semibold text-card-foreground">{run.niche}</td>
                          <td className="px-4 py-3">{run.location}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold uppercase border ${
                              run.status === 'COMPLETED' ? 'bg-chart-2/10 text-chart-2 border-chart-2/20' :
                              run.status === 'FAILED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                              run.status === 'RUNNING' || run.status === 'QUEUED' ? 'bg-chart-5/10 text-chart-5 border-chart-5/20 animate-pulse' :
                              'bg-muted text-muted-foreground border-border'
                            }`}>
                              {run.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-label-12 text-muted-foreground">
                            {formatUTC(run.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Candidate rows views (pending | promoted | discarded) */
            <>
              {filteredCandidates.length === 0 ? (
                candidates.length === 0 ? (
                  /* True empty state */
                  <div className="bg-card border border-border rounded-xl p-12 text-center max-w-2xl mx-auto space-y-6 my-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-md flex items-center justify-center text-primary mx-auto">
                      <Search className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-heading-lg text-card-foreground">No prospects found in this campaign</h3>
                      <p className="text-copy-14 text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Start an automated scan with this campaign's target niche keywords to scan local maps and crawl candidate prospects.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center items-center gap-2 pt-2">
                      <Button size="sm" onClick={() => { setRefineForm({ niche: scope.industryFilter || '', location: scope.geographyFilter || '', limit: 1 }); setIsRefineModalOpen(true); }}>
                        Scan 1 Lead
                      </Button>
                      <Button size="sm" onClick={() => { setRefineForm({ niche: scope.industryFilter || '', location: scope.geographyFilter || '', limit: 5 }); setIsRefineModalOpen(true); }}>
                        Scan 5 Leads
                      </Button>
                      <Button onClick={() => { setRefineForm({ niche: scope.industryFilter || '', location: scope.geographyFilter || '', limit: 20 }); setIsRefineModalOpen(true); }}>
                        Run Scan
                      </Button>
                      <Button onClick={() => setIsModalOpen(true)} variant="outline">
                        Add Candidate
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Tab empty state */
                  <div className="bg-card border border-border rounded-xl p-10 text-center max-w-xl mx-auto space-y-4 my-4">
                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center text-muted-foreground mx-auto">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-label-14 text-card-foreground capitalize">No prospects in {activeTab}</h3>
                      <p className="text-label-12 text-muted-foreground max-w-xs mx-auto leading-relaxed">
                        There are no qualified candidate prospects categorized under the active "{activeTab}" filter.
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
                  {/* Skip candidates cleanup notice and Action button */}
                  {activeTab === 'pending' && candidates.some(c => (c.status === 'NEW' || c.status === 'REVIEWED') && c.triagePriority === 'SKIP') && (
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-muted border border-border/60 p-4 rounded-xl shadow-sm mb-4">
                      <div className="text-label-12 text-muted-foreground font-semibold leading-relaxed flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-muted-foreground/80 shrink-0" />
                        <span>Low-priority prospects (outdated sites or offline) are pushed to the bottom. Discard them in bulk to clear.</span>
                      </div>
                      <Dialog open={isBulkDiscardOpen} onOpenChange={setIsBulkDiscardOpen}>
                        <Button
                          onClick={() => setIsBulkDiscardOpen(true)}
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20 font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Discard all low-priority (SKIP)
                        </Button>
                        <DialogContent className="sm:max-w-md bg-card border border-border rounded-2xl p-6 space-y-4">
                          <DialogHeader>
                            <DialogTitle className="font-semibold text-foreground">Confirm Bulk Discard</DialogTitle>
                            <DialogDescription className="text-copy-14 leading-relaxed text-muted-foreground pt-1.5">
                              Are you sure you want to discard all candidate prospects marked as "SKIP" priority? This will clear them from your pending review backlog.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" size="sm" onClick={() => setIsBulkDiscardOpen(false)} disabled={discardProgress}>Keep Candidates</Button>
                            <Button variant="destructive" size="sm" onClick={handleBulkDiscardSkip} disabled={discardProgress}>
                              {discardProgress ? 'Discarding...' : 'Discard Candidates'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {/* Candidate list items */}
                  {filteredCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className={`bg-card border border-border rounded-xl p-5 flex flex-col md:flex-row justify-between md:items-start gap-5 transition-all duration-200 ${
                        candidate.triagePriority === 'SKIP' ? 'opacity-60 bg-muted/20' : ''
                      }`}
                    >
                      <div className="space-y-2.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {candidate.status === 'PROMOTED' && candidate.promotedLeadId ? (
                            <Link href={`/leads/${candidate.promotedLeadId}`} className="hover:underline group block">
                              <h4 className="font-semibold text-primary text-heading-lg leading-snug mr-1 group-hover:text-primary/80 transition-colors">
                                {candidate.rawName}
                              </h4>
                            </Link>
                          ) : (
                            <h4 className="font-semibold text-card-foreground text-heading-lg leading-snug mr-1">
                              {candidate.rawName}
                            </h4>
                          )}
                          


                          {/* Location Tag */}
                          {candidate.rawLocation && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold bg-muted text-muted-foreground border border-border/30">
                              {candidate.rawLocation}
                            </span>
                          )}

                          {/* Industry parsed notes */}
                          {candidate.notes && candidate.notes.startsWith('Industry: ') && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold bg-primary/10 text-primary border border-primary/20">
                              {candidate.notes.replace('Industry: ', '')}
                            </span>
                          )}
                        </div>
                        
                        {candidate.rawWebsiteUrl && (
                          <a
                            href={candidate.rawWebsiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline text-label-12 font-semibold flex items-center gap-1.5 w-fit"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[200px] sm:max-w-md md:max-w-lg block">
                              {candidate.rawWebsiteUrl}
                            </span>
                          </a>
                        )}

                        {candidate.triageReason && (
                          <p className="text-label-12 font-semibold text-muted-foreground bg-muted/40 p-2.5 rounded-md leading-relaxed text-left w-fit max-w-full">
                            <span className="font-semibold text-foreground">Triage:</span> {candidate.triageReason}
                          </p>
                        )}

                        {candidate.rawContactInfo && (
                          <div className="text-label-12 font-semibold text-muted-foreground">
                            <span className="font-semibold text-foreground">Contact:</span> {candidate.rawContactInfo}
                          </div>
                        )}

                        {candidate.notes && !candidate.notes.startsWith('Industry: ') && (
                          <p className="text-label-12 text-muted-foreground bg-muted/30 p-3 rounded-md whitespace-pre-wrap leading-relaxed">
                            <span className="font-semibold text-foreground">Notes:</span> {candidate.notes}
                          </p>
                        )}
                      </div>

                      {/* Right hand actions */}
                      <div className="flex md:flex-col gap-2 shrink-0 md:items-stretch justify-end md:min-w-[130px] pt-2 md:pt-0">
                        {candidate.status !== 'PROMOTED' && candidate.status !== 'DISCARDED' && (
                          <>
                            <Button
                              onClick={() => handleUpdateStatus(candidate.id, 'PROMOTED')}
                              size="sm"
                              className="w-full justify-center font-semibold"
                            >
                              Promote to Lead
                            </Button>
                            <Button
                              onClick={() => handleUpdateStatus(candidate.id, 'DISCARDED')}
                              variant="outline"
                              size="sm"
                              className="w-full justify-center font-semibold"
                            >
                              Discard
                            </Button>
                          </>
                        )}
                        {candidate.status === 'PROMOTED' && candidate.promotedLeadId && (
                          <Link
                            href={`/leads/${candidate.promotedLeadId}`}
                            className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-label-12 font-semibold bg-chart-2/10 text-chart-2 border border-chart-2/20 hover:bg-chart-2/15 transition-colors text-center"
                          >
                            Research Lead &rarr;
                          </Link>
                        )}

                        {candidate.status === 'DISCARDED' && (
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-label-12 font-semibold bg-muted text-muted-foreground border border-border">
                            Discarded
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Manual Candidate Intake Modal (Dialog) */}
      {isModalOpen && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-lg bg-card border border-border rounded-2xl p-6 space-y-5">
            <DialogHeader className="border-b border-border pb-3 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="font-semibold text-card-foreground">Add Prospect Candidate</DialogTitle>
                <DialogDescription className="text-copy-14 text-muted-foreground mt-1">
                  Add a candidate prospect to triage for promotion.
                </DialogDescription>
              </div>
            </DialogHeader>

            <form onSubmit={handleAddCandidate} className="space-y-4">
              {modalError && (
                <div className="bg-destructive/10 text-destructive p-3.5 rounded-xl text-label-12 font-semibold border border-destructive/20">
                  {modalError}
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="candidate-name" className="text-label-12 font-semibold">Business Name *</Label>
                <Input
                  required
                  id="candidate-name"
                  type="text"
                  placeholder="e.g. Austin Smiles Dentistry"
                  value={newCandidate.rawName}
                  onChange={(e) => setNewCandidate({ ...newCandidate, rawName: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="candidate-url" className="text-label-12 font-semibold">Website URL</Label>
                <Input
                  id="candidate-url"
                  type="url"
                  placeholder="e.g. https://austinsmiles.com"
                  value={newCandidate.rawWebsiteUrl}
                  onChange={(e) => setNewCandidate({ ...newCandidate, rawWebsiteUrl: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="candidate-loc" className="text-label-12 font-semibold">Location</Label>
                  <Input
                    id="candidate-loc"
                    type="text"
                    placeholder="e.g. Austin, TX"
                    value={newCandidate.rawLocation}
                    onChange={(e) => setNewCandidate({ ...newCandidate, rawLocation: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="candidate-contact" className="text-label-12 font-semibold">Contact Info</Label>
                  <Input
                    id="candidate-contact"
                    type="text"
                    placeholder="e.g. hello@website.com"
                    value={newCandidate.rawContactInfo}
                    onChange={(e) => setNewCandidate({ ...newCandidate, rawContactInfo: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="candidate-notes" className="text-label-12 font-semibold">Internal Prospect Notes</Label>
                <Textarea
                  id="candidate-notes"
                  placeholder="e.g. Website has poor SEO; no live chat system..."
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
          </DialogContent>
        </Dialog>
      )}

      {/* Refine Search / Find More Leads Modal (Credit Protection) */}
      {isRefineModalOpen && (
        <Dialog open={isRefineModalOpen} onOpenChange={setIsRefineModalOpen}>
          <DialogContent className="sm:max-w-lg bg-card border border-border rounded-2xl p-6 space-y-5">
            <DialogHeader className="border-b border-border pb-3 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="font-semibold text-card-foreground">Find More Leads</DialogTitle>
                <DialogDescription className="text-copy-14 text-muted-foreground mt-1">
                  Re-scan Google Maps to discover new prospect candidate businesses.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="bg-chart-5/10 border border-chart-5/20 text-chart-5 p-4 rounded-xl text-label-12 font-semibold leading-relaxed flex gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-chart-5" />
              <div>
                <span className="font-semibold block mb-1">Credit Allocation Warning</span>
                Apify starts crawlers from scratch. To avoid paying for duplicate results, refine your search criteria by zip codes, suburbs, or niche variations.
              </div>
            </div>

            <form onSubmit={handleRefineSearchSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="refine-niche" className="text-label-12 font-semibold">Niche / Keyword</Label>
                <Input
                  required
                  id="refine-niche"
                  type="text"
                  placeholder="e.g. Roofers, Dentists"
                  value={refineForm.niche}
                  onChange={(e) => setRefineForm({ ...refineForm, niche: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="refine-loc" className="text-label-12 font-semibold">Refined Location (Suburbs, Zip Codes)</Label>
                <Input
                  required
                  id="refine-loc"
                  type="text"
                  placeholder="e.g. Austin TX 78701, Plano"
                  value={refineForm.location}
                  onChange={(e) => setRefineForm({ ...refineForm, location: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="refine-limit" className="text-label-12 font-semibold">Limit</Label>
                <select
                  id="refine-limit"
                  value={refineForm.limit}
                  onChange={(e) => setRefineForm({ ...refineForm, limit: Number(e.target.value) })}
                  className="flex h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-copy-14 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground hover:bg-muted/40 cursor-pointer"
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
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
