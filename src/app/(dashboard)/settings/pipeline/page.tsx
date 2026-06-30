export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { LeadService } from '@/services/lead';
import { LearningService } from '@/services/learning';
import { StageThresholdsTable } from '@/components/settings/StageThresholdsTable';
import { PlaybooksEditor } from '@/components/settings/PlaybooksEditor';
import { StageRequirementsEditor } from '@/components/settings/StageRequirementsEditor';
import { LearningSuggestionsInbox } from '@/components/prospects/LearningSuggestionsInbox';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { workspaces } from '@/db/schema/strategy';
import { playbooks, playbookTasks, pipelineConfig } from '@/db/schema/core';
import { eq } from 'drizzle-orm';

export const metadata = {
  title: 'Pipeline Preferences | Leadroom',
};

export default async function PipelineSettingsPage() {
  const db = getDb();
  const [thresholdRows, playbookRows, taskRows, pcRow, workspaceRows] = await Promise.all([
    new LeadService(db).getStageThresholds(),
    db.select().from(playbooks),
    db.select().from(playbookTasks),
    db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1).then((r) => r[0] || null),
    db.select().from(workspaces).limit(1),
  ]);

  const tasksByPlaybook = new Map<string, typeof taskRows>();
  for (const t of taskRows) {
    const list = tasksByPlaybook.get(t.playbookId) || [];
    list.push(t);
    tasksByPlaybook.set(t.playbookId, list);
  }

  const playbookData = playbookRows.map((pb) => ({
    id: pb.id,
    stage: pb.stage,
    name: pb.name,
    isActive: pb.isActive,
    tasks: (tasksByPlaybook.get(pb.id) || []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      daysOffset: t.daysOffset,
      priority: t.priority,
      category: t.category,
      actionType: (t as any).actionType || 'TASK',
      jobType: (t as any).jobType || null,
    })),
  }));

  return (
    <div className="space-y-8 max-w-4xl">
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

          <StageThresholdsTable initialThresholds={thresholdRows} />
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="border-b border-border bg-muted/20 pb-4">
          <CardTitle className="text-heading-lg">Stage Playbooks</CardTitle>
          <CardDescription className="text-copy-14 mt-1">
            Define automated task sequences that spawn when a lead enters a stage. Tasks are created with due dates relative to the stage entry date.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <PlaybooksEditor initialPlaybooks={playbookData} />
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="border-b border-border bg-muted/20 pb-4">
          <CardTitle className="text-heading-lg">Stage Requirements</CardTitle>
          <CardDescription className="text-copy-14 mt-1">
            Block forward stage transitions until required artifacts exist. Configure which checks are enforced per stage.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <StageRequirementsEditor initialRequirements={(pcRow?.stageRequirements as Record<string, string[]>) || {}} />
        </CardContent>
      </Card>

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
