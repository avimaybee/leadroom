'use client';

import { useState, useActionState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, FileText, Sparkles } from 'lucide-react';
import { AuditSnapshot, LeadScore } from './types';
import { ActionState } from '@/app/actions/audits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    if (val >= 75) return 'bg-chart-2';
    if (val >= 50) return 'bg-chart-5';
    return 'bg-primary';
  };

  const getScoreTextColor = (val: number) => {
    if (val >= 75) return 'text-chart-2';
    if (val >= 50) return 'text-chart-5';
    return 'text-primary';
  };

  const getPriorityLabelColor = (label: string | null) => {
    switch (label?.toUpperCase()) {
      case 'HIGH':
        return 'bg-destructive/10 text-destructive border border-destructive/20';
      case 'MEDIUM':
        return 'bg-chart-5/10 text-chart-5 border border-chart-5/20';
      case 'LOW':
        return 'bg-muted text-muted-foreground border border-border';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Full-width Operational Controls Card */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <span className="text-xs font-bold text-card-foreground block">Operational Controls</span>
            <h4 className="text-sm font-semibold text-muted-foreground mt-1">Audit & Manual Override Settings</h4>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={() => setShowOverrideForm(!showOverrideForm)}
              variant="outline"
              size="sm"
            >
              {showOverrideForm ? 'Hide Override' : 'Override Score'}
            </Button>
            <Button
              onClick={onRunTriage}
              disabled={isTriaging}
              variant="outline"
              size="sm"
            >
              {isTriaging ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Triaging...</>
              ) : (
                'Run Triage Scan'
              )}
            </Button>
            <Button
              onClick={onRunAudit}
              disabled={isAuditing}
              size="sm"
            >
              {isAuditing ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Auditing...</>
              ) : (
                'Run Design Audit'
              )}
            </Button>
          </div>
        </div>

        {/* Override Form Panel */}
        {showOverrideForm && (
          <form action={formAction} className="border-t border-border pt-4 space-y-4 animate-fade-in">
            <input type="hidden" name="leadId" value={leadId} />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>New Score (0-100)</Label>
                <Input
                  type="number"
                  name="scoreValue"
                  required
                  min={0}
                  max={100}
                  defaultValue={score?.scoreValue ?? ''}
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label>Override Rationale / Justification</Label>
                <Input
                  type="text"
                  name="rationale"
                  required
                  placeholder="e.g. Spoke with owner, high website project budget"
                />
              </div>
            </div>
            {state?.error && <p className="text-destructive text-xs font-bold">{state.error}</p>}
            {state?.success && <p className="text-chart-2 text-xs font-bold">Manual override applied successfully.</p>}
            <div className="flex justify-end gap-2">
              <Button type="submit" size="xs">Apply Override</Button>
            </div>
          </form>
        )}

        {auditError && (
          <p className="text-destructive text-xs font-bold">{auditError}</p>
        )}
        {triageError && (
          <p className="text-destructive text-xs font-bold">{triageError}</p>
        )}
        {!showOverrideForm && !auditError && (
          <p className="text-xs text-muted-foreground font-semibold">
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
              <h4 className="text-xs font-bold text-card-foreground">Observations & Opportunities</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-2">
                  <span className="text-xs font-bold text-chart-2 block">Key Strengths</span>
                  <div className="text-xs text-card-foreground font-medium leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/30 prose-markdown">
                    {audit.keyStrengths ? (
                      <ReactMarkdown>{audit.keyStrengths}</ReactMarkdown>
                    ) : (
                      'No strengths noted.'
                    )}
                  </div>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-2">
                  <span className="text-xs font-bold text-destructive block">Key Weaknesses</span>
                  <div className="text-xs text-card-foreground font-medium leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/30 prose-markdown">
                    {audit.keyWeaknesses ? (
                      <ReactMarkdown>{audit.keyWeaknesses}</ReactMarkdown>
                    ) : (
                      'No weaknesses noted.'
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-3">
                <span className="text-xs font-bold text-primary block">Recommended Creative Improvements</span>
                <div className="text-xs text-muted-foreground font-medium leading-relaxed bg-primary/5 p-4 rounded-xl border border-primary/20 prose-markdown">
                  {audit.recommendedImprovements ? (
                    <ReactMarkdown>{audit.recommendedImprovements}</ReactMarkdown>
                  ) : (
                    'No creative recommendations generated.'
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-4 h-full flex flex-col justify-center items-center">
              <FileText className="w-12 h-12 text-muted-foreground" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-card-foreground">No Web Presence Audit Found</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto font-medium">
                  Run a design and branding audit to scrape this lead's website, generate visual subscores, and compute their priority scores.
                </p>
              </div>
              <Button onClick={onRunAudit} disabled={isAuditing} size="sm">
                {isAuditing ? 'Auditing Website...' : 'Trigger First-Pass Audit'}
              </Button>
            </div>
          )}
        </div>

        {/* Right Column (1/3 width): Stack Priority Score, Digital Sub-categories & Drivers */}
        <div className="lg:col-span-1 space-y-6">
          {/* Initial Triage Card */}
          {triagePriority && triagePriority !== 'UNASSESSED' && (
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-3 text-left">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-card-foreground">Initial Triage</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                  triagePriority === 'HIGH' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                  triagePriority === 'MEDIUM' ? 'bg-chart-5/10 text-chart-5 border border-chart-5/20' :
                  triagePriority === 'SKIP' ? 'bg-muted text-muted-foreground border border-border' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {triagePriority} Priority
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
                {triageReason || 'No details provided.'}
              </p>
            </div>
          )}

          {/* Priority Score Card */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold text-card-foreground block">Lead Priority Score</span>
              <div className="flex items-baseline mt-2">
                <span className="text-4xl font-black text-card-foreground">{score?.scoreValue ?? 0}</span>
                <span className="text-sm font-semibold text-muted-foreground">/100</span>
              </div>
              {score && (
                <span 
                  aria-label={`${score.scoreLabel} Priority`}
                  className={`inline-flex items-center px-2.5 py-0.5 mt-2 rounded-lg text-xs font-bold ${getPriorityLabelColor(score.scoreLabel)}`}
                >
                  <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                    score.scoreLabel?.toUpperCase() === 'HIGH' ? 'bg-destructive animate-pulse' :
                    score.scoreLabel?.toUpperCase() === 'MEDIUM' ? 'bg-chart-5' : 'bg-muted-foreground'
                  }`} />
                  {score.scoreLabel} Priority
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
              {score?.rationaleSummary || 'No score calculated yet. Run an audit to generate priority scores.'}
            </p>
          </div>

          {/* Digital Sub-categories progress bars (if audit exists) */}
          {audit && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-card-foreground">Digital Sub-categories</h4>
              <div className="space-y-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
                {[
                  { name: 'Website Quality', val: audit.websiteQualityScore },
                  { name: 'Design Aesthetic', val: audit.designAestheticScore },
                  { name: 'Messaging Clarity', val: audit.messagingClarityScore },
                  { name: 'Social Presence', val: audit.socialPresenceScore },
                  { name: 'Overall Branding', val: audit.overallBrandingScore },
                ].map((sub, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">{sub.name}</span>
                      <span className={getScoreTextColor(sub.val ?? 0)}>{sub.val ?? 0}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
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
            <div className="bg-muted p-6 rounded-2xl border border-border/60 space-y-4">
              <h4 className="text-xs font-bold text-card-foreground">Priority Score Driver Breakdown</h4>
              <div className="space-y-3">
                {factorsList.map((f, idx) => {
                  const isTop3 = idx < 3;
                  const magnitudePercent = Math.min(100, Math.abs(f.value) * 4); // Scale magnitude
                  return (
                    <div
                      key={idx}
                      className={`flex justify-between items-start text-xs border-b border-border/30 pb-2.5 last:border-0 last:pb-0 ${
                        isTop3 ? 'bg-primary/5 border border-primary/20 p-3 rounded-xl shadow-sm' : ''
                      }`}
                    >
                      <div className="flex-1 pr-4">
                        <span className={`text-foreground block ${isTop3 ? 'font-bold' : 'font-semibold'}`}>{f.name}</span>
                        <span className="text-xs text-muted-foreground font-medium">{f.description}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Horizontal visual magnitude indicator bar */}
                        <div className="w-16 bg-muted h-1.5 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${f.value > 0 ? 'bg-chart-2' : 'bg-destructive'}`}
                            style={{ width: `${magnitudePercent}%` }}
                          />
                        </div>
                        <span className={`font-black ${f.value > 0 ? 'text-chart-2' : (f.value < 0 ? 'text-destructive' : 'text-muted-foreground')}`}>
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
