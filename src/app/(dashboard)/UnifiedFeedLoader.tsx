import { getDb } from '@/db';
import { eq, desc, and } from 'drizzle-orm';
import { prospects as leads, tasks, stageThresholds } from '@/db/schema/core';
import { outreachDrafts } from '@/db/schema/outreach';
import { getUserId } from '@/lib/auth';
import UnifiedActionFeed, { UnifiedItem } from '@/components/dashboard/UnifiedActionFeed';

export default async function UnifiedFeedLoader() {
  const db = getDb();
  const userId = await getUserId();

  const [activeLeads, openTasks, draftOutreach, thresholdsData] = await Promise.all([
    db.select().from(leads).where(and(eq(leads.status, 'Active'), eq(leads.ownerId, userId ?? ''))).orderBy(desc(leads.createdAt)).limit(200),
    db.select({
      task: tasks,
      leadName: leads.name
    }).from(tasks).leftJoin(leads, eq(tasks.leadId, leads.id)).where(and(eq(tasks.status, 'Open'), eq(tasks.assigneeId, userId ?? ''))).orderBy(desc(tasks.dueDate)),
    db.select({
      draft: outreachDrafts,
      leadName: leads.name
    }).from(outreachDrafts).leftJoin(leads, eq(outreachDrafts.leadId, leads.id)).where(and(eq(outreachDrafts.status, 'DRAFT'), eq(leads.ownerId, userId ?? ''))).orderBy(desc(outreachDrafts.createdAt)),
    db.select().from(stageThresholds)
  ]);

  const thresholds = thresholdsData.reduce((acc, t) => {
    acc[t.stage] = t.days;
    return acc;
  }, {} as Record<string, number>);

  const now = new Date().getTime();

  const staleLeads = activeLeads.filter(l => {
    const defaultThreshold = 5;
    const thresholdDays = thresholds[l.stage] ?? defaultThreshold;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    
    const lastActivityTime = l.lastActivityAt 
      ? new Date(l.lastActivityAt).getTime() 
      : (l.stageUpdatedAt ? new Date(l.stageUpdatedAt).getTime() : (l.createdAt ? new Date(l.createdAt).getTime() : now));
      
    return (now - lastActivityTime) > thresholdMs;
  });

  let items: UnifiedItem[] = [];

  staleLeads.forEach(l => {
    items.push({
      id: l.id,
      type: 'lead',
      title: `Stale Prospect: ${l.name}${l.company ? ` at ${l.company}` : ''}`,
      subtitle: `Idle in ${l.stage}`,
      date: l.lastActivityAt || l.stageUpdatedAt || l.createdAt,
      isRead: l.isRead,
      link: `/prospects/${l.id}`,
      status: 'Needs Attention',
      priority: 'High',
    });
  });

  openTasks.forEach(t => {
    items.push({
      id: t.task.id,
      type: 'task',
      title: t.task.title,
      subtitle: t.leadName,
      date: t.task.dueDate,
      isRead: t.task.isRead,
      link: t.task.leadId ? `/prospects/${t.task.leadId}` : '#',
      priority: t.task.priority,
      leadId: t.task.leadId || undefined,
    });
  });

  draftOutreach.forEach(d => {
    items.push({
      id: d.draft.id,
      type: 'draft',
      title: `Draft: ${d.draft.subject || d.draft.channel + ' Outreach'}`,
      subtitle: d.leadName,
      date: d.draft.createdAt,
      isRead: d.draft.isRead,
      link: `/prospects/${d.draft.leadId}`,
      status: d.draft.channel,
      leadId: d.draft.leadId || undefined,
    });
  });

  // Sort by date (descending)
  items.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  });

  items = items.slice(0, 10);

  return (
    <div className="bg-card p-6 rounded-2xl border border-border/80 shadow-sm">
      <UnifiedActionFeed items={items} />
    </div>
  );
}
