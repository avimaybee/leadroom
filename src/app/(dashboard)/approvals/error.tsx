'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function ApprovalsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Approvals Error"
      description="Failed to load the approvals queue."
      backHref="/"
      backLabel="Command Center"
    />
  );
}
