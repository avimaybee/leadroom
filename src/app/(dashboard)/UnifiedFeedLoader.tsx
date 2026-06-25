'use server';

import { getDb } from '@/db';
import { eq, desc, and } from 'drizzle-orm';
import { leads, tasks, stageThresholds } from '@/db/schema/core';
import { outreachDrafts } from '@/db/schema/outreach';
import { leadScores } from '@/db/schema/audits';
import UnifiedActionFeed, { UnifiedItem } from '@/components/dashboard/UnifiedActionFeed';

export default async function UnifiedFeedLoader() {
  const db = getDb();
  
  const [activeLeads, openTasks, draftOutreach, thresholdsData, currentScores] = await Promise.all([
    db.select().from(leads).where(eq(leads.status, 'Active')),
    db.select({
      task: tasks,
      leadName: leads.name
    }).from(tasks).leftJoin(leads, eq(tasks.leadId, leads.id)).where(eq(tasks.status, 'Open')),
    db.select({
      draft: outreachDrafts,
      leadName: leads.name
    }).from(outreachDrafts).leftJoin(leads, eq(outreachDrafts.leadId, leads.id)).where(eq(outreachDrafts.status, 'DRAFT')),
    db.select().from(stageThresholds),
    db.select({ leadId: leadScores.leadId, scoreValue: leadScores.scoreValue }).from(leadScores).where(eq(leadScores.isCurrent, 1))
  ]);

  const thresholds = thresholdsData.reduce((acc, t) => {
    acc[t.stage] = t.days;
    return acc;
  }, {} as Record<string, number>);

  const scoreMap = currentScores.reduce((acc, s) => {
    acc[s.leadId] = s.scoreValue;
    return acc;
  }, {} as Record<string, number>);

  const now = new Date().getTime();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const staleLeads = activeLeads.filter(l => {
    const defaultThreshold = 5;
    const thresholdDays = thresholds[l.stage] ?? defaultThreshold;
    const thresholdMs = thresholdDays * MS_PER_DAY;
    
    const lastActivityTime = l.lastActivityAt 
      ? new Date(l.lastActivityAt).getTime() 
      : (l.stageUpdatedAt ? new Date(l.stageUpdatedAt).getTime() : (l.createdAt ? new Date(l.createdAt).getTime() : now));
      
    return (now - lastActivityTime) > thresholdMs;
  });

  let items: UnifiedItem[] = [];

  staleLeads.forEach(l => {
    const lastActivityTime = l.lastActivityAt 
      ? new Date(l.lastActivityAt).getTime() 
      : (l.stageUpdatedAt ? new Date(l.stageUpdatedAt).getTime() : (l.createdAt ? new Date(l.createdAt).getTime() : now));
    
    const stalenessDays = Math.max(0, (now - lastActivityTime) / MS_PER_DAY);
    const leadValue = scoreMap[l.id] || 0;
    const overdueDays = 0;
    const score = (overdueDays * 1.5) + (leadValue * 1.2) + (stalenessDays * 1.0);

    items.push({
      id: l.id,
      type: 'lead',
      title: `Stale Lead: ${l.name}${l.company ? ` at ${l.company}` : ''}`,
      subtitle: `Idle in ${l.stage}`,
      date: l.lastActivityAt || l.stageUpdatedAt || l.createdAt,
      isRead: l.isRead,
      link: `/leads/${l.id}`,
      status: 'Needs Attention',
      priority: 'High',
      score,
      isUrgent: score > 90, // example threshold
    });
  });

  openTasks.forEach(t => {
    let overdueDays = 0;
    if (t.task.dueDate) {
      const dueTime = new Date(t.task.dueDate).getTime();
      if (now > dueTime) {
        overdueDays = (now - dueTime) / MS_PER_DAY;
      }
    }
    const leadValue = t.task.leadId ? (scoreMap[t.task.leadId] || 0) : 0;
    const stalenessDays = 0;
    const score = (overdueDays * 1.5) + (leadValue * 1.2) + (stalenessDays * 1.0);

    items.push({
      id: t.task.id,
      type: 'task',
      title: t.task.title,
      subtitle: t.leadName,
      date: t.task.dueDate,
      isRead: t.task.isRead,
      link: t.task.leadId ? `/leads/${t.task.leadId}` : '#',
      priority: t.task.priority,
      leadId: t.task.leadId || undefined,
      score,
      isUrgent: score > 90,
    });
  });

  draftOutreach.forEach(d => {
    const createdTime = d.draft.createdAt ? new Date(d.draft.createdAt).getTime() : now;
    const stalenessDays = Math.max(0, (now - createdTime) / MS_PER_DAY);
    const leadValue = d.draft.leadId ? (scoreMap[d.draft.leadId] || 0) : 0;
    const overdueDays = 0;
    const score = (overdueDays * 1.5) + (leadValue * 1.2) + (stalenessDays * 1.0);

    items.push({
      id: d.draft.id,
      type: 'draft',
      title: `Draft: ${d.draft.subject || d.draft.channel + ' Outreach'}`,
      subtitle: d.leadName,
      date: d.draft.createdAt,
      isRead: d.draft.isRead,
      link: `/leads/${d.draft.leadId}`,
      status: d.draft.channel,
      leadId: d.draft.leadId || undefined,
      score,
      isUrgent: score > 90,
    });
  });

  // Sort by urgency score (descending)
  items.sort((a, b) => {
    const scoreA = a.score || 0;
    const scoreB = b.score || 0;
    return scoreB - scoreA; // highest score first
  });

  items = items.slice(0, 10);

  return (
    <div className="bg-card p-6 rounded-2xl border border-border/80 shadow-sm">
      <UnifiedActionFeed items={items} />
    </div>
  );
}
