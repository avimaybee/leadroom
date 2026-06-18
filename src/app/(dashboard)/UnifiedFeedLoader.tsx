'use server';

import { getDb } from '@/db';
import { eq, desc, and } from 'drizzle-orm';
import { leads, tasks } from '@/db/schema/core';
import { outreachDrafts } from '@/db/schema/outreach';
import UnifiedActionFeed, { UnifiedItem } from '@/components/dashboard/UnifiedActionFeed';

export default async function UnifiedFeedLoader() {
  const db = getDb();
  
  const [activeLeads, openTasks, draftOutreach] = await Promise.all([
    db.select().from(leads).where(eq(leads.status, 'Active')).orderBy(desc(leads.createdAt)),
    db.select({
      task: tasks,
      leadName: leads.name
    }).from(tasks).leftJoin(leads, eq(tasks.leadId, leads.id)).where(eq(tasks.status, 'Open')).orderBy(desc(tasks.dueDate)),
    db.select({
      draft: outreachDrafts,
      leadName: leads.name
    }).from(outreachDrafts).leftJoin(leads, eq(outreachDrafts.leadId, leads.id)).where(eq(outreachDrafts.status, 'DRAFT')).orderBy(desc(outreachDrafts.createdAt))
  ]);

  const items: UnifiedItem[] = [];

  activeLeads.forEach(l => {
    items.push({
      id: l.id,
      type: 'lead',
      title: l.name + (l.company ? ` at ${l.company}` : ''),
      subtitle: l.stage,
      date: l.createdAt,
      isRead: l.isRead,
      link: `/leads/${l.id}`,
      status: l.stage,
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
      link: t.task.leadId ? `/leads/${t.task.leadId}` : '#',
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
      link: `/leads/${d.draft.leadId}`,
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

  return (
    <div className="bg-card p-6 rounded-2xl border border-border/80 shadow-sm">
      <UnifiedActionFeed items={items} />
    </div>
  );
}
