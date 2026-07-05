'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Settings2 } from 'lucide-react';

interface Props {
  stages: string[];
  initialConfig: Record<string, unknown>;
}

const STAGE_THRESHOLDS_DAYS: Record<string, number> = {
  'In Research': 2,
  'Auditing': 2,
  'Audited': 2,
  'Drafting': 2,
  'Outreach Sent': 3,
  'Meeting': 1,
  'Negotiation': 2,
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  'In Research': 'AI researches in minutes. Founder reviews same day.',
  'Outreach Sent': 'Check for reply within 3 days, follow up at day 5.',
  'Meeting': 'Log outcome within 1 day of the call.',
  'Negotiation': 'Quick yes/no on terms within 2 days.',
};

export function PipelineAutomationCard({ stages, initialConfig }: Props) {
  const [autoTasks, setAutoTasks] = useState(true);
  const [enforceReqs, setEnforceReqs] = useState(true);
  const [sensitivity, setSensitivity] = useState<'relaxed' | 'normal' | 'strict'>('normal');
  const [showOverrides, setShowOverrides] = useState(false);

  const sensitivityLabel = sensitivity === 'relaxed' ? 'Relaxed (×1.5)' : sensitivity === 'strict' ? 'Strict (×0.7)' : 'Normal (×1.0)';
  const sensitivityColor = sensitivity === 'relaxed' ? 'text-chart-2' : sensitivity === 'strict' ? 'text-chart-5' : 'text-foreground';

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="border-b border-border bg-muted/20 pb-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <CardTitle className="text-heading-lg">Pipeline Automation</CardTitle>
        </div>
        <CardDescription className="text-copy-14 mt-1">
          Smart defaults for stage management. No configuration required — override per stage if needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Toggles row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
            <div>
              <span className="text-copy-14 font-medium text-foreground">Auto-generate tasks</span>
              <p className="text-label-12 text-muted-foreground mt-0.5">Creates follow-up tasks on stage entry</p>
            </div>
            <input type="checkbox" checked={autoTasks} onChange={(e) => setAutoTasks(e.target.checked)} className="toggle toggle-primary" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
            <div>
              <span className="text-copy-14 font-medium text-foreground">Enforce readiness</span>
              <p className="text-label-12 text-muted-foreground mt-0.5">Blocks moves if research/draft missing</p>
            </div>
            <input type="checkbox" checked={enforceReqs} onChange={(e) => setEnforceReqs(e.target.checked)} className="toggle toggle-primary" />
          </label>
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <span className="text-copy-14 font-medium text-foreground">Stale sensitivity</span>
            <div className="flex gap-1 mt-1.5">
              {(['relaxed', 'normal', 'strict'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSensitivity(opt)}
                  className={`flex-1 px-2 py-1 rounded text-label-12 font-semibold transition-colors ${
                    sensitivity === opt
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Per-stage reference table (collapsible) */}
        <div>
          <button
            onClick={() => setShowOverrides(!showOverrides)}
            className="flex items-center gap-1.5 text-label-12 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showOverrides ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Stage defaults reference
          </button>

          {showOverrides && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-copy-13">
                <thead>
                  <tr className="text-label-12 text-muted-foreground border-b border-border">
                    <th className="text-left py-2 pr-4">Stage</th>
                    <th className="text-right py-2 px-4">Stale threshold</th>
                    <th className="text-left py-2 pl-4">Auto tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.filter((s) => STAGE_THRESHOLDS_DAYS[s]).map((stage) => (
                    <tr key={stage} className="border-b border-border/40">
                      <td className="py-2 pr-4 font-medium text-foreground">{stage}</td>
                      <td className="text-right py-2 px-4 text-muted-foreground">
                        {STAGE_THRESHOLDS_DAYS[stage]} day{STAGE_THRESHOLDS_DAYS[stage] !== 1 ? 's' : ''}
                      </td>
                      <td className="py-2 pl-4 text-label-12 text-muted-foreground">
                        {STAGE_DESCRIPTIONS[stage] || '\u2014'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
