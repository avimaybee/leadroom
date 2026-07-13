'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function ProspectDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Prospect Detail Error"
      description="Failed to load this prospect's details."
      backHref="/prospects"
      backLabel="All Prospects"
    />
  );
}
