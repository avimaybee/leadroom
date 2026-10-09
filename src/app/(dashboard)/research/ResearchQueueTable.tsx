'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronDown, Loader2, RotateCcw, ExternalLink, Ban } from 'lucide-react';
import { retryResearchTaskAction, cancelResearchTaskAction } from '@/app/actions/research';
import { toast } from 'sonner';

interface TaskRow {
  id: string;
  prospectId: string;
  taskType: string;
  status: string;
  rawArtifacts: string | null;
  extractedSignals: string | null;
  confidence: number | null;
  errorMessage: string | null;
  retryCount: number | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number | null;
  prospectName: string;
  prospectCompany: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-chart-5/10 text-chart-5',
  RUNNING: 'bg-primary/10 text-primary',
  COMPLETED: 'bg-chart-2/10 text-chart-2',
  FAILED: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted/40 text-muted-foreground',
};

const TASK_LABELS: Record<string, string> = {
  WEBSITE_ANALYST: 'Website Analysis',
  ICP_FIT: 'ICP Fit Assessment',
  PAIN_EXTRACTOR: 'Pain Signal Extraction',
  DISQUALIFIER_CHECK: 'Disqualifier Check',
};

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function timeAgo(date: number | null): string {
  if (!date) return '-';
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseSignals(raw: string | null): { signalName: string; matchStrength: string; evidenceQuote: string; sourceUrl: string }[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function TaskExpandedContent({ task, onChanged }: { task: TaskRow; onChanged: () => void }) {
  if (task.status === 'FAILED' || task.status === 'CANCELLED') {
    return (
      <div className="space-y-2">
        <p className="text-copy-13 text-destructive">{task.errorMessage || 'Unknown error'}</p>
        <button
          type="button"
          onClick={async () => {
            const result = await retryResearchTaskAction(task.id);
            if (result.success) {
              toast.success('Task queued for retry');
              onChanged();
            } else {
              toast.error('Failed to retry task');
            }
          }}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-label-12 hover:bg-muted/50 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  if (task.status === 'RUNNING') {
    return (
      <div className="flex items-center gap-3 text-copy-13 text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Running...
        </span>
        <button
          type="button"
          onClick={async () => {
            if (!confirm('Cancel this research task?')) return;
            const result = await cancelResearchTaskAction(task.id);
            if (result.success) {
              toast.success('Research task cancelled');
              onChanged();
            } else {
              toast.error(result.error || 'Failed to cancel task');
            }
          }}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-destructive/30 text-label-12 text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Ban className="w-3 h-3" />
          Cancel
        </button>
      </div>
    );
  }

  if (task.status === 'COMPLETED') {
    const signals = parseSignals(task.extractedSignals);
    if (signals.length === 0) {
      return <p className="text-copy-13 text-muted-foreground">No signals extracted.</p>;
    }
    return (
      <div className="space-y-2">
        {signals.map((s, i) => (
          <div key={i} className="border-l-2 border-border pl-3 space-y-1">
            <p className="text-copy-13 font-medium text-foreground">
              {s.signalName}
              <span className={`ml-2 text-label-12 font-semibold ${
                s.matchStrength === 'strong' ? 'text-chart-2' : s.matchStrength === 'partial' ? 'text-chart-5' : 'text-muted-foreground'
              }`}>
                {s.matchStrength}
              </span>
            </p>
            {s.evidenceQuote && (
              <p className="text-copy-13 italic text-muted-foreground">&ldquo;{s.evidenceQuote}&rdquo;</p>
            )}
            {s.sourceUrl && (
              <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-label-12 text-primary hover:underline">
                <ExternalLink className="w-3 h-3" />
                {s.sourceUrl}
              </a>
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function TaskRowView({ task, isExpanded, onToggle, onChanged }: { task: TaskRow; isExpanded: boolean; onToggle: () => void; onChanged: () => void }) {
  return (
    <>
      <tr className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
        <td className="px-2 py-3 w-8">
          <button
            type="button"
            onClick={onToggle}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-3 py-3">
          <span className="text-copy-14 font-medium">{task.prospectCompany || task.prospectName}</span>
        </td>
        <td className="px-3 py-3">
          <span className="text-copy-13 text-muted-foreground">
            {TASK_LABELS[task.taskType] || task.taskType}
          </span>
        </td>
        <td className="px-3 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold ${STATUS_COLORS[task.status] || 'bg-muted/10 text-muted-foreground'}`}>
            {task.status === 'RUNNING' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {task.status === 'COMPLETED' ? 'Done' : task.status === 'RUNNING' ? 'Running' : task.status === 'FAILED' ? 'Failed' : 'Pending'}
          </span>
        </td>
        <td className="px-3 py-3">
          {task.confidence !== null ? (
            <span className="text-label-12 text-muted-foreground">{task.confidence}%</span>
          ) : (
            <span className="text-copy-13 text-muted-foreground">--</span>
          )}
        </td>
        <td className="px-3 py-3">
          <span className="text-copy-13 text-muted-foreground">{timeAgo(task.startedAt || task.createdAt)}</span>
        </td>
      </tr>
      {isExpanded && (
        <tr key={`${task.id}-expanded`}>
          <td colSpan={6} className="px-3 py-3 bg-muted/10 border-b border-border/40">
            <div className="ml-8">
              <TaskExpandedContent task={task} onChanged={onChanged} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function ResearchQueueTable({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Group 4 tasks per prospect into a single row — one company, one row.
  const groups = (() => {
    const map = new Map<string, { prospectId: string; prospectName: string; prospectCompany: string | null; tasks: TaskRow[] }>();
    for (const t of tasks) {
      const g = map.get(t.prospectId) || { prospectId: t.prospectId, prospectName: t.prospectName, prospectCompany: t.prospectCompany, tasks: [] as TaskRow[] };
      g.tasks.push(t);
      map.set(t.prospectId, g);
    }
    return [...map.values()].map((g) => {
      const done = g.tasks.filter((t) => t.status === 'COMPLETED').length;
      const failed = g.tasks.filter((t) => t.status === 'FAILED').length;
      const cancelled = g.tasks.filter((t) => t.status === 'CANCELLED').length;
      const running = g.tasks.filter((t) => t.status === 'RUNNING').length;
      const terminal = done + failed + cancelled === g.tasks.length;
      const overall = failed > 0 && terminal ? 'FAILED'
        : running > 0 ? 'RUNNING'
        : done === g.tasks.length ? 'COMPLETED'
        : terminal && cancelled > 0 ? 'CANCELLED'
        : failed > 0 ? 'FAILED'
        : cancelled > 0 && done + cancelled === g.tasks.length ? 'CANCELLED'
        : 'PENDING';
      const confs = g.tasks.map((t) => t.confidence).filter((c): c is number => typeof c === 'number');
      const confidence = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null;
      const earliest = Math.min(...g.tasks.map((t) => t.createdAt || t.startedAt || Date.now()));
      return { ...g, done, total: g.tasks.length, overall, confidence, earliest };
    }).sort((a, b) => b.earliest - a.earliest);
  })();

  const filtered = statusFilter === 'all' ? groups : groups.filter((g) => g.overall === statusFilter || g.tasks.some((t) => t.status === statusFilter));
  const counts = STATUS_FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f.value] = f.value === 'all' ? groups.length : groups.filter((g) => g.overall === f.value).length;
    return acc;
  }, {});

  const handleChanged = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/25 p-1 w-fit">
        {STATUS_FILTERS.map((opt) => {
          const isSelected = statusFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setStatusFilter(opt.value); setExpanded(null); }}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-3.5 text-label-12 font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                isSelected
                  ? 'bg-card text-foreground shadow-sm border border-border/40'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
              }`}
            >
              {opt.label}
              <span className={`text-label-11 ${isSelected ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                ({counts[opt.value]})
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="w-8 px-2 py-3" />
              <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Prospect</th>
              <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Progress</th>
              <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Tasks</th>
              <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Status</th>
              <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Confidence</th>
              <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Started</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-copy-13 text-muted-foreground">
                  No prospects match this status filter.
                </td>
              </tr>
            ) : (
              filtered.map((g) => {
                const isExpanded = expanded === g.prospectId;
                return (
                  <>
                    <tr key={g.prospectId} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-2 py-3 w-8">
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : g.prospectId)}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <a href={`/prospects/${g.prospectId}`} className="text-copy-14 font-medium hover:text-primary hover:underline">
                          {g.prospectCompany || g.prospectName}
                        </a>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-label-12 text-muted-foreground">{g.done}/{g.total} done</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex flex-wrap gap-1">
                          {g.tasks.map((t) => (
                            <span key={t.id} title={`${TASK_LABELS[t.taskType] || t.taskType}: ${t.status}`} className={`inline-flex items-center px-1.5 py-0.5 rounded text-label-11 font-semibold ${STATUS_COLORS[t.status] || 'bg-muted/10 text-muted-foreground'}`}>
                              {(TASK_LABELS[t.taskType] || t.taskType).split(' ')[0]}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold ${STATUS_COLORS[g.overall] || 'bg-muted/10 text-muted-foreground'}`}>
                          {g.overall === 'COMPLETED' ? 'Done' : g.overall === 'RUNNING' ? 'Running' : g.overall === 'FAILED' ? 'Failed' : g.overall === 'CANCELLED' ? 'Cancelled' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {g.confidence !== null ? (
                          <span className="text-label-12 text-muted-foreground">{g.confidence}%</span>
                        ) : (
                          <span className="text-copy-13 text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-copy-13 text-muted-foreground">{timeAgo(g.earliest)}</span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${g.prospectId}-expanded`}>
                        <td colSpan={7} className="px-3 py-3 bg-muted/10 border-b border-border/40">
                          <div className="ml-8 space-y-3">
                            {g.tasks.map((task) => (
                              <div key={task.id} className="border-l-2 border-border pl-3">
                                <p className="text-copy-13 font-medium">
                                  {TASK_LABELS[task.taskType] || task.taskType}
                                  <span className={`ml-2 text-label-12 ${STATUS_COLORS[task.status] || ''} px-1.5 py-0.5 rounded`}>{task.status}</span>
                                </p>
                                <TaskExpandedContent task={task} onChanged={handleChanged} />
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
