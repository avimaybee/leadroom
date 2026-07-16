'use client';

import AppErrorBoundary from '@/components/AppErrorBoundary';

export default function MarketsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorBoundary error={error} reset={reset} title="Markets error" />;
}
