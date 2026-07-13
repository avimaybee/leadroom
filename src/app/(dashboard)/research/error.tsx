'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function ResearchQueueError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Research Queue Error"
      description="Failed to load the research queue."
      backHref="/"
      backLabel="Command Center"
    />
  );
}
