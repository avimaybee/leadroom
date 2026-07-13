export const dynamic = 'force-dynamic';

import { getPendingApprovalsAction } from '@/app/actions/outreach';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ApprovalsTable } from './ApprovalsTable';

export const metadata = {
  title: 'Approvals | Leadroom',
};

export default async function ApprovalsPage() {
  const result = await getPendingApprovalsAction();

  if (!result.success) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
        <p className="text-copy-14 text-destructive">Failed to load approvals.</p>
      </div>
    );
  }

  const drafts = result.drafts;
  const riskFlagged = drafts.filter(d => {
    try {
      const flags = d.riskFlags ? JSON.parse(d.riskFlags) : [];
      return flags.length > 0;
    } catch { return false; }
  }).length;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h2 className="text-heading-2xl">Approvals Queue</h2>
        <p className="text-copy-14 text-muted-foreground mt-1">
          Review and approve outreach drafts before they are sent.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-border p-4 flex flex-col justify-between h-28">
          <span className="text-label-12 text-muted-foreground uppercase">Pending</span>
          <span className="text-heading-2xl text-foreground">{drafts.length}</span>
        </div>
        <div className="rounded-lg border border-border p-4 flex flex-col justify-between h-28">
          <span className="text-label-12 text-muted-foreground uppercase">Approved Today</span>
          <span className="text-heading-2xl text-chart-2">--</span>
        </div>
        <div className={`rounded-lg border border-border p-4 flex flex-col justify-between h-28 ${riskFlagged > 0 ? 'bg-chart-5/10' : 'bg-muted/30'}`}>
          <span className="text-label-12 text-muted-foreground uppercase">Needs Attention</span>
          <span className={`text-heading-2xl ${riskFlagged > 0 ? 'text-chart-5' : 'text-foreground'}`}>{riskFlagged}</span>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-heading-lg text-foreground">All caught up</h3>
          <p className="text-copy-14 text-muted-foreground mt-1 max-w-md mx-auto">
            No pending approvals. Generate drafts from prospect detail pages.
          </p>
          <Link
            href="/prospects"
            className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
          >
            Browse prospects
          </Link>
        </div>
      ) : (
        <ApprovalsTable drafts={drafts as any[]} />
      )}
    </div>
  );
}
