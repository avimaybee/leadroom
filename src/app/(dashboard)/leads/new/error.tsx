'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function LeadNewErrorBoundary({
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
      description="An error occurred while creating a new lead."
      backHref="/leads"
      backLabel="Back to Leads"
    />
  );
}
