export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getOfferAction } from '@/app/actions/strategy';
import { OfferForm } from '@/components/settings/OfferForm';

export const metadata = {
  title: 'Edit Offer | Leadroom',
};

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getOfferAction(id);
  if (!result.success || !result.offer) notFound();

  const offer = result.offer;

  return (
    <div>
      <h2 className="text-heading-lg mb-1">Edit Offer</h2>
      <p className="text-copy-14 text-muted-foreground mb-6 max-w-2xl">
        Update your offer definition.
      </p>
      <OfferForm
        initialData={{
          id: offer.id,
          name: offer.name,
          targetPain: offer.targetPain,
          desiredOutcome: offer.desiredOutcome,
          proofPoints: offer.proofPoints,
          forbiddenClaims: offer.forbiddenClaims,
        }}
      />
    </div>
  );
}
