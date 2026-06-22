'use client';

import { memo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEFAULT_DAYS = 5;

interface StageThresholdDbRow {
  stage: string;
  days: number;
  updatedAt: Date | null;
}

interface StageThresholdRowProps {
  stage: string;
  /** Current value in this row's input (controlled by parent) */
  value: number | '';
  /** Whether this row has been modified from its last-saved state */
  isDirty: boolean;
  /** Whether the current value is invalid (≤0 or empty) */
  isInvalid: boolean;
  /** Whether a save is currently in-flight for this row */
  isSaving: boolean;
  /** DB row — null means no custom threshold exists (using default) */
  dbRow: StageThresholdDbRow | null;
  onChange: (stage: string, value: number | '') => void;
  onInlineSave: (stage: string) => void;
  onReset: (stage: string) => void;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatusBadge({ dbRow, isDirty }: { dbRow: StageThresholdDbRow | null; isDirty: boolean }) {
  if (isDirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-chart-5 bg-chart-5/10 border border-chart-5/20 rounded-full px-2.5 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-chart-5 animate-pulse" />
        Unsaved
      </span>
    );
  }

  if (!dbRow) {
    return (
      <span className="text-xs font-medium text-muted-foreground bg-muted/50 border border-border rounded-full px-2.5 py-0.5">
        Default
      </span>
    );
  }

  const relative = dbRow.updatedAt ? formatRelativeTime(new Date(dbRow.updatedAt)) : null;
  const exact = dbRow.updatedAt ? new Date(dbRow.updatedAt).toLocaleString() : null;

  return (
    <span
      title={exact ?? undefined}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5 cursor-default"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      Custom{relative ? ` · ${relative}` : ''}
    </span>
  );
}

export const StageThresholdRow = memo(function StageThresholdRow({
  stage,
  value,
  isDirty,
  isInvalid,
  isSaving,
  dbRow,
  onChange,
  onInlineSave,
  onReset,
}: StageThresholdRowProps) {
  const showReset = dbRow !== null && !isDirty;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onInlineSave(stage);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === '') {
      onChange(stage, '');
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      onChange(stage, parsed);
    }
  }

  return (
    <div
      className={`group flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors ${
        isInvalid && isDirty
          ? 'border-destructive/40 bg-destructive/5'
          : isDirty
          ? 'border-chart-5/30 bg-chart-5/5'
          : 'border-border bg-card hover:bg-muted/30'
      }`}
    >
      {/* Stage name */}
      <span className="flex-1 text-sm font-semibold text-foreground truncate">{stage}</span>

      {/* Status badge */}
      <div className="hidden sm:flex w-40 justify-start">
        <StatusBadge dbRow={dbRow} isDirty={isDirty} />
      </div>

      {/* Input + "days" suffix */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Input
              id={`threshold-${stage}`}
              type="number"
              min={1}
              step={1}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              aria-invalid={isInvalid && isDirty}
              aria-label={`Staleness threshold for ${stage} stage`}
              className="w-20 text-center text-sm font-medium tabular-nums"
            />
            <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">days</span>
          </div>
          {isInvalid && isDirty && (
            <p className="text-[11px] text-destructive font-medium">Must be at least 1 day</p>
          )}
        </div>

        {/* Reset icon button — only visible on custom rows, shows on hover */}
        <div className={`transition-opacity ${showReset ? 'opacity-0 group-hover:opacity-100 focus-within:opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onReset(stage)}
            disabled={isSaving}
            title={`Reset "${stage}" to default (${DEFAULT_DAYS} days)`}
            aria-label={`Reset ${stage} to default`}
            tabIndex={showReset ? 0 : -1}
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </div>
  );
});
