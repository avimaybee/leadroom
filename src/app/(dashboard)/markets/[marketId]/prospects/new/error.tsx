'use client';

import AppErrorBoundary from '@/components/AppErrorBoundary';

export default function NewProspectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorBoundary error={error} reset={reset} title="Could not create prospect" />;
}
