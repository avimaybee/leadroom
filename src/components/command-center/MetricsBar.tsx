'use client';

import Link from 'next/link';
import { Users, Target, FileText, Activity, Search, Inbox } from 'lucide-react';

interface Metrics {
  totalQueue: number;
  highFit: number;
  pendingApprovals: number;
  avgConfidence: number;
  needsResearch: number;
  pendingTriages: number;
}

const ITEMS: { key: keyof Metrics; label: string; icon: typeof Users; color: string; href?: string }[] = [
  { key: 'totalQueue', label: 'Queue Total', icon: Users, color: '', href: '/prospects' },
  { key: 'highFit', label: 'High Fit (T1)', icon: Target, color: 'text-chart-2', href: '/prospects?tier=tier1' },
  { key: 'pendingTriages', label: 'Pending Triages', icon: Inbox, color: 'text-chart-5', href: '/scopes?filter=pending' },
  { key: 'pendingApprovals', label: 'Pending Approval', icon: FileText, color: '', href: '/approvals' },
  { key: 'avgConfidence', label: 'Avg Confidence', icon: Activity, color: '', href: undefined },
  { key: 'needsResearch', label: 'Needs Research', icon: Search, color: '', href: '/prospects' },
];

export function MetricsBar({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {ITEMS.map(({ key, label, icon: Icon, color, href }) => {
        const value = key === 'avgConfidence' ? `${metrics[key]}%` : metrics[key];
        const isZero = metrics[key] === 0;
        const card = (
          <div
            className={`rounded-lg border border-border p-4 flex flex-col justify-between h-28 transition-colors ${
              isZero ? 'bg-muted/30' : 'bg-card'
            } ${href ? 'hover:border-primary/40 hover:shadow-sm' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-label-12 text-muted-foreground uppercase">{label}</span>
              <Icon className={`w-4 h-4 ${href ? 'text-muted-foreground/70' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <span className={`text-heading-2xl ${color || 'text-foreground'}`}>{value}</span>
            </div>
          </div>
        );
        return href ? (
          <Link key={key} href={href} className="block" title={`View ${label}`}>
            {card}
          </Link>
        ) : (
          <div key={key}>{card}</div>
        );
      })}
    </div>
  );
}
