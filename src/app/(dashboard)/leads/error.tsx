'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function LeadsListErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Something went wrong"
      description="An error occurred while loading the leads list."
      backHref="/"
      backLabel="Back to Command Center"
    />
  );
}
