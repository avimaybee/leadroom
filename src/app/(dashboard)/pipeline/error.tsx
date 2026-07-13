'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function PipelineError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Pipeline Error"
      description="Failed to load the pipeline view."
      backHref="/"
      backLabel="Command Center"
    />
  );
}
