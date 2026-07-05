export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { PipelineAutomationCard } from '@/components/settings/PipelineAutomationCard';
import { LearningSuggestionsInbox } from '@/components/prospects/LearningSuggestionsInbox';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { workspaces } from '@/db/schema/strategy';
import { pipelineConfig } from '@/db/schema/core';
import { eq } from 'drizzle-orm';
import { LearningService } from '@/services/learning';
import { PIPELINE_STAGES } from '@/services/lead';

export const metadata = {
  title: 'Pipeline Preferences | Leadroom',
};

export default async function PipelineSettingsPage() {
  const db = getDb();
  const [pcRow, workspaceRows] = await Promise.all([
    db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1).then((r) => r[0] || null),
    db.select().from(workspaces).limit(1),
  ]);

  const config = pcRow?.stageRequirements
    ? (typeof pcRow.stageRequirements === 'object' ? pcRow.stageRequirements : {})
    : {};

  return (
    <div className="space-y-8 max-w-4xl">
      <PipelineAutomationCard
        stages={PIPELINE_STAGES as unknown as string[]}
        initialConfig={config as Record<string, unknown>}
      />

      {workspaceRows.length > 0 && (
        <Card className="border border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/20 pb-4">
            <CardTitle className="text-heading-lg">ICP Optimization Suggestions</CardTitle>
            <CardDescription className="text-copy-14 mt-1">
              Based on outcome data, the system suggests adjustments to your ICP profile.
              Review and apply suggestions to improve scoring accuracy.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <LearningSuggestionsInbox
              suggestions={(await new LearningService(db).getPendingSuggestions(workspaceRows[0].id)).map((s) => ({
                id: s.id,
                suggestedChange: s.suggestedChange ?? '{}',
                supportingEvidence: s.supportingEvidence ?? '{}',
                createdAt: s.createdAt,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
