'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProspectRow {
  id: string;
  company: string | null;
  name: string;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  topSignal: string | null;
  updatedAt: Date | number | null;
}

const TIER_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  tier1: { variant: 'default', label: 'T1' },
  tier2: { variant: 'secondary', label: 'T2' },
  tier3: { variant: 'outline', label: 'T3' },
  disqualified: { variant: 'destructive', label: 'DQ' },
};

type SortKey = 'company' | 'fitScore' | 'confidenceScore' | 'priorityTier';

export function ProspectTable({ prospects, onReview }: { prospects: ProspectRow[]; onReview?: (id: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('fitScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'company' ? 'asc' : 'desc');
    }
  };

  const sorted = [...prospects].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (sortKey === 'company') {
      const aStr = (a.company ?? a.name).toLowerCase();
      const bStr = (b.company ?? b.name).toLowerCase();
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    }
    return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortHeader = ({ label, sortKey: sk, align = 'left' }: { label: string; sortKey: SortKey; align?: 'left' | 'right' | 'center' }) => (
    <button
      type="button"
      onClick={() => handleSort(sk)}
      className={`inline-flex items-center gap-1 text-label-12 text-muted-foreground hover:text-foreground transition-colors w-full ${
        align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
      }`}
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-6"><SortHeader label="Company" sortKey="company" /></th>
            <th className="text-right py-3 px-4 w-32"><SortHeader label="Fit Score" sortKey="fitScore" align="right" /></th>
            <th className="text-right py-3 px-4 w-32"><SortHeader label="Confidence" sortKey="confidenceScore" align="right" /></th>
            <th className="text-center py-3 px-4 w-24"><SortHeader label="Tier" sortKey="priorityTier" align="center" /></th>
            <th className="text-left py-3 px-4">Top Signal</th>
            <th className="text-center py-3 px-4 w-28">Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 20).map((p) => {
            const tier = TIER_BADGE[p.priorityTier as keyof typeof TIER_BADGE] || TIER_BADGE.tier3;
            return (
              <tr
                key={p.id}
                className="border-b border-border/40 hover:bg-muted/30 transition-colors duration-150 cursor-pointer"
                onClick={() => onReview ? onReview(p.id) : window.location.href = `/prospects/${p.id}`}
              >
                <td className="py-3 px-6 font-medium text-foreground text-copy-14">{p.company ?? p.name}</td>
                <td className={`text-right py-3 px-4 text-label-14 font-semibold ${
                  (p.fitScore ?? 0) >= 70 ? 'text-chart-2' : (p.fitScore ?? 0) >= 40 ? 'text-chart-5' : 'text-muted-foreground'
                }`}>
                  {p.fitScore ?? '--'}
                </td>
                <td className="text-right py-3 px-4">
                  <div className="inline-flex items-center gap-1.5">
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(p.confidenceScore ?? 0) >= 70 ? 'bg-chart-2' : (p.confidenceScore ?? 0) >= 40 ? 'bg-chart-5' : 'bg-destructive'}`}
                        style={{ width: `${p.confidenceScore ?? 0}%` }}
                      />
                    </div>
                    <span className="text-label-12 text-muted-foreground">{p.confidenceScore ?? '--'}</span>
                  </div>
                </td>
                <td className="text-center py-3 px-4">
                  <Badge variant={tier.variant}>{tier.label}</Badge>
                </td>
                <td className="py-3 px-4 text-copy-13 text-muted-foreground truncate max-w-[200px]">
                  {p.topSignal || '--'}
                </td>
                <td className="text-center py-3 px-4">
                  <Link
                    href={`/prospects/${p.id}`}
                    className="inline-flex items-center h-7 px-2.5 rounded-md border border-border text-label-12 hover:bg-muted/50 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Review
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
