export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Plus, Info, Trash2 } from 'lucide-react';
import { listMarketsAction, deleteMarketAction } from '@/app/actions/strategy';

export const metadata = {
  title: 'Markets | Leadroom',
};

export default async function MarketListPage() {
  const result = await listMarketsAction();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-heading-2xl">Markets</h2>
          <p className="text-copy-14 text-muted-foreground mt-1">
            Define target market segments by linking an Offer and Ideal Client together.
          </p>
        </div>
        <Link
          href="/settings/market/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Market
        </Link>
      </div>

      {!result.success || result.markets.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <Info className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-heading-lg text-foreground">No markets yet</h3>
          <p className="text-copy-14 text-muted-foreground mt-1 max-w-md mx-auto">
            Create a market to link your Offer and Ideal Client together. Markets are where you add prospects and run research.
          </p>
          <Link
            href="/settings/market/new"
            className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Market
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Linked Offer</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Linked Ideal Client</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Created</th>
                <th className="text-right px-4 py-3 text-label-12 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.markets.map((market) => (
                <tr
                  key={market.id}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/settings/market/${market.id}`}
                >
                  <td className="px-4 py-3 text-copy-14 font-medium">{market.name}</td>
                  <td className="px-4 py-3 text-copy-13 text-muted-foreground">
                    {(market as any).offerName || '-'}
                  </td>
                  <td className="px-4 py-3 text-copy-13 text-muted-foreground">
                    {(market as any).icpName || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold ${
                        market.status === 'active'
                          ? 'bg-chart-2/10 text-chart-2'
                          : 'bg-chart-5/10 text-chart-5'
                      }`}
                    >
                      {market.status || 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-copy-13 text-muted-foreground">
                    {market.createdAt ? new Date(market.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form
                      action={async () => {
                        'use server';
                        await deleteMarketAction(market.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="submit"
                        className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
