export const runtime = 'edge';
export const dynamic = 'force-dynamic';
import { DiscoveryService } from '@/services/discovery';
import { getDb } from '@/db';
import Link from 'next/link';


export default async function ScopesPage() {
  const db = getDb();
  const service = new DiscoveryService(db);

  const scopes = await service.listScopes();

  // Enhance scopes with candidate counts
  const scopesWithStats = await Promise.all(
    scopes.map(async (scope: any) => {
      const candidates = await service.listCandidatesByScope(scope.id);
      const pendingCount = candidates.filter((c: any) => c.status === 'NEW').length;
      const totalCount = candidates.length;
      return {
        ...scope,
        pendingCount,
        totalCount,
      };
    })
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Discovery Scopes</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Define target segments and manage prospects for your outreach campaigns.
          </p>
        </div>
        <Link
          href="/scopes/new"
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-slate-950/10 hover:scale-[1.01]"
        >
          + Create Scope
        </Link>
      </div>

      {scopesWithStats.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto mt-8">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1.5">No discovery scopes yet</h3>
          <p className="text-sm text-slate-500 mb-6">
            Create your first targeting scope to start finding and qualifing business leads.
          </p>
          <Link
            href="/scopes/new"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition"
          >
            Create your first Scope
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scopesWithStats.map((scope) => (
            <Link
              key={scope.id}
              href={`/scopes/${scope.id}`}
              className="group block bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-500/50 hover:shadow-md transition-all duration-200 relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-indigo-600 transition">
                    {scope.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {scope.description || 'No description provided.'}
                  </p>
                </div>
                {scope.pendingCount > 0 ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    {scope.pendingCount} pending
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200">
                    Clean
                  </span>
                )}
              </div>

              {/* Filters list */}
              <div className="flex flex-wrap gap-1.5 mb-6">
                {scope.industryFilter && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                    {scope.industryFilter}
                  </span>
                )}
                {scope.geographyFilter && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                    {scope.geographyFilter}
                  </span>
                )}
                {scope.companySizeFilter && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                    {scope.companySizeFilter}
                  </span>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-400">
                <span>Total prospects: {scope.totalCount}</span>
                <span>Created {new Date(scope.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Highlight accent on hover */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-indigo-600 transition-all duration-200" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
