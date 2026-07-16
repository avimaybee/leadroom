'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}

export function ErrorPage({
  error,
  reset,
  title = 'Something went wrong',
  description = 'An unexpected error occurred.',
  backHref,
  backLabel,
}: ErrorPageProps) {
  useEffect(() => {
    console.error(`[ErrorBoundary:${title}]`, {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6 animate-fade-in p-6">
      <div className="w-16 h-16 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl flex items-center justify-center shadow-sm">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-heading-xl text-card-foreground">{title}</h2>
        <p className="text-copy-14 text-muted-foreground font-semibold leading-relaxed">
          {description}
          {error.digest && (
            <span className="block mt-1 text-mono-12 text-muted-foreground/60">
              Error ID: {error.digest}
            </span>
          )}
          {error.digest && (
            <span className="block mt-1 text-mono-12 text-muted-foreground/60">
              Error ID: {error.digest}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Button onClick={reset} size="sm">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Try Again
        </Button>
        {backHref && (
          <Link href={backHref}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              {backLabel || 'Go Back'}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
