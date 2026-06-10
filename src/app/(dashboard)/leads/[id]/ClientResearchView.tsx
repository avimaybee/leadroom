'use client';

import { useState, useTransition, useActionState } from 'react';

interface ResearchSnapshot {
  id: string;
  leadId: string;
  origin: string;
  snapshotTitle: string | null;
  companySummary: string | null;
  productsServicesSummary: string | null;
  digitalPresenceNotes: string | null;
  websiteNotes: string | null;
  brandingNotes: string | null;
  painPointsHypotheses: string | null;
  opportunityHypotheses: string | null;
  sources: string | null; // JSON stringified array
  confidenceLevel: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}

interface ClientResearchViewProps {
  leadId: string;
  initialSnapshot: ResearchSnapshot | null;
  triggerEnrichmentAction: (leadId: string) => Promise<{ error: string | null }>;
  saveResearchSnapshotAction: (prevState: any, formData: FormData) => Promise<any>;
}

export default function ClientResearchView({
  leadId,
  initialSnapshot,
  triggerEnrichmentAction,
  saveResearchSnapshotAction,
}: ClientResearchViewProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'opportunity'>('overview');
  const [state, formAction] = useActionState(saveResearchSnapshotAction, { error: null });

  const [enrichError, setEnrichError] = useState<string | null>(null);

  const handleEnrich = () => {
    setEnrichError(null);
    startTransition(async () => {
      const res = await triggerEnrichmentAction(leadId);
      if (res.error) {
        setEnrichError(res.error);
      }
    });
  };

  const parseSources = (sourcesStr: string | null): string[] => {
    if (!sourcesStr) return [];
    try {
      return JSON.parse(sourcesStr);
    } catch {
      return [];
    }
  };

  const sourcesList = parseSources(initialSnapshot?.sources || null);

  const getConfidenceColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'HIGH':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'LOW':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
  };

  // 1. Loading/Triggering State
  if (isPending) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-4 py-16 animate-pulse">
        <div className="flex justify-center">
          <svg className="animate-spin h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-slate-800">Enriching active lead profile...</p>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Gemini is analyzing public footprints, branding assets, and opportunities. This may take a few seconds.
        </p>
      </div>
    );
  }

  // 2. Empty State
  if (!initialSnapshot && !isEditing) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-4 py-12">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit mx-auto">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <h4 className="text-base font-bold text-slate-900">No Research Available</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Run an automated enrichment scan or input custom branding observations to kickstart outreach preparation.
          </p>
        </div>

        {enrichError && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 p-2.5 rounded-lg text-xs font-semibold max-w-md mx-auto">
            {enrichError}
          </div>
        )}

        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={handleEnrich}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm hover:scale-[1.01]"
          >
            Enrich via AI
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition"
          >
            Add Notes Manually
          </button>
        </div>
      </div>
    );
  }

  // 3. Edit State (Form)
  if (isEditing) {
    const handleFormSubmit = () => {
      // Delay closing editing view until after action completes
      setTimeout(() => setIsEditing(false), 200);
    };

    return (
      <form
        action={(fd) => {
          formAction(fd);
          handleFormSubmit();
        }}
        className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in"
      >
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <h4 className="text-base font-bold text-slate-950">Edit Research Snapshot</h4>
            <p className="text-xs text-slate-400 mt-0.5">Edit research fields or enrich outcomes manually.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              Save Snapshot
            </button>
          </div>
        </div>

        <input type="hidden" name="leadId" value={leadId} />

        <div className="grid grid-cols-1 gap-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Company Summary</label>
            <textarea
              name="companySummary"
              defaultValue={initialSnapshot?.companySummary || ''}
              rows={3}
              placeholder="Overview of scale, products, and core business..."
              className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Products & Services</label>
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
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Digital Footprint Notes</label>
              <textarea
                name="digitalPresenceNotes"
                defaultValue={initialSnapshot?.digitalPresenceNotes || ''}
                rows={3}
                placeholder="Social channels, maps, directory profiles..."
                className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Website Critique</label>
              <textarea
                name="websiteNotes"
                defaultValue={initialSnapshot?.websiteNotes || ''}
                rows={3}
                placeholder="UX critique, call-to-actions, load speeds..."
                className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Branding Observations</label>
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
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pain Points Hypotheses</label>
              <textarea
                name="painPointsHypotheses"
                defaultValue={initialSnapshot?.painPointsHypotheses || ''}
                rows={3}
                placeholder="Potential friction points preventing client conversion..."
                className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Agency Growth Opportunities</label>
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
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sources (one URL per line)</label>
              <textarea
                name="sources"
                defaultValue={sourcesList.join('\n')}
                rows={2}
                placeholder="https://example.com"
                className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Research Confidence</label>
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

  // 4. View Mode
  if (!initialSnapshot) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 bg-slate-50/40">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-950 uppercase tracking-wider">Research Snapshot</h4>
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase ${getConfidenceColor(initialSnapshot.confidenceLevel)}`}>
              {initialSnapshot.confidenceLevel} Confidence
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
            Origin: {initialSnapshot.origin} &bull; Updated: {new Date(initialSnapshot.updatedAt || '').toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleEnrich}
            className="bg-indigo-600/90 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition"
          >
            Re-Enrich
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition"
          >
            Edit Notes
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-100 px-5 text-xs font-bold text-slate-400">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3.5 px-4 border-b-2 transition ${
            activeTab === 'overview' ? 'border-slate-900 text-slate-950' : 'border-transparent hover:text-slate-600'
          }`}
        >
          Company Overview
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3.5 px-4 border-b-2 transition ${
            activeTab === 'audit' ? 'border-slate-900 text-slate-950' : 'border-transparent hover:text-slate-600'
          }`}
        >
          Branding & Audit
        </button>
        <button
          onClick={() => setActiveTab('opportunity')}
          className={`py-3.5 px-4 border-b-2 transition ${
            activeTab === 'opportunity' ? 'border-slate-900 text-slate-950' : 'border-transparent hover:text-slate-600'
          }`}
        >
          Pitch Hypothesis
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Company Summary</span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-200/50">
                {initialSnapshot.companySummary || 'No summary registered yet.'}
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Products & Services</span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-200/50">
                {initialSnapshot.productsServicesSummary || 'No products/services list registered yet.'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Digital Presence</span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 h-full">
                {initialSnapshot.digitalPresenceNotes || 'No notes.'}
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Website Critique</span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 h-full">
                {initialSnapshot.websiteNotes || 'No notes.'}
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Branding Observations</span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 h-full">
                {initialSnapshot.brandingNotes || 'No notes.'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'opportunity' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Potential Pain Points</span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-200/50">
                {initialSnapshot.painPointsHypotheses || 'No hypotheses compiled.'}
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Agency Opportunities</span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-200/50">
                {initialSnapshot.opportunityHypotheses || 'No hypotheses compiled.'}
              </p>
            </div>
          </div>
        )}

        {/* Sources Footer */}
        {sourcesList.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Sources Checked</span>
            <div className="flex flex-wrap gap-2">
              {sourcesList.map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-[10px] font-bold text-indigo-600 transition"
                >
                  <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {src.replace(/https?:\/\/(www\.)?/, '').substring(0, 30)}
                  {src.length > 30 && '...'}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
