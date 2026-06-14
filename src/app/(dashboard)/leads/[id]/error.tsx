'use client';

import { useEffect } from 'react';
import Link from 'next/link';

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
      <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Something went wrong</h2>
        <p className="text-sm text-slate-500 font-semibold leading-relaxed">
          An error occurred while loading or displaying the lead profile details.
          {error.message && <code className="block mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 font-mono text-left max-h-32 overflow-auto">{error.message}</code>}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 transition duration-150"
        >
          Try Again
        </button>
        <Link
          href="/leads"
          className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs transition duration-150"
        >
          Back to Leads
        </Link>
      </div>
    </div>
  );
}
