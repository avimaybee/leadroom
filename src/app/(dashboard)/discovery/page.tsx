'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatUTC } from '@/lib/date';

type SearchPhase = 'idle' | 'starting' | 'waiting' | 'results' | 'error';

interface Scope {
  id: string;
  name: string;
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

export default function DiscoveryPage() {
  const router = useRouter();
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(20);

  const [scopes, setScopes] = useState<Scope[]>([]);
  const [selectedScopeId, setSelectedScopeId] = useState<string>('');
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [phase, setPhase] = useState<SearchPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  // Fetch recent jobs
  const fetchRecentRuns = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/discovery/recent');
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.success && Array.isArray(data.data)) {
          setRecentRuns(data.data);
        }
      }
    } catch (e) {
      console.error('Failed to load recent discovery runs:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Fetch scopes and history on mount
  useEffect(() => {
    fetch('/api/scopes')
      .then((res) => res.json())
      .then((data: any) => {
        if (data.success && Array.isArray(data.data)) {
          setScopes(data.data);
          
          // Pre-fill from query parameters safely on the client
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const scopeIdParam = params.get('scopeId');
            const nicheParam = params.get('niche');
            const locationParam = params.get('location');

            if (scopeIdParam) {
              setSelectedScopeId(scopeIdParam);
            } else if (data.data.length > 0) {
              setSelectedScopeId(data.data[0].id);
            }

            if (nicheParam) setNiche(nicheParam);
            if (locationParam) setLocation(locationParam);
          } else if (data.data.length > 0) {
            setSelectedScopeId(data.data[0].id);
          }
        }
      })
      .catch((err) => console.error('Failed to load scopes:', err));

    fetchRecentRuns();
  }, [fetchRecentRuns]);

  // Polling loop — checks job status updated by background workflow/simulation
  const checkJobStatus = useCallback(
    async (jobId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error('Failed to verify search progress');

        const raw = await res.json() as { status: string; errorSummary?: string };

        if (raw.status === 'COMPLETED') {
          setPhase('results');
          setPollingJobId(null);
          fetchRecentRuns();
          router.refresh();
          return true; // done
        } else if (raw.status === 'FAILED') {
          setError(raw.errorSummary || 'Discovery search failed. Check your Apify token and try again.');
          setPhase('error');
          setPollingJobId(null);
          fetchRecentRuns();
          return true; // done
        }
        return false; // still running
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Polling failed.';
        setError(msg);
        setPhase('error');
        setPollingJobId(null);
        fetchRecentRuns();
        return true; // stop polling
      }
    },
    [router, fetchRecentRuns],
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche || !location) return;

    setPhase('starting');
    setError(null);

    try {
      const res = await fetch('/api/discovery/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          location,
          limit,
          scopeId: selectedScopeId || null
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || 'Failed to start search');
      }

      const data = (await res.json()) as { jobId: string };
      setPollingJobId(data.jobId);
      setPhase('waiting');
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'An error occurred while searching.';
      setError(errMsg);
      setPhase('error');
    }
  };

  const isSearching = phase === 'starting' || phase === 'waiting';

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-950 tracking-tight">Discovery Engine</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Search Google Maps via Apify to discover local business leads. Results are saved automatically.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Niche / Keyword</label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. Plumbers, Dentists"
              required
              disabled={isSearching}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium transition disabled:opacity-50"
            />
          </div>
          
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">City &amp; State</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Abilene, Texas"
              required
              disabled={isSearching}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium transition disabled:opacity-50"
            />
          </div>

          <div className="flex-1 w-full">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Target Scope</label>
              <Link href="/scopes/new" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                + Create Scope
              </Link>
            </div>
            <select
              value={selectedScopeId}
              onChange={(e) => setSelectedScopeId(e.target.value)}
              disabled={isSearching}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium transition disabled:opacity-50"
            >
              <option value="">None (General Discovery)</option>
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-32">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={isSearching}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium transition disabled:opacity-50"
            >
              <option value={10}>10 Leads</option>
              <option value={20}>20 Leads</option>
              <option value={30}>30 Leads</option>
              <option value={50}>50 Leads</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isSearching ? 'Searching...' : 'Run Discovery'}
          </button>
        </form>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}
      </div>

      {phase === 'starting' && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/85 shadow-sm text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700">Starting Apify Actor...</p>
            <p className="text-xs text-slate-500">Initiating Google Maps crawler run. This typically takes 15–30 seconds.</p>
          </div>
        </div>
      )}

      {phase === 'waiting' && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/85 shadow-sm text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700">Apify is crawling Google Maps…</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Crawling Google Maps (typically 1–3 minutes). You can navigate away safely; results are saved to your selected scope automatically.
            </p>
          </div>
        </div>
      )}

      {phase === 'results' && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-5 animate-fade-in max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Discovery Search Completed</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              The Google Maps search has finished crawling. Discovered business prospects have been saved automatically as candidate leads in your target scope.
            </p>
          </div>
          <div className="flex justify-center items-center gap-3 pt-3">
            <Link
              href={selectedScopeId ? `/scopes/${selectedScopeId}` : '/scopes'}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-sm hover:scale-[1.01]"
            >
              Review Candidates &rarr;
            </Link>
            <button
              onClick={() => setPhase('idle')}
              className="border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 font-bold px-5 py-2.5 rounded-xl text-sm transition"
            >
              Run Another Search
            </button>
          </div>
        </div>
      )}

      {phase !== 'starting' && phase !== 'waiting' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          {/* Left Column (Recent Runs) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Recent Discovery Runs</h3>
            {isLoadingHistory ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 font-medium">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500 mx-auto mb-2" />
                Loading history...
              </div>
            ) : recentRuns.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-xl mx-auto space-y-4 shadow-sm animate-fade-in">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 mx-auto">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-900">No Recent Discovery Runs Found</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    You haven't run any discovery searches yet. Fill out the target niche and location in the engine form above to scan for local business prospects.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Niche</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {recentRuns.map((run) => {
                        const targetScope = scopes.find((s) => s.id === run.scopeId);
                        const scopeName = targetScope ? targetScope.name : 'General';
                        
                        return (
                          <tr key={run.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-4 py-3 font-bold text-slate-900">{run.niche}</td>
                            <td className="px-4 py-3">{run.location}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                run.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                run.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                run.status === 'RUNNING' || run.status === 'QUEUED' ? 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {run.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {formatUTC(run.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-right space-x-3">
                              <button
                                onClick={() => {
                                  setNiche(run.niche);
                                  setLocation(run.location);
                                  if (run.scopeId) {
                                    setSelectedScopeId(run.scopeId);
                                  }
                                }}
                                className="text-indigo-600 hover:text-indigo-700 hover:underline text-xs font-bold transition"
                              >
                                Reuse
                              </button>
                              {run.status === 'COMPLETED' && (
                                <Link
                                  href={run.scopeId ? `/scopes/${run.scopeId}` : '/scopes'}
                                  className="text-slate-500 hover:text-slate-900 hover:underline text-xs font-bold transition inline-flex items-center gap-0.5"
                                >
                                  View Scope &rarr;
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column (Guidelines) */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Discovery Guidelines</h3>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 text-xs leading-relaxed text-slate-600 font-medium">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800">Latency Expectation</h4>
                <p>Discovery crawls Google Maps via Apify actors. A search typically takes 1 to 4 minutes depending on limits. You can safely browse other pages while the task runs.</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800">Cost & Credit Overhead</h4>
                <p>Every discovery run consumes API scraping credits. Keep limits focused (e.g. 10–20 leads) to optimize credit allocation and minimize processing time.</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800">Human in the Loop</h4>
                <p>Discovered prospects are saved strictly as candidate leads. No automated email outreach or pipeline changes will occur without explicit operator approval.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
