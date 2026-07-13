'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function IcpSettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="ICP Settings Error"
      description="Failed to load ICP profile settings."
      backHref="/personalisation/icp"
      backLabel="ICP Profiles"
    />
  );
}
