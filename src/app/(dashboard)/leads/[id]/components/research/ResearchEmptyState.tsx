'use client';

interface ResearchEmptyStateProps {
  enrichError: string | null;
  jobError: string | null;
  onEnrich: () => void;
  onEdit: () => void;
  isEnriching?: boolean;
}

export function ResearchEmptyState({
  enrichError,
  jobError,
  onEnrich,
  onEdit,
  isEnriching = false,
}: ResearchEmptyStateProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-4 py-8">
      <div>
        <h4 className="text-base font-bold text-slate-900">No Research Available</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
          Run an automated enrichment scan or input custom branding observations to kickstart outreach preparation.
        </p>
      </div>

      {(enrichError || jobError) && (
        <div className="max-w-md mx-auto">
          {(enrichError || jobError)?.includes('429') ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-left text-xs space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <svg className="w-4.5 h-4.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Daily Browser Limits Reached
              </div>
              <p className="leading-relaxed text-amber-700 font-medium">
                Cloudflare Browser Run time limit has been exceeded for today (free tier cap). You can input manual research notes below to continue working without interruption.
              </p>
            </div>
          ) : (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-2.5 rounded-lg text-xs font-semibold">
              {enrichError || jobError}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center items-center gap-3 pt-2">
        <button
          onClick={onEnrich}
          disabled={isEnriching}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm hover:scale-[1.01] flex items-center gap-1.5"
        >
          {isEnriching ? (
            <>
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Starting...
            </>
          ) : 'Enrich via AI'}
        </button>
        <button
          onClick={onEdit}
          className="text-indigo-600 hover:text-indigo-700 hover:underline text-xs font-bold px-2 py-2 transition"
        >
          Add Notes Manually
        </button>
      </div>
    </div>
  );
}
