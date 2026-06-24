export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { LeadService } from '@/services/lead';
import { StageThresholdsTable } from '@/components/settings/StageThresholdsTable';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'Pipeline Preferences | Leadroom',
};

export default async function PipelineSettingsPage() {
  const rows = await new LeadService(getDb()).getStageThresholds();

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="border border-border shadow-sm">
        <CardHeader className="border-b border-border bg-muted/20 pb-4">
          <CardTitle className="text-heading-lg">Pipeline Staleness Rules</CardTitle>
          <CardDescription className="text-copy-14 mt-1">
            Configure age limits for leads in each stage. Leads that remain inactive in a stage longer than these limits will be highlighted as stale.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="mb-4 text-label-12 text-muted-foreground bg-muted/40 p-3 rounded-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>
              💡 Edit any row and press <kbd className="px-1.5 py-0.5 text-mono-12 bg-background border border-border rounded-md shadow-sm">Enter</kbd> to save immediately.
            </span>
            <span>
              You can also batch edit and use the global action bar at the bottom.
            </span>
          </div>

          <StageThresholdsTable initialThresholds={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
