'use client';

import { Users, Target, FileText, Activity, Search } from 'lucide-react';

interface Metrics {
  totalQueue: number;
  highFit: number;
  pendingApprovals: number;
  avgConfidence: number;
  needsResearch: number;
}

const ITEMS = [
  { key: 'totalQueue' as const, label: 'Queue Total', icon: Users, color: '' },
  { key: 'highFit' as const, label: 'High Fit (T1)', icon: Target, color: 'text-chart-2' },
  { key: 'pendingApprovals' as const, label: 'Pending Approval', icon: FileText, color: '' },
  { key: 'avgConfidence' as const, label: 'Avg Confidence', icon: Activity, color: '' },
  { key: 'needsResearch' as const, label: 'Needs Research', icon: Search, color: '' },
];

export function MetricsBar({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {ITEMS.map(({ key, label, icon: Icon, color }) => {
        const value = key === 'avgConfidence' ? `${metrics[key]}%` : metrics[key];
        const isZero = metrics[key] === 0;
        return (
          <div
            key={key}
            className={`rounded-lg border border-border p-4 flex flex-col justify-between h-28 ${isZero ? 'bg-muted/30' : 'bg-card'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-label-12 text-muted-foreground uppercase">{label}</span>
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <span className={`text-heading-2xl ${color || 'text-foreground'}`}>{value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
