export const dynamic = 'force-dynamic';
import { DiscoveryService } from '@/services/discovery';
import { getDb } from '@/db';
import Link from 'next/link';
import { Search, Calendar, FolderOpen, AlertTriangle } from 'lucide-react';
import { formatUTC } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';

export default async function ScopesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const db = getDb();
  const service = new DiscoveryService(db);
  const resolvedParams = await searchParams;
  const activeFilter = resolvedParams.filter || 'all';

  const scopes = await service.listScopes();

  const scopesWithStats = await Promise.all(
    scopes.map(async (scope: any) => {
      const candidates = await service.listCandidatesByScope(scope.id);
      const pendingCount = candidates.filter((c: any) => c.status === 'NEW' || c.status === 'REVIEWED').length;
      const totalCount = candidates.length;
      return {
        ...scope,
        pendingCount,
        totalCount,
      };
    })
  );

  let filteredScopes = scopesWithStats;
  if (activeFilter === 'pending') {
    filteredScopes = scopesWithStats.filter(s => s.pendingCount > 0);
  } else if (activeFilter === 'completed') {
    filteredScopes = scopesWithStats.filter(s => s.pendingCount === 0 && s.totalCount > 0);
  }

  const FILTER_OPTIONS = [
    { value: 'all', label: 'All Campaigns' },
    { value: 'pending', label: 'Pending Review' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Page Header */}
      <header className="space-y-4 border-b border-border/70 pb-6">
        <nav className="flex items-center gap-2 text-label-14 text-muted-foreground">
          <span className="font-medium text-foreground">Campaigns</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-heading-3xl text-card-foreground">Outreach Campaigns</h1>
            <p className="text-copy-14 text-muted-foreground mt-1.5 leading-relaxed">
              Define discovery parameters, run crawler scans, and qualify prospect candidates for outreach.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 lg:mt-1">
            <Link
              href="/scopes/new"
              className={buttonVariants({ variant: 'default' })}
            >
              Create Campaign
            </Link>
          </div>
        </div>
      </header>

      {/* Filter / Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-2">
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/25 p-1 w-fit">
          {FILTER_OPTIONS.map((opt) => {
            const isSelected = activeFilter === opt.value;
            const nextParams = new URLSearchParams();
            if (opt.value !== 'all') nextParams.set('filter', opt.value);
            const href = `/scopes?${nextParams.toString()}`;

            return (
              <Link
                key={opt.value}
                href={href}
                className={`inline-flex min-h-8 items-center justify-center rounded-md px-3.5 text-label-12 font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? 'bg-card text-foreground shadow-sm font-semibold border border-border/40'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Campaigns list representation */}
      {scopesWithStats.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center max-w-xl mx-auto mt-8 space-y-6">
          <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center text-primary mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-heading-lg text-foreground">No outreach campaigns yet</h3>
            <p className="text-copy-14 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Create your first target segment campaign to crawl local markets and start triaging candidates.
            </p>
          </div>
          <Link
            href="/scopes/new"
            className={buttonVariants({ variant: 'default' })}
          >
            Create Campaign
          </Link>
        </div>
      ) : filteredScopes.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center max-w-xl mx-auto mt-8 space-y-6">
          <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center text-primary mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-heading-lg text-foreground">No matching campaigns</h3>
            <p className="text-copy-14 text-muted-foreground max-w-md mx-auto leading-relaxed">
              There are no discovery campaigns qualified under the active "{activeFilter}" filter.
            </p>
          </div>
          <Link
            href="/scopes?filter=all"
            className={buttonVariants({ variant: 'outline' })}
          >
            Clear Filters
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredScopes.map((scope) => (
            <div
              key={scope.id}
              className="group relative bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all duration-200 overflow-hidden flex flex-col justify-between min-h-[220px]"
            >
              <Link href={`/scopes/${scope.id}`} className="absolute inset-0 z-0" aria-label={`View campaign ${scope.name}`} />

              <div className="relative z-10 pointer-events-none space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="max-w-[75%] space-y-1">
                    <h3 className="text-heading-lg text-foreground group-hover:text-primary transition capitalize truncate">
                      {scope.name}
                    </h3>
                    <p className="text-label-12 text-muted-foreground line-clamp-2 leading-relaxed">
                      {scope.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {scope.totalCount === 0 ? (
                      <Badge variant="outline" className="bg-muted/40 font-semibold">No Candidates</Badge>
                    ) : scope.pendingCount > 0 ? (
                      <Badge className="bg-chart-5/10 text-chart-5 border border-chart-5/20 hover:bg-chart-5/15 font-semibold">
                        {scope.pendingCount} pending
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted/50 border-border/70 text-muted-foreground font-semibold">
                        All Reviewed
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {scope.industryFilter && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
                      {scope.industryFilter}
                    </span>
                  )}
                  {scope.geographyFilter && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold bg-muted text-muted-foreground border border-border/80 uppercase tracking-wide">
                      {scope.geographyFilter}
                    </span>
                  )}
                </div>
              </div>

              <div className="relative z-10 mt-6 pt-4 border-t border-border space-y-3">
                <div className="flex justify-between items-center text-label-12 font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FolderOpen className="w-3.5 h-3.5" />
                    Total prospects: {scope.totalCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Created {formatUTC(scope.createdAt)}
                  </span>
                </div>

                {scope.totalCount === 0 ? (
                  <div className="bg-muted/40 p-3 rounded-md flex items-center justify-between gap-3 mt-2 pointer-events-auto">
                    <span className="text-label-12 font-semibold text-muted-foreground leading-normal flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-chart-5 shrink-0" />
                      No prospects yet. Start a Google Maps scan now.
                    </span>
                    <Link
                      href={`/scopes/${scope.id}`}
                      className="text-label-12 font-semibold text-primary hover:text-primary/80 hover:underline shrink-0"
                    >
                      Scan Now &rarr;
                    </Link>
                  </div>
                ) : (
                  <div className="flex justify-end pt-1">
                    <span className="text-label-12 font-semibold text-primary group-hover:text-primary/80 transition flex items-center gap-0.5">
                      Enter Workspace &rarr;
                    </span>
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
