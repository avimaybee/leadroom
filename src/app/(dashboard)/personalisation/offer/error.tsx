'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function OfferSettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Offer Settings Error"
      description="Failed to load offer settings."
      backHref="/settings/offer"
      backLabel="Offers"
    />
  );
}
