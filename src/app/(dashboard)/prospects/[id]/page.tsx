export const dynamic = 'force-dynamic';

import { LeadService, DEFAULT_NBA_RULES } from '@/services/lead';
import { ResearchService } from '@/services/research';
import { AuditService } from '@/services/audits';
import { ScoringService } from '@/services/scoring';
import { OutreachService } from '@/services/outreach';
import { getDb } from '@/db';
import { stageThresholds, pipelineConfig, tasks, jobRuns, researchTasks } from '@/db/schema';
import { and, eq, or, like } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { getUserId } from '@/lib/auth';
import ProspectDetailsWorkspace from './ProspectDetailsWorkspace';

type WorkspaceView = 'overview' | 'research' | 'outreach' | 'activity';

export default async function ProspectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoEnrich?: string; view?: string; channel?: string }>;
}) {
  const { id } = await params;
  let { view, channel } = await searchParams;
  if (view === 'audit') view = 'research';

  const userId = await getUserId();
  if (!userId) redirect('/login');

  const db = getDb();
  const service = new LeadService(db);
  const researchService = new ResearchService(db);
  const auditService = new AuditService(db);
  const scoringService = new ScoringService(db);
  const outreachService = new OutreachService(db);

  // Fetch all prospect details ensuring they belong to the current authenticated user
  const prospect = await service.getLead(id);
  // Security gate: Ensure prospect exists and belongs to the logged-in user
  if (!prospect || prospect.ownerId !== userId) {
    notFound();
  }

  const [
    notes,
    tasksData,
    activities,
    latestSnapshot,
    contactsList,
    latestAudit,
    currentScore,
    outreachDrafts,
    activeResearchJob,
    stageThresholdRow,
    pcRow,
    nextFollowUp,
    unmetRequirements,
    leadResearchTasks,
  ] = await Promise.all([
    service.getNotes(id),
    service.getTasks(id),
    service.getActivities(id),
    researchService.getLatestResearch(id),
    researchService.getContacts(id),
    auditService.getLatestAudit(id),
    scoringService.getCurrentScore(id),
    outreachService.getDraftsForLead(id),
    db
      .select({ id: jobRuns.id, status: jobRuns.status })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.targetLeadId, id),
          eq(jobRuns.jobType, 'RESEARCH_GENERATION'),
          or(eq(jobRuns.status, 'QUEUED'), eq(jobRuns.status, 'RUNNING'))
        )
      )
      .limit(1)
      .then((rows) => rows[0] || null),
    db
      .select({ days: stageThresholds.days })
      .from(stageThresholds)
      .where(eq(stageThresholds.stage, prospect.stage))
      .limit(1)
      .then((r) => r[0] || null),
    db
      .select()
      .from(pipelineConfig)
      .where(eq(pipelineConfig.id, 'global'))
      .limit(1)
      .then((r) => r[0] || null),
    db
      .select({ dueDate: tasks.dueDate })
      .from(tasks)
      .where(
        and(
          eq(tasks.leadId, id),
          eq(tasks.status, 'Open'),
          like(tasks.title, 'Follow up on %')
        )
      )
      .orderBy(tasks.dueDate)
      .limit(1)
      .then((r) => r[0] || null),
    service.getUnmetStageRequirements(id, prospect.email || null),
    db
      .select({
        taskType: researchTasks.taskType,
        status: researchTasks.status,
        extractedSignals: researchTasks.extractedSignals,
        confidence: researchTasks.confidence,
        errorMessage: researchTasks.errorMessage,
      })
      .from(researchTasks)
      .where(eq(researchTasks.prospectId, id))
      .orderBy(researchTasks.createdAt),
  ]);

  const stageThreshold = stageThresholdRow?.days ?? 5;

  let nbaRules: typeof DEFAULT_NBA_RULES = DEFAULT_NBA_RULES;
  if (pcRow?.nbaRules) {
    nbaRules = pcRow.nbaRules as typeof DEFAULT_NBA_RULES;
  }
  const nbaResults = await service.getNextBestActions(id, nbaRules, {
    tasks: tasksData,
    hasResearch: !!latestSnapshot,
    hasAudit: !!latestAudit,
    hasDraft: outreachDrafts.some((d) => d.status === 'DRAFT'),
  });

  const STAGE_MAP: Record<string, string> = {
    Researching: 'In Research',
    Qualified: 'Audited',
    'Outreach in Progress': 'Outreach Sent',
    'Meeting / Call': 'Meeting',
  };
  const displayStage = STAGE_MAP[prospect.stage] || prospect.stage || 'New';
  const stages = [
    'New',
    'In Research',
    'Auditing',
    'Audited',
    'Drafting',
    'Ready to Send',
    'Outreach Sent',
    'Meeting',
    'Won',
    'Lost',
  ];

  return (
    <ProspectDetailsWorkspace
      lead={prospect}
      notes={notes}
      tasks={tasksData}
      activities={activities}
      latestSnapshot={latestSnapshot}
      contactsList={contactsList}
      latestAudit={latestAudit}
      currentScore={currentScore}
      outreachDrafts={outreachDrafts}
      activeResearchJob={activeResearchJob}
      displayStage={displayStage}
      stages={stages}
      initialView={(view as WorkspaceView) || 'overview'}
      initialChannel={channel}
      stageThreshold={stageThreshold}
      nbaResults={nbaResults}
      autoFollowUpDue={nextFollowUp?.dueDate}
      unmetRequirements={unmetRequirements as any}
      researchTasks={leadResearchTasks}
    />
  );
}
