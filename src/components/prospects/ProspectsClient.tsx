'use client';

import { useState, useMemo } from 'react';
import { Search, Info, ArrowUpDown, ChevronUp, ChevronDown, List, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';

const TIER_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  tier1: { variant: 'default', label: 'T1' },
  tier2: { variant: 'secondary', label: 'T2' },
  tier3: { variant: 'outline', label: 'T3' },
  disqualified: { variant: 'destructive', label: 'DQ' },
};

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
}

interface MarketInfo {
  id: string;
  name: string;
}

interface ProspectsClientProps {
  initialProspects: ProspectRow[];
  markets: MarketInfo[];
}

type SortKey = 'company' | 'fitScore' | 'confidenceScore' | 'stage';

export function ProspectsClient({ initialProspects, markets }: ProspectsClientProps) {
  const [search, setSearch] = useState('');
  const [marketFilter, setMarketFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('fitScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const marketMap = useMemo(() => new Map(markets.map(m => [m.id, m.name])), [markets]);

  const stages = useMemo(() => {
    const s = new Set(initialProspects.map(p => p.stage).filter(Boolean));
    return Array.from(s) as string[];
  }, [initialProspects]);

  const filtered = useMemo(() => {
    let result = [...initialProspects];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        (p.company?.toLowerCase() || '').includes(q) ||
        (p.name?.toLowerCase() || '').includes(q)
      );
    }

    if (marketFilter !== 'all') {
      result = result.filter(p => p.marketId === marketFilter);
    }

    if (tierFilter !== 'all') {
      result = result.filter(p => (p.priorityTier || 'none') === tierFilter);
    }

    if (stageFilter !== 'all') {
      result = result.filter(p => p.stage === stageFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'company':
          cmp = (a.company || a.name || '').localeCompare(b.company || b.name || '');
          break;
        case 'fitScore':
          cmp = (a.fitScore ?? -1) - (b.fitScore ?? -1);
          break;
        case 'confidenceScore':
          cmp = (a.confidenceScore ?? -1) - (b.confidenceScore ?? -1);
          break;
        case 'stage':
          cmp = (a.stage || '').localeCompare(b.stage || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [initialProspects, search, marketFilter, tierFilter, stageFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'fitScore' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1" />
      : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-border pb-4">
        <div>
          <h2 className="text-heading-2xl">All Prospects</h2>
          <p className="text-copy-14 text-muted-foreground mt-1">
            {viewMode === 'list' ? (
              <>{filtered.length} prospect{filtered.length === 1 ? '' : 's'}{search && ` matching "${search}"`}</>
            ) : (
              <>Visual pipeline board of all prospects</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label-12 transition-all ${
              viewMode === 'list'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List View
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label-12 transition-all ${
              viewMode === 'kanban'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Kanban Board
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <PipelineBoard />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search prospects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={marketFilter}
          onChange={e => setMarketFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-border bg-background text-copy-14 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Markets</option>
          {markets.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-border bg-background text-copy-14 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Tiers</option>
          <option value="tier1">Tier 1</option>
          <option value="tier2">Tier 2</option>
          <option value="tier3">Tier 3</option>
          <option value="disqualified">Disqualified</option>
        </select>
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-border bg-background text-copy-14 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Stages</option>
          {stages.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <Info className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-heading-lg text-foreground">No prospects found</h3>
          <p className="text-copy-14 text-muted-foreground mt-1 max-w-md mx-auto">
            {search || marketFilter !== 'all' || tierFilter !== 'all' || stageFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Add prospects to a market to get started.'}
          </p>
          <Link
            href="/markets"
            className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
          >
            Go to Markets
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th
                  className="text-left px-4 py-3 text-label-12 text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort('company')}
                >
                  <span className="inline-flex items-center">Company <SortIcon column="company" /></span>
                </th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Market</th>
                <th
                  className="text-right px-4 py-3 text-label-12 text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort('fitScore')}
                >
                  <span className="inline-flex items-center justify-end">Fit <SortIcon column="fitScore" /></span>
                </th>
                <th
                  className="text-right px-4 py-3 text-label-12 text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort('confidenceScore')}
                >
                  <span className="inline-flex items-center justify-end">Confidence <SortIcon column="confidenceScore" /></span>
                </th>
                <th className="text-center px-4 py-3 text-label-12 text-muted-foreground">Tier</th>
                <th
                  className="text-left px-4 py-3 text-label-12 text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort('stage')}
                >
                  <span className="inline-flex items-center">Stage <SortIcon column="stage" /></span>
                </th>
                <th className="text-center px-4 py-3 text-label-12 text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const tier = TIER_BADGE[p.priorityTier as keyof typeof TIER_BADGE] || TIER_BADGE.tier3;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/prospects/${p.id}`}
                  >
                    <td className="px-4 py-3 text-copy-14 font-medium">{p.company || p.name}</td>
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
                    <td className="text-center px-4 py-3">
                      <Link
                        href={`/prospects/${p.id}`}
                        className="inline-flex items-center h-7 px-2.5 rounded-md border border-border text-label-12 hover:bg-muted/50 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </>
    )}
    </div>
  );
}
