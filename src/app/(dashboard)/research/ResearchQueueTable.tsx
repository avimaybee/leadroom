'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Loader2, RotateCcw, ExternalLink } from 'lucide-react';
import { retryResearchTaskAction } from '@/app/actions/research';
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
};

const TASK_LABELS: Record<string, string> = {
  WEBSITE_ANALYST: 'Website Analysis',
  ICP_FIT: 'ICP Fit Assessment',
  PAIN_EXTRACTOR: 'Pain Signal Extraction',
  DISQUALIFIER_CHECK: 'Disqualifier Check',
};

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

function TaskExpandedContent({ task }: { task: TaskRow }) {
  if (task.status === 'FAILED') {
    return (
      <div className="space-y-2">
        <p className="text-copy-13 text-destructive">{task.errorMessage || 'Unknown error'}</p>
        <button
          type="button"
          onClick={async () => {
            const result = await retryResearchTaskAction(task.id);
            if (result.success) {
              toast.success('Task queued for retry');
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
      <div className="flex items-center gap-2 text-copy-13 text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Running...
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

function TaskRow({ task, isExpanded, onToggle }: { task: TaskRow; isExpanded: boolean; onToggle: () => void }) {
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
              <TaskExpandedContent task={task} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function ResearchQueueTable({ tasks }: { tasks: TaskRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/20">
            <th className="w-8 px-2 py-3" />
            <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Prospect</th>
            <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Task</th>
            <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Status</th>
            <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Confidence</th>
            <th className="text-left px-3 py-3 text-label-12 text-muted-foreground">Started</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isExpanded={expanded === task.id}
              onToggle={() => setExpanded(expanded === task.id ? null : task.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
