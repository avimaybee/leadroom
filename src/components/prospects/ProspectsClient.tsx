'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Info, List, LayoutGrid, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { PipelineAnalytics } from '@/components/pipeline/PipelineAnalytics';
import { loadMoreProspectsAction } from '@/app/actions/prospects';

const TIER_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  tier1: { variant: 'default', label: 'T1' },
  tier2: { variant: 'secondary', label: 'T2' },
  tier3: { variant: 'outline', label: 'T3' },
  disqualified: { variant: 'destructive', label: 'DQ' },
};

const TIER_OPTIONS = [
  { value: 'all', label: 'All Tiers' },
  { value: 'tier1', label: 'Tier 1' },
  { value: 'tier2', label: 'Tier 2' },
  { value: 'tier3', label: 'Tier 3' },
  { value: 'disqualified', label: 'Disqualified' },
];

interface ProspectRow {
  id: string;
  name: string;
  company: string | null;
  website: string | null;
  stage: string | null;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  marketId: string | null;
  disqualifiedReason: string | null;
  createdAt: string | null;
}

interface MarketInfo {
  id: string;
  name: string;
}

interface ProspectsClientProps {
  initialProspects: ProspectRow[];
  markets: MarketInfo[];
  activeTier: string;
  activeStage: string;
  activeSearch: string;
  activeMarket: string;
  activeSort: string;
  description: string;
  totalCount: number;
}

function hrefWith(next: Record<string, string>, current: { tier: string; stage: string; search: string; market: string; sort: string; layout: string }) {
  const params = new URLSearchParams();
  const merged = { ...current, ...next };
  if (merged.search) params.set('search', merged.search);
  if (merged.tier && merged.tier !== 'all') params.set('tier', merged.tier);
  if (merged.stage) params.set('stage', merged.stage);
  if (merged.market && merged.market !== 'all') params.set('market', merged.market);
  if (merged.sort && merged.sort !== 'newest') params.set('sort', merged.sort);
  if (merged.layout === 'kanban') params.set('layout', 'kanban');
  const q = params.toString();
  return q ? `/prospects?${q}` : '/prospects';
}

function timeAgo(iso: string | null): string {
  if (!iso) return '-';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '-';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProspectsClient({
  initialProspects,
  markets,
  activeTier,
  activeStage,
  activeSearch,
  activeMarket,
  activeSort,
  description,
  totalCount,
}: ProspectsClientProps) {
  const router = useRouter();
  // Local-only UI state: pagination and layout. Filters + sort live in the URL
  // (server-driven via Links below) — no useEffect URL sync.
  const [rows, setRows] = useState<ProspectRow[]>(initialProspects);
  const [loadingMore, setLoadingMore] = useState(false);
  const [layout, setLayout] = useState<'list' | 'kanban'>('list');

  const current = { tier: activeTier, stage: activeStage, search: activeSearch, market: activeMarket, sort: activeSort, layout: '' };
  const hasMore = totalCount > rows.length;

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await loadMoreProspectsAction(rows.length, {
        tier: activeTier,
        stage: activeStage,
        search: activeSearch,
        market: activeMarket,
        sort: activeSort,
      });
      if (result.success && (result.prospects as ProspectRow[]).length > 0) {
        setRows((prev) => {
          const existing = new Set(prev.map((p) => p.id));
          const fresh = (result.prospects as ProspectRow[]).filter((p) => !existing.has(p.id));
          return [...prev, ...fresh];
        });
      }
    } catch (err) {
      console.error('Failed to load more prospects:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleStageChange = (stage: string) => {
    router.push(hrefWith({ stage }, { ...current, layout: layout === 'kanban' ? 'kanban' : '' }));
  };

  const marketMap = new Map(markets.map((m) => [m.id, m.name]));
  const stages = [...new Set(rows.map((p) => p.stage).filter(Boolean))] as string[];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-border pb-4">
        <div>
          <nav className="flex items-center gap-2 text-copy-14 text-muted-foreground">
            <span className="font-medium text-foreground">Prospects</span>
          </nav>
          <h2 className="text-heading-2xl mt-1">All Prospects</h2>
          <p className="text-copy-14 text-muted-foreground mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setLayout('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label-12 transition-all ${
              layout === 'list'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List View
          </button>
          <button
            type="button"
            onClick={() => setLayout('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label-12 transition-all ${
              layout === 'kanban'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Kanban Board
          </button>
        </div>
      </div>

      {layout === 'kanban' ? (
        <>
          <PipelineAnalytics />
          <PipelineBoard />
        </>
      ) : (
        <>
          {/* Search (server-driven form, no debounce effect) */}
          <form
            action="/prospects"
            method="get"
            className="flex flex-wrap items-center gap-3 mb-4"
          >
            {activeTier !== 'all' && <input type="hidden" name="tier" value={activeTier} />}
            {activeStage && <input type="hidden" name="stage" value={activeStage} />}
            {activeMarket !== 'all' && <input type="hidden" name="market" value={activeMarket} />}
            {activeSort === 'fit' && <input type="hidden" name="sort" value="fit" />}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                placeholder="Search prospects..."
                defaultValue={activeSearch}
                key={activeSearch}
                className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
            {activeSearch && (
              <Link
                href={hrefWith({ search: '' }, current)}
                className="h-10 inline-flex items-center px-3 rounded-md border border-border text-copy-14 hover:bg-muted/50 transition-colors"
              >
                Clear
              </Link>
            )}
          </form>

          {/* Tier pills as Links (legacy LeadsTableClient pattern) */}
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/25 p-1 w-fit mb-4">
            {TIER_OPTIONS.map((opt) => {
              const selected = activeTier === opt.value;
              return (
                <Link
                  key={opt.value}
                  href={hrefWith({ tier: opt.value }, current)}
                  className={`inline-flex min-h-8 items-center justify-center rounded-md px-3.5 text-label-12 font-semibold transition-all ${
                    selected
                      ? 'bg-card text-foreground shadow-sm border border-border/40'
                      : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>

          {/* Sort pills: Newest first (default) vs Top Fit */}
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/25 p-1 w-fit mb-4">
            {[
              { value: 'newest', label: 'Newest First' },
              { value: 'fit', label: 'Top Fit' },
            ].map((opt) => {
              const selected = activeSort === opt.value;
              return (
                <Link
                  key={opt.value}
                  href={hrefWith({ sort: opt.value }, current)}
                  className={`inline-flex min-h-8 items-center justify-center rounded-md px-3.5 text-label-12 font-semibold transition-all ${
                    selected
                      ? 'bg-card text-foreground shadow-sm border border-border/40'
                      : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            {markets.length > 0 && (
              <select
                value={activeMarket}
                onChange={(e) => router.push(hrefWith({ market: e.target.value }, current))}
                className="h-10 px-3 rounded-md border border-border bg-background text-copy-14 focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Filter by group"
              >
                <option value="all">All Groups</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
            <select
              value={activeStage}
              onChange={(e) => handleStageChange(e.target.value)}
              className="h-10 px-3 rounded-md border border-border bg-background text-copy-14 focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Filter by stage"
            >
              <option value="">All Stages</option>
              {stages.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(activeTier !== 'all' || activeStage || activeSearch || activeMarket !== 'all') && (
              <Link
                href="/prospects"
                className="h-10 inline-flex items-center px-3 rounded-md border border-border text-copy-14 hover:bg-muted/50 transition-colors"
              >
                Reset Filters
              </Link>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                <Info className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-heading-lg text-foreground">No prospects found</h3>
              <p className="text-copy-14 text-muted-foreground mt-1 max-w-md mx-auto">
                Try adjusting your search or filters, or find companies via Discovery.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <Link
                  href="/prospects"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
                >
                  Reset Filters
                </Link>
                <Link
                  href="/scopes"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
                >
                  Go to Discovery
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Company</th>
                      <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Market</th>
                      <th className="text-right px-4 py-3 text-label-12 text-muted-foreground">Fit</th>
                      <th className="text-right px-4 py-3 text-label-12 text-muted-foreground">Confidence</th>
                      <th className="text-center px-4 py-3 text-label-12 text-muted-foreground">Tier</th>
                      <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Stage</th>
                      <th className="text-right px-4 py-3 text-label-12 text-muted-foreground">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const tier = TIER_BADGE[p.priorityTier as keyof typeof TIER_BADGE] || TIER_BADGE.tier3;
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-copy-14 font-medium">
                            <Link href={`/prospects/${p.id}`} className="hover:text-primary hover:underline">
                              {p.company || p.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-copy-13 text-muted-foreground">
                            {p.marketId ? (marketMap.get(p.marketId) || 'Unknown') : '-'}
                          </td>
                          <td className={`text-right px-4 py-3 text-label-14 font-semibold ${
                            (p.fitScore ?? 0) >= 70 ? 'text-chart-2' : (p.fitScore ?? 0) >= 40 ? 'text-chart-5' : 'text-muted-foreground'
                          }`}>
                            {p.fitScore ?? '--'}
                          </td>
                          <td className="text-right px-4 py-3">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${(p.confidenceScore ?? 0) >= 70 ? 'bg-chart-2' : (p.confidenceScore ?? 0) >= 40 ? 'bg-chart-5' : 'bg-destructive'}`}
                                  style={{ width: `${p.confidenceScore ?? 0}%` }}
                                />
                              </div>
                              <span className="text-label-12 text-muted-foreground">{p.confidenceScore ?? '--'}</span>
                            </div>
                          </td>
                          <td className="text-center px-4 py-3">
                            <Badge variant={tier.variant}>{tier.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-copy-13 text-muted-foreground">{p.stage || 'New'}</td>
                          <td className="text-right px-4 py-3 text-copy-13 text-muted-foreground whitespace-nowrap">{timeAgo(p.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <div className="flex justify-center mt-4">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loadingMore ? 'Loading...' : `Load more (${rows.length} of ${totalCount})`}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
