export const dynamic = 'force-dynamic';
import { LeadService } from '@/services/lead';
import { ResearchService } from '@/services/research';
import { AuditService } from '@/services/audits';
import { ScoringService } from '@/services/scoring';
import { getDb } from '@/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDateTimeUTC } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { 
  updateStageAction, 
  addNoteAction,
  updateLeadAction
} from '@/app/actions/leads';
import { 
  createTaskAction, 
  toggleTaskStatusAction 
} from '@/app/actions/tasks';
import { 
  saveResearchSnapshotAction, 
  addContactAction,
  updateContactAction,
  deleteContactAction
} from '@/app/actions/research';
import { 
  manualOverrideScoreAction 
} from '@/app/actions/audits';
import { jobRuns } from '@/db/schema/research';
import { and, eq, or } from 'drizzle-orm';
import LeadDetailsWorkspace from './LeadDetailsWorkspace';
import { OutreachService } from '@/services/outreach';



export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ autoEnrich?: string }> }) {
  const { id } = await params;
  const { autoEnrich } = await searchParams;
  const env = (process as any).env;
  const db = getDb();
  const service = new LeadService(db);
  const researchService = new ResearchService(db);

  const lead = await service.getLead(id);
  if (!lead) notFound();

  const auditService = new AuditService(db);
  const scoringService = new ScoringService(db);
  const outreachService = new OutreachService(db);

  const [notes, tasks, activities, latestSnapshot, contactsList, latestAudit, currentScore, outreachDrafts, activeResearchJob] = await Promise.all([
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
          or(
            eq(jobRuns.status, 'QUEUED'),
            eq(jobRuns.status, 'RUNNING')
          )
        )
      )
      .limit(1)
      .then(rows => rows[0] || null),
  ]);

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
      tasks={tasks}
      activities={activities}
      latestSnapshot={latestSnapshot}
      contactsList={contactsList}
      latestAudit={latestAudit}
      currentScore={currentScore}
      outreachDrafts={outreachDrafts}
      activeResearchJob={activeResearchJob}
      displayStage={displayStage}
      stages={stages}
    />
  );
}
