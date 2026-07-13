export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Plus, Info } from 'lucide-react';
import { listOffersAction } from '@/app/actions/strategy';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'What I Sell | Leadroom',
};

export default async function OfferListPage() {
  const result = await listOffersAction();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-heading-2xl">What I Sell</h2>
          <p className="text-copy-14 text-muted-foreground mt-1">
            Your offer — the pain you solve, the results you deliver, and the proof behind it. Used to write every outreach message.
          </p>
        </div>
        <Link
          href="/personalisation/offer/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Offer
        </Link>
      </div>

      {!result.success || result.offers.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <Info className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-heading-lg text-foreground">No offers yet</h3>
          <p className="text-copy-14 text-muted-foreground mt-1 max-w-md mx-auto">
            Define what you sell to enable scoring and personalized outreach.
          </p>
          <Link
            href="/personalisation/offer/new"
            className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Offer
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Target Pain</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Proof Points</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {result.offers.map((offer) => (
                <tr
                  key={offer.id}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/personalisation/offer/${offer.id}`}
                >
                  <td className="px-4 py-3 text-copy-14 font-medium">{offer.name}</td>
                  <td className="px-4 py-3 text-copy-13 text-muted-foreground max-w-[200px] truncate">
                    {offer.targetPain || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {offer.proofPoints ? (
                      <Badge variant="secondary">{JSON.parse(offer.proofPoints).length}</Badge>
                    ) : (
                      <span className="text-copy-13 text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-copy-13 text-muted-foreground">
                    {offer.createdAt ? new Date(offer.createdAt).toLocaleDateString() : '-'}
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
