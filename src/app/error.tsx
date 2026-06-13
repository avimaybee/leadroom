'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Next.js Runtime Error:', error);
  }, [error]);

  const isD1Missing = error.message?.includes('D1 database binding "DB" is not configured') || 
                      error.message?.includes('DB is not configured') ||
                      error.message?.includes('D1_ERROR') ||
                      error.message?.includes('binding') ||
                      error.message?.includes('undefined');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Glow background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,var(--color-indigo-600),transparent_70%)] opacity-20 pointer-events-none blur-3xl" />

      <div className="w-full max-w-2xl bg-slate-900/40 backdrop-blur-2xl p-8 md:p-10 rounded-3xl shadow-2xl border border-slate-800/80 relative z-10 text-slate-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shadow-lg border border-amber-500/25 mx-auto mb-6 text-xl">
            !
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            {isD1Missing ? 'D1 Database Configuration Required' : 'Application Runtime Error'}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {isD1Missing 
              ? 'Draftroom is deployed, but the Cloudflare D1 database binding is missing.' 
              : 'An unexpected error occurred while rendering the page.'}
          </p>
        </div>

        {isD1Missing ? (
          <div className="space-y-6 bg-slate-950/40 border border-slate-800 p-6 rounded-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              How to Bind D1 Database:
            </h3>
            <ol className="list-decimal list-inside space-y-3.5 text-sm text-slate-300 font-medium">
              <li>
                Go to the <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-semibold">Cloudflare Dashboard</a>.
              </li>
              <li>
                Navigate to <strong>Workers & Pages</strong> and select your Worker (<code>leadroom</code>).
              </li>
              <li>
                Go to <strong>Settings</strong> &rarr; <strong>Bindings</strong> &rarr; <strong>Add</strong> &rarr; <strong>D1 database</strong>.
              </li>
              <li>
                Set the <strong>Variable name</strong> to <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-bold">DB</code> and select your D1 Database.
              </li>
              <li>
                Redeploy the application or trigger a new build to apply the settings.
              </li>
            </ol>
            <div className="pt-4 border-t border-slate-800 text-xs text-slate-400">
              Note: Once bound, make sure you run the migrations to initialize the database tables.
            </div>
          </div>
        ) : (
          <div className="bg-red-500/5 text-red-400 p-6 rounded-2xl border border-red-500/15 text-sm font-mono whitespace-pre-wrap max-h-60 overflow-y-auto mb-6">
            {error.stack || error.message}
          </div>
        )}

        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all hover:scale-[1.01]"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-sm transition-all hover:scale-[1.01]"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
