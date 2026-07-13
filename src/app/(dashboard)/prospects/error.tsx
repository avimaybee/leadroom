'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function ProspectsListError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Prospects Error"
      description="Failed to load the prospects list."
      backHref="/"
      backLabel="Command Center"
    />
  );
}
