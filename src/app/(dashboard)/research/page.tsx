export const dynamic = 'force-dynamic';

import { getResearchQueueAction } from '@/app/actions/research';
import { Search, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { ResearchQueueTable } from './ResearchQueueTable';

export const metadata = {
  title: 'Research Jobs | Leadroom',
};

export default async function ResearchQueuePage() {
  const result = await getResearchQueueAction();

  if (!result.success) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
        <p className="text-copy-14 text-destructive">Failed to load research tasks.</p>
      </div>
    );
  }

  const tasks = result.tasks;
  const pendingCount = tasks.filter(t => t.status === 'PENDING').length;
  const runningCount = tasks.filter(t => t.status === 'RUNNING').length;
  const failedCount = tasks.filter(t => t.status === 'FAILED').length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-heading-2xl">Research Jobs</h2>
        <p className="text-copy-14 text-muted-foreground mt-1">
          Background jobs researching each prospect's website, signals, and fit. Running automatically when you start research.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {pendingCount > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-chart-5/10 text-chart-5 text-label-12 font-semibold">
            {pendingCount} Pending
          </span>
        )}
        {runningCount > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/10 text-primary text-label-12 font-semibold">
            {runningCount} Running
          </span>
        )}
        {failedCount > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-label-12 font-semibold">
            {failedCount} Failed
          </span>
        )}
        {tasks.length > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted/30 text-muted-foreground text-label-12 font-semibold">
            {tasks.length} Total
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <Search className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-heading-lg text-foreground">No research tasks</h3>
          <p className="text-copy-14 text-muted-foreground mt-1 max-w-md mx-auto">
            Add prospects to a market to start research.
          </p>
          <Link
            href="/markets"
            className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
          >
            Go to Markets
          </Link>
        </div>
      ) : (
        <ResearchQueueTable tasks={tasks as any[]} />
      )}
    </div>
  );
}
