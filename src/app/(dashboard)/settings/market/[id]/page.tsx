export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getMarketAction } from '@/app/actions/strategy';
import { MarketForm } from '@/components/settings/MarketForm';

export const metadata = {
  title: 'Edit Market | Leadroom',
};

export default async function EditMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getMarketAction(id);
  if (!result.success || !result.market) notFound();

  const market = result.market;

  return (
    <div>
      <h2 className="text-heading-lg mb-1">Edit Market</h2>
      <p className="text-copy-14 text-muted-foreground mb-6 max-w-2xl">
        Update your market definition.
      </p>
      <MarketForm
        initialData={{
          id: market.id,
          name: market.name,
          icpProfileId: market.icpProfileId,
          offerId: market.offerId,
          status: market.status,
        }}
      />
    </div>
  );
}
