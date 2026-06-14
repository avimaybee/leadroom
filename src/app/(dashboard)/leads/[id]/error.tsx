'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LeadDetailErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console
    console.error('[LeadDetailPage Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6 animate-fade-in p-6">
      <div className="w-16 h-16 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl flex items-center justify-center shadow-sm">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-xl font-extrabold text-card-foreground tracking-tight">Something went wrong</h2>
        <p className="text-sm text-muted-foreground font-semibold leading-relaxed">
          An error occurred while loading or displaying the lead profile details.
          {error.message && <code className="block mt-2 p-2 bg-muted border border-border rounded text-xs text-foreground font-mono text-left max-h-32 overflow-auto">{error.message}</code>}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={reset} size="sm">
          Try Again
        </Button>
        <Link href="/leads">
          <Button variant="outline" size="sm">
            Back to Leads
          </Button>
        </Link>
      </div>
    </div>
  );
}
