'use client';

import { ResearchSnapshot } from './types';

interface ResearchEditFormProps {
  leadId: string;
  initialSnapshot: ResearchSnapshot | null;
  formAction: (payload: FormData) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function ResearchEditForm({
  leadId,
  initialSnapshot,
  formAction,
  onCancel,
  onSave
}: ResearchEditFormProps) {
  const sourcesList = initialSnapshot?.sources 
    ? ((): string[] => {
        try {
          return JSON.parse(initialSnapshot.sources);
        } catch {
          return [];
        }
      })() 
    : [];

  return (
    <form
      action={(fd) => {
        formAction(fd);
        onSave();
      }}
      className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in"
    >
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div>
          <h4 className="text-base font-bold text-slate-950">Edit Research Snapshot</h4>
          <p className="text-xs text-slate-500 mt-0.5">Edit research fields or enrich outcomes manually.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
          >
            Save Snapshot
          </button>
        </div>
      </div>

      <input type="hidden" name="leadId" value={leadId} />

      <div className="grid grid-cols-1 gap-5">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Company Summary</label>
          <textarea
            name="companySummary"
            defaultValue={initialSnapshot?.companySummary || ''}
            rows={3}
            placeholder="Overview of scale, products, and core business..."
            className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Products & Services</label>
          <textarea
            name="productsServicesSummary"
            defaultValue={initialSnapshot?.productsServicesSummary || ''}
            rows={3}
            placeholder="What core services or offerings do they focus on?"
            className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Digital Footprint Notes</label>
            <textarea
              name="digitalPresenceNotes"
              defaultValue={initialSnapshot?.digitalPresenceNotes || ''}
              rows={3}
              placeholder="Social channels, maps, directory profiles..."
              className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Website Critique</label>
            <textarea
              name="websiteNotes"
              defaultValue={initialSnapshot?.websiteNotes || ''}
              rows={3}
              placeholder="UX critique, call-to-actions, load speeds..."
              className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Branding Observations</label>
            <textarea
              name="brandingNotes"
              defaultValue={initialSnapshot?.brandingNotes || ''}
              rows={3}
              placeholder="Colors, typography quality, brand coherence..."
              className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pain Points Hypotheses</label>
            <textarea
              name="painPointsHypotheses"
              defaultValue={initialSnapshot?.painPointsHypotheses || ''}
              rows={3}
              placeholder="Potential friction points preventing client conversion..."
              className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Agency Growth Opportunities</label>
            <textarea
              name="opportunityHypotheses"
              defaultValue={initialSnapshot?.opportunityHypotheses || ''}
              rows={3}
              placeholder="Pitch hypotheses: how we help them improve or redesign..."
              className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sources (one URL per line)</label>
            <textarea
              name="sources"
              defaultValue={sourcesList.join('\n')}
              rows={2}
              placeholder="https://example.com"
              className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Research Confidence</label>
            <select
              name="confidenceLevel"
              defaultValue={initialSnapshot?.confidenceLevel || 'MEDIUM'}
              className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            >
              <option value="HIGH">High Confidence</option>
              <option value="MEDIUM">Medium Confidence</option>
              <option value="LOW">Low Confidence</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>
        </div>
      </div>
    </form>
  );
}
