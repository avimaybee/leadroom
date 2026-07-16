export const dynamic = 'force-dynamic';
import { DiscoveryService } from '@/services/discovery';
import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import Link from 'next/link';
import { Search, Calendar, FolderOpen, AlertTriangle } from 'lucide-react';
import { formatUTC } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { candidateLeads } from '@/db/schema';
import { inArray } from 'drizzle-orm';

export default async function ScopesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const db = getDb();
  const userId = await getUserId();
  const service = new DiscoveryService(db);
  const resolvedParams = await searchParams;
  const activeFilter = resolvedParams.filter || 'all';

  const scopes = userId ? await service.listScopes(userId) : [];

  let scopeCandidates: any[] = [];
  if (userId && scopes.length > 0) {
    const scopeIds = scopes.map((s: any) => s.id);
    scopeCandidates = await db.select().from(candidateLeads).where(inArray(candidateLeads.discoveryScopeId, scopeIds));
  }
  const candidatesByScopeId = new Map<string, any[]>();
  for (const c of scopeCandidates) {
    let arr = candidatesByScopeId.get(c.discoveryScopeId);
    if (!arr) { arr = []; candidatesByScopeId.set(c.discoveryScopeId, arr); }
    arr.push(c);
  }

  const scopesWithStats = scopes.map((scope: any) => {
    const candidates = candidatesByScopeId.get(scope.id) || [];
    const pendingCount = candidates.filter((c: any) => c.status === 'NEW' || c.status === 'REVIEWED').length;
    const totalCount = candidates.length;
    return { ...scope, pendingCount, totalCount };
  });

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
          <Link href="/" className="hover:text-accent transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground">Campaigns</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage discovery campaigns and review candidate leads before promoting them.
            </p>
          </div>
          <Link
            href="/markets"
            className={buttonVariants({ variant: 'default', size: 'sm' })}
          >
            <Search className="w-4 h-4 mr-1.5" />
            New Campaign
          </Link>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex items-center gap-4 border-b border-border/60 pb-2">
        {FILTER_OPTIONS.map(opt => (
          <Link
            key={opt.value}
            href={opt.value === 'all' ? '/scopes' : `/scopes?filter=${opt.value}`}
            className={`text-sm font-medium px-1 pb-2 border-b-2 transition-colors ${
              activeFilter === opt.value
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* Scopes grid */}
      {filteredScopes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Search className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No campaigns found</p>
          <p className="text-sm mt-1">Start by creating a new discovery campaign from the Markets page.</p>
          <Link
            href="/markets"
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-4' })}
          >
            <Search className="w-4 h-4 mr-1.5" />
            Go to Markets
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredScopes.map((scope: any) => (
            <Link
              key={scope.id}
              href={`/scopes/${scope.id}`}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-card hover:border-accent/40 hover:shadow-sm transition-all duration-200 p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-base leading-tight group-hover:text-accent transition-colors line-clamp-1">
                  {scope.name}
                </h3>
                {scope.pendingCount > 0 && (
                  <Badge variant="secondary" className="shrink-0 ml-2">
                    {scope.pendingCount} pending
                  </Badge>
                )}
              </div>
              {scope.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{scope.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-2 border-t border-border/40">
                <span className="flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5" />
                  {scope.totalCount} leads
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatUTC(scope.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
