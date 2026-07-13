'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function MarketSettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Market Settings Error"
      description="Failed to load market settings."
      backHref="/settings/market"
      backLabel="Markets"
    />
  );
}
