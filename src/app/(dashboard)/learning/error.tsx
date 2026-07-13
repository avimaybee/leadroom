'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function LearningError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Learning Inbox Error"
      description="Failed to load learning suggestions."
      backHref="/"
      backLabel="Command Center"
    />
  );
}
