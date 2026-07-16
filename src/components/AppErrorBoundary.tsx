'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface AppErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  message?: string;
}

export default function AppErrorBoundary({
  error,
  reset,
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
}: AppErrorBoundaryProps) {
  useEffect(() => {
    console.error('[AppErrorBoundary]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
      <h2 className="text-2xl font-bold text-destructive">{title}</h2>
      <p className="text-muted-foreground text-center max-w-md">{message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
