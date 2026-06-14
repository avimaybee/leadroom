'use client';

import { useState, useActionState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { AuditSnapshot, LeadScore } from './types';
import { ActionState } from '@/app/actions/audits';

interface AuditDisplayProps {
  leadId: string;
  audit: AuditSnapshot | null;
  score: LeadScore | null;
  triagePriority: string;
  triageReason: string | null;
  onRunAudit: () => void;
  onRunTriage: () => void;
  isAuditing: boolean;
  isTriaging: boolean;
  auditError: string | null;
  triageError: string | null;
  manualOverrideScoreAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}

export function AuditDisplay({
  leadId,
  audit,
  score,
  triagePriority,
  triageReason,
  onRunAudit,
  onRunTriage,
  isAuditing,
  isTriaging,
  auditError,
  triageError,
  manualOverrideScoreAction,
}: AuditDisplayProps) {
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [state, formAction] = useActionState(manualOverrideScoreAction, undefined);

  // Parse scoring factors from database JSON string and sort by magnitude descending
  let factorsList: Array<{ name: string; value: number; description: string }> = [];
  if (score?.factors) {
    try {
      factorsList = (JSON.parse(score.factors) as Array<{ name: string; value: number; description: string }>)
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    } catch (e) {
      console.warn('[AuditDisplay] Failed to parse score factors JSON:', e);
    }
  }

  const getScoreColor = (val: number) => {
    if (val >= 75) return 'bg-emerald-500';
    if (val >= 50) return 'bg-amber-500';
    return 'bg-indigo-500';
  };

  const getScoreTextColor = (val: number) => {
    if (val >= 75) return 'text-emerald-600';
    if (val >= 50) return 'text-amber-600';
    return 'text-indigo-600';
  };

  const getScoreBgColor = (val: number) => {
    if (val >= 75) return 'bg-emerald-50 border-emerald-100';
    if (val >= 50) return 'bg-amber-50 border-amber-100';
    return 'bg-indigo-50 border-indigo-100';
  };

  const getPriorityLabelColor = (label: string | null) => {
    switch (label?.toUpperCase()) {
      case 'HIGH':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'LOW':
        return 'bg-slate-50 text-slate-700 border border-slate-200';
      default:
        return 'bg-slate-50 text-slate-500 border border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Full-width Operational Controls Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <span className="text-xs font-bold text-slate-900 block">Operational Controls</span>
            <h4 className="text-sm font-semibold text-slate-600 mt-1">Audit & Manual Override Settings</h4>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowOverrideForm(!showOverrideForm)}
              className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold rounded-xl transition text-slate-700"
            >
              {showOverrideForm ? 'Hide Override' : 'Override Score'}
            </button>
            <button
              onClick={onRunTriage}
              disabled={isTriaging}
              className="border border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl transition flex items-center gap-2"
            >
              {isTriaging ? (
                <>
                  <svg className="animate-spin h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Triaging...
                </>
              ) : (
                'Run Triage Scan'
              )}
            </button>
            <button
              onClick={onRunAudit}
              disabled={isAuditing}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow shadow-indigo-600/10"
            >
              {isAuditing ? (
                <>
                  <svg className="animate-spin h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Auditing...
                </>
              ) : (
                'Run Design Audit'
              )}
            </button>
          </div>
        </div>

        {/* Override Form Panel */}
        {showOverrideForm && (
          <form action={formAction} className="border-t border-slate-100 pt-4 space-y-4 animate-fade-in">
            <input type="hidden" name="leadId" value={leadId} />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-900">New Score (0-100)</label>
                <input
                  type="number"
                  name="scoreValue"
                  required
                  min="0"
                  max="100"
                  defaultValue={score?.scoreValue ?? ''}
                  className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-bold text-slate-900">Override Rationale / Justification</label>
                <input
                  type="text"
                  name="rationale"
                  required
                  placeholder="e.g. Spoke with owner, high website project budget"
                  className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs focus:outline-none focus:border-slate-900 text-slate-800"
                />
              </div>
            </div>
            {state?.error && <p className="text-rose-500 text-xs font-bold">{state.error}</p>}
            {state?.success && <p className="text-emerald-500 text-xs font-bold">Manual override applied successfully.</p>}
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-2 rounded-lg transition"
              >
                Apply Override
              </button>
            </div>
          </form>
        )}

        {auditError && (
          <p className="text-rose-500 text-xs font-bold">{auditError}</p>
        )}
        {triageError && (
          <p className="text-rose-500 text-xs font-bold">{triageError}</p>
        )}
        {!showOverrideForm && !auditError && (
          <p className="text-xs text-slate-500 font-semibold">
            Trigger background scraper & AI design audits. Scores and recommendations are automatically updated.
          </p>
        )}
      </div>

      {/* 3-Column Grid for Score & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2/3 width): Observations & Recommendations */}
        <div className="lg:col-span-2 space-y-6">
          {audit ? (
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-slate-900">Observations & Opportunities</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                  <span className="text-xs font-bold text-emerald-700 block">Key Strengths</span>
                  <div className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/30 p-3 rounded-xl border border-slate-200/30 prose-markdown">
                    {audit.keyStrengths ? (
                      <ReactMarkdown>{audit.keyStrengths}</ReactMarkdown>
                    ) : (
                      'No strengths noted.'
                    )}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                  <span className="text-xs font-bold text-rose-700 block">Key Weaknesses</span>
                  <div className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/30 p-3 rounded-xl border border-slate-200/30 prose-markdown">
                    {audit.keyWeaknesses ? (
                      <ReactMarkdown>{audit.keyWeaknesses}</ReactMarkdown>
                    ) : (
                      'No weaknesses noted.'
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <span className="text-xs font-bold text-indigo-700 block">Recommended Creative Improvements</span>
                <div className="text-xs text-slate-800 font-medium leading-relaxed bg-indigo-50/20 p-4 rounded-xl border border-indigo-200/30 prose-markdown">
                  {audit.recommendedImprovements ? (
                    <ReactMarkdown>{audit.recommendedImprovements}</ReactMarkdown>
                  ) : (
                    'No creative recommendations generated.'
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 h-full flex flex-col justify-center items-center">
              <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">No Web Presence Audit Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                  Run a design and branding audit to scrape this lead's website, generate visual subscores, and compute their priority scores.
                </p>
              </div>
              <button
                onClick={onRunAudit}
                disabled={isAuditing}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow shadow-indigo-600/10"
              >
                {isAuditing ? 'Auditing Website...' : 'Trigger First-Pass Audit'}
              </button>
            </div>
          )}
        </div>

        {/* Right Column (1/3 width): Stack Priority Score, Digital Sub-categories & Drivers */}
        <div className="lg:col-span-1 space-y-6">
          {/* Initial Triage Card */}
          {triagePriority && triagePriority !== 'UNASSESSED' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 text-left">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-900">Initial Triage</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                  triagePriority === 'HIGH' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                  triagePriority === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  triagePriority === 'SKIP' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {triagePriority} Priority
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                {triageReason || 'No details provided.'}
              </p>
            </div>
          )}

          {/* Priority Score Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Lead Priority Score</span>
              <div className="flex items-baseline mt-2">
                <span className="text-4xl font-black text-slate-900">{score?.scoreValue ?? 0}</span>
                <span className="text-sm font-semibold text-slate-400">/100</span>
              </div>
              {score && (
                <span 
                  aria-label={`${score.scoreLabel} Priority`}
                  className={`inline-flex items-center px-2.5 py-0.5 mt-2 rounded-lg text-xs font-bold ${getPriorityLabelColor(score.scoreLabel)}`}
                >
                  <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                    score.scoreLabel?.toUpperCase() === 'HIGH' ? 'bg-rose-600 animate-pulse' :
                    score.scoreLabel?.toUpperCase() === 'MEDIUM' ? 'bg-amber-500' : 'bg-slate-400'
                  }`} />
                  {score.scoreLabel} Priority
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {score?.rationaleSummary || 'No score calculated yet. Run an audit to generate priority scores.'}
            </p>
          </div>

          {/* Digital Sub-categories progress bars (if audit exists) */}
          {audit && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-900">Digital Sub-categories</h4>
              <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                {[
                  { name: 'Website Quality', val: audit.websiteQualityScore },
                  { name: 'Design Aesthetic', val: audit.designAestheticScore },
                  { name: 'Messaging Clarity', val: audit.messagingClarityScore },
                  { name: 'Social Presence', val: audit.socialPresenceScore },
                  { name: 'Overall Branding', val: audit.overallBrandingScore },
                ].map((sub, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-500">{sub.name}</span>
                      <span className={getScoreTextColor(sub.val ?? 0)}>{sub.val ?? 0}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getScoreColor(sub.val ?? 0)}`}
                        style={{ width: `${sub.val ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scoring Drivers Breakdown */}
          {factorsList.length > 0 && (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 space-y-4">
              <h4 className="text-xs font-bold text-slate-900">Priority Score Driver Breakdown</h4>
              <div className="space-y-3">
                {factorsList.map((f, idx) => {
                  const isTop3 = idx < 3;
                  const magnitudePercent = Math.min(100, Math.abs(f.value) * 4); // Scale magnitude
                  return (
                    <div
                      key={idx}
                      className={`flex justify-between items-start text-xs border-b border-slate-200/30 pb-2.5 last:border-0 last:pb-0 ${
                        isTop3 ? 'bg-indigo-50/40 border border-indigo-100 p-3 rounded-xl shadow-sm' : ''
                      }`}
                    >
                      <div className="flex-1 pr-4">
                        <span className={`text-slate-700 block ${isTop3 ? 'font-bold' : 'font-semibold'}`}>{f.name}</span>
                        <span className="text-[10px] text-slate-500 font-medium">{f.description}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Horizontal visual magnitude indicator bar */}
                        <div className="w-16 bg-slate-200/60 h-1.5 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${f.value > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${magnitudePercent}%` }}
                          />
                        </div>
                        <span className={`font-black ${f.value > 0 ? 'text-emerald-600' : (f.value < 0 ? 'text-rose-600' : 'text-slate-500')}`}>
                          {f.value > 0 ? `+${f.value}` : f.value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
