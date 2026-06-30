export const dynamic = 'force-dynamic';
import { LeadService, DEFAULT_NBA_RULES } from '@/services/lead';
import { ResearchService } from '@/services/research';
import { AuditService } from '@/services/audits';
import { ScoringService } from '@/services/scoring';
import { getDb } from '@/db';
import { stageThresholds, pipelineConfig, tasks } from '@/db/schema/core';
import { and, eq, or, like } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import LeadDetailsWorkspace from './LeadDetailsWorkspace';
import { OutreachService } from '@/services/outreach';
import { jobRuns } from '@/db/schema/research';

type LeadWorkspaceView = 'overview' | 'research' | 'outreach' | 'activity';

const WORKSPACE_VIEWS = new Set<LeadWorkspaceView>(['overview', 'research', 'outreach', 'activity']);

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ autoEnrich?: string; view?: string; channel?: string }> }) {
  const { id } = await params;
  let { view, channel } = await searchParams;
  if (view === 'audit') view = 'research';
  const db = getDb();
  const service = new LeadService(db);
  const researchService = new ResearchService(db);

  const lead = await service.getLead(id);
  if (!lead) notFound();

  const auditService = new AuditService(db);
  const scoringService = new ScoringService(db);
  const outreachService = new OutreachService(db);

  const [notes, tasksData, activities, latestSnapshot, contactsList, latestAudit, currentScore, outreachDrafts, activeResearchJob, stageThresholdRow, pcRow, nextFollowUp, unmetRequirements] = await Promise.all([
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
      .then(rows => rows[0] || null),
    db.select({ days: stageThresholds.days }).from(stageThresholds).where(eq(stageThresholds.stage, lead.stage)).limit(1).then(r => r[0]),
    db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1).then(r => r[0] || null),
    db.select({ dueDate: tasks.dueDate }).from(tasks).where(and(eq(tasks.leadId, id), eq(tasks.status, 'Open'), like(tasks.title, 'Follow up on %'))).orderBy(tasks.dueDate).limit(1).then(r => r[0] || null),
    service.getUnmetStageRequirements(id, lead.email || null),
  ]);

  const stageThreshold = stageThresholdRow?.days ?? 5;

  let nbaRules = DEFAULT_NBA_RULES;
  if (pcRow?.nbaRules) {
    try { nbaRules = JSON.parse(pcRow.nbaRules); } catch {}
  }
  const nbaResults = await service.getNextBestActions(id, nbaRules);

  const STAGE_MAP: Record<string, string> = {
    'Researching': 'In Research',
    'Qualified': 'Audited',
    'Outreach in Progress': 'Outreach Sent',
    'Meeting / Call': 'Meeting',
  };
  const displayStage = STAGE_MAP[lead.stage] || lead.stage || 'New';
  const stages = ['New', 'In Research', 'Auditing', 'Audited', 'Drafting', 'Ready to Send', 'Outreach Sent', 'Meeting', 'Won', 'Lost'];

  return (
    <LeadDetailsWorkspace
      lead={lead}
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
      initialView={WORKSPACE_VIEWS.has(view as LeadWorkspaceView) ? view as LeadWorkspaceView : 'overview'}
      initialChannel={channel}
      stageThreshold={stageThreshold}
      nbaResults={nbaResults}
      autoFollowUpDue={nextFollowUp?.dueDate ?? null}
      unmetRequirements={unmetRequirements}
    />
  );
}
