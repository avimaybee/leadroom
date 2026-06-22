export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { stageThresholds } from '@/db/schema/core';
import Link from 'next/link';
import { StageThresholdsTable } from '@/components/settings/StageThresholdsTable';

export const metadata = {
  title: 'Preferences | Leadroom',
};

export default async function PipelineSettingsPage() {
  const db = getDb();
  const rows = await db.select().from(stageThresholds);

  return (
    <div className="max-w-3xl">
      {/* Settings sub-nav */}
      <div className="flex items-center gap-1 mb-6 border-b border-border pb-4">
        <Link
          href="/settings/pipeline"
          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground"
          aria-current="page"
        >
          Preferences
        </Link>
        <Link
          href="/settings/integrations"
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Integrations
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-card-foreground tracking-tight">Preferences</h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
          Staleness thresholds — flag leads idle longer than this many days in each pipeline stage.
          Edit any row and press <kbd className="px-1 py-0.5 text-xs font-mono bg-muted border border-border rounded">Enter</kbd> to save a single row,
          or use <span className="font-semibold">Save Changes</span> to batch-save all edits at once.
        </p>
      </div>

      {/* The interactive table */}
      <StageThresholdsTable initialThresholds={rows} />
    </div>
  );
}
