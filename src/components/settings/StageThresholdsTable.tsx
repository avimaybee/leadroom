'use client';

import { useState, useCallback } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { StageThresholdRow } from './StageThresholdRow';
import { updateStageThreshold } from '@/app/actions/pipeline';
import { PIPELINE_STAGES } from '@/services/lead';

const DEFAULT_DAYS = 5;

interface StageThresholdDbRow {
  stage: string;
  days: number;
  updatedAt: Date | null;
}

interface Props {
  /** All threshold rows that exist in the DB (stages not present = using default) */
  initialThresholds: StageThresholdDbRow[];
}

type RowValues = Record<string, number | ''>;
type DirtySet = Set<string>;
// Per-row "last saved" snapshot so Discard knows what to reset to
type SavedValues = Record<string, number>;
// Track DB row metadata for status badge
type DbRows = Record<string, StageThresholdDbRow>;

function buildInitialState(initialThresholds: StageThresholdDbRow[]) {
  const dbRows: DbRows = {};
  const values: RowValues = {};
  const saved: SavedValues = {};

  for (const row of initialThresholds) {
    dbRows[row.stage] = row;
  }

  for (const stage of PIPELINE_STAGES) {
    const dbRow = dbRows[stage] ?? null;
    const days = dbRow ? dbRow.days : DEFAULT_DAYS;
    values[stage] = days;
    saved[stage] = days;
  }

  return { dbRows, values, saved };
}

export function StageThresholdsTable({ initialThresholds }: Props) {
  const [values, setValues] = useState<RowValues>(() => buildInitialState(initialThresholds).values);
  const [savedValues, setSavedValues] = useState<SavedValues>(() => buildInitialState(initialThresholds).saved);
  const [dbRows, setDbRows] = useState<DbRows>(() => buildInitialState(initialThresholds).dbRows);
  const [dirtySet, setDirtySet] = useState<DirtySet>(new Set());
  const [savingStages, setSavingStages] = useState<Set<string>>(new Set());

  // --- Derived ---
  const dirtyArray = Array.from(dirtySet);
  const invalidStages = dirtyArray.filter((s) => {
    const v = values[s];
    return v === '' || (typeof v === 'number' && (v < 1 || !Number.isInteger(v)));
  });
  const validDirty = dirtyArray.filter((s) => !invalidStages.includes(s));
  const hasDirty = dirtySet.size > 0;
  const allDirtyInvalid = hasDirty && validDirty.length === 0;

  // --- Handlers ---
  const handleChange = useCallback((stage: string, value: number | '') => {
    setValues((prev) => ({ ...prev, [stage]: value }));
    setDirtySet((prev) => {
      const next = new Set(prev);
      // If value reverted to last saved, remove from dirty
      const isRevert = typeof value === 'number' && value === savedValues[stage];
      if (isRevert) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  }, [savedValues]);

  async function saveStages(stages: string[]): Promise<{ succeeded: string[]; failed: string[] }> {
    setSavingStages((prev) => {
      const next = new Set(prev);
      for (const s of stages) next.add(s);
      return next;
    });

    const succeeded: string[] = [];
    const failed: string[] = [];

    await Promise.all(
      stages.map(async (stage) => {
        try {
          const v = values[stage];
          if (typeof v !== 'number' || v < 1) throw new Error('invalid');
          await updateStageThreshold(stage, v);
          succeeded.push(stage);
        } catch {
          failed.push(stage);
        }
      })
    );

    setSavingStages((prev) => {
      const next = new Set(prev);
      for (const s of stages) next.delete(s);
      return next;
    });

    return { succeeded, failed };
  }


  const handleBatchSave = useCallback(async () => {
    if (validDirty.length === 0) return;

    const { succeeded, failed } = await saveStages(validDirty);

    if (succeeded.length > 0) {
      // Update saved values and dbRows for succeeded
      setSavedValues((prev) => {
        const next = { ...prev };
        for (const stage of succeeded) {
          const v = values[stage];
          if (typeof v === 'number') next[stage] = v;
        }
        return next;
      });
      setDbRows((prev) => {
        const next = { ...prev };
        for (const stage of succeeded) {
          const v = values[stage];
          next[stage] = {
            stage,
            days: typeof v === 'number' ? v : DEFAULT_DAYS,
            updatedAt: new Date(),
          };
        }
        return next;
      });
      setDirtySet((prev) => {
        const next = new Set(prev);
        for (const stage of succeeded) next.delete(stage);
        return next;
      });
    }

    if (failed.length > 0 && succeeded.length > 0) {
      toast.error(`Some changes couldn't be saved (${failed.length} failed). Retry to save remaining changes.`);
    } else if (failed.length > 0) {
      toast.error(`Failed to save changes. Please try again.`);
    } else {
      toast.success('Preferences updated');
    }
  }, [validDirty, values]);

  const handleInlineSave = useCallback(async (stage: string) => {
    const v = values[stage];
    if (typeof v !== 'number' || v < 1) return;
    if (!dirtySet.has(stage)) return;

    const { succeeded, failed } = await saveStages([stage]);

    if (succeeded.includes(stage)) {
      setSavedValues((prev) => ({ ...prev, [stage]: v }));
      setDbRows((prev) => ({
        ...prev,
        [stage]: { stage, days: v, updatedAt: new Date() },
      }));
      setDirtySet((prev) => {
        const next = new Set(prev);
        next.delete(stage);
        return next;
      });
      toast.success(`${stage} threshold saved`);
    } else if (failed.includes(stage)) {
      toast.error(`Failed to save ${stage}. Please try again.`);
    }
  }, [values, dirtySet]);

  const handleReset = useCallback((stage: string) => {
    setValues((prev) => ({ ...prev, [stage]: DEFAULT_DAYS }));
    // Mark dirty so batch save will persist the reset value (even if same as previous)
    setDirtySet((prev) => {
      const next = new Set(prev);
      const currentSaved = savedValues[stage];
      if (currentSaved === DEFAULT_DAYS) {
        // No actual change needed
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  }, [savedValues]);

  const handleDiscard = useCallback(() => {
    setValues((prev) => {
      const next = { ...prev };
      for (const stage of dirtyArray) {
        next[stage] = savedValues[stage] ?? DEFAULT_DAYS;
      }
      return next;
    });
    setDirtySet(new Set());
  }, [dirtyArray, savedValues]);

  const isBatchSaving = savingStages.size > 0;

  return (
    <div className="relative">
      {/* Table header */}
      <div className="hidden sm:grid grid-cols-[1fr_160px_auto] gap-4 px-4 pb-2 border-b border-border mb-2">
        <span className="text-label-12 text-muted-foreground uppercase">Stage</span>
        <span className="text-label-12 text-muted-foreground uppercase">Status</span>
        <span className="text-label-12 text-muted-foreground uppercase">Threshold</span>
      </div>

      {/* Stage rows */}
      <div className="space-y-1.5">
        {(PIPELINE_STAGES as readonly string[]).map((stage) => {
          const v = values[stage];
          const isDirty = dirtySet.has(stage);
          const isInvalid =
            v === '' || (typeof v === 'number' && (v < 1 || !Number.isInteger(v)));
          const isSaving = savingStages.has(stage);

          return (
            <StageThresholdRow
              key={stage}
              stage={stage}
              value={v}
              isDirty={isDirty}
              isInvalid={isInvalid}
              isSaving={isSaving}
              dbRow={dbRows[stage] ?? null}
              onChange={handleChange}
              onInlineSave={handleInlineSave}
              onReset={handleReset}
            />
          );
        })}
      </div>

      {/* Sticky save bar — appears only when there are dirty rows */}
      {hasDirty && (
        <div className="sticky bottom-0 mt-4 -mx-1 px-4 py-3 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-sm shadow-lg flex items-center justify-between gap-4 z-10">
          <p className="text-label-14 font-semibold text-foreground">
            {dirtySet.size === 1
              ? '1 unsaved change'
              : `${dirtySet.size} unsaved changes`}
            {invalidStages.length > 0 && (
              <span className="ml-2 text-destructive font-medium">
                ({invalidStages.length} invalid)
              </span>
            )}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={isBatchSaving}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleBatchSave}
              disabled={isBatchSaving || allDirtyInvalid}
            >
              {isBatchSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
