'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Next.js Runtime Error:', error);
  }, [error]);

  const isD1Missing = error.message?.includes('D1 database binding "DB" is not configured') || 
                      error.message?.includes('DB is not configured') ||
                      error.message?.includes('D1_ERROR') ||
                      error.message?.includes('binding') ||
                      error.message?.includes('undefined');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="w-full max-w-2xl bg-card p-8 md:p-10 rounded-2xl shadow-lg border border-border relative z-10 text-card-foreground">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center font-semibold mx-auto mb-6 text-heading-xl">
            !
          </div>
          <h2 className="text-heading-3xl text-foreground">
            {isD1Missing ? 'D1 Database Configuration Required' : 'Application Runtime Error'}
          </h2>
          <p className="mt-2 text-copy-14 text-muted-foreground">
            {isD1Missing 
              ? 'Leadroom is deployed, but the Cloudflare D1 database binding is missing.' 
              : 'An unexpected error occurred while rendering the page.'}
          </p>
        </div>

        {isD1Missing ? (
          <div className="space-y-6 bg-muted/50 border border-border p-6 rounded-2xl">
            <h3 className="text-label-14 uppercase text-foreground">
              How to Bind D1 Database:
            </h3>
            <ol className="list-decimal list-inside space-y-3.5 text-copy-14 text-muted-foreground font-medium">
              <li>
                Go to the <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 underline font-semibold">Cloudflare Dashboard</a>.
              </li>
              <li>
                Navigate to <strong>Workers & Pages</strong> and select your Worker (<code className="bg-muted px-1.5 py-0.5 rounded text-destructive font-semibold">leadroom</code>).
              </li>
              <li>
                Go to <strong>Settings</strong> &rarr; <strong>Bindings</strong> &rarr; <strong>Add</strong> &rarr; <strong>D1 database</strong>.
              </li>
              <li>
                Set the <strong>Variable name</strong> to <code className="bg-muted px-1.5 py-0.5 rounded text-destructive font-semibold">DB</code> and select your D1 Database.
              </li>
              <li>
                Redeploy the application or trigger a new build to apply the settings.
              </li>
            </ol>
            <div className="pt-4 border-t border-border text-label-12 text-muted-foreground">
              Note: Once bound, make sure you run the migrations to initialize the database tables.
            </div>
          </div>
        ) : (
          <div className="bg-destructive/5 text-destructive p-6 rounded-2xl border border-destructive/15 text-mono-14 whitespace-pre-wrap max-h-60 overflow-y-auto mb-6">
            Something went wrong. Please try again.
          </div>
        )}

        <div className="mt-8 flex justify-center gap-4">
          <Button onClick={() => reset()}>
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  );
}
