'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { archiveLeadAction, bulkUpdateStageAction } from '@/app/actions/leads';
import { PIPELINE_STAGES } from '@/services/lead';

export function LeadsTable({ 
  leads, 
  sort, 
  order 
}: { 
  leads: any[]; 
  sort: string; 
  order: string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const toggleAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkUpdateStage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStage = e.target.value;
    if (!newStage || selectedIds.size === 0) return;

    startTransition(async () => {
      await bulkUpdateStageAction(Array.from(selectedIds), newStage);
      setSelectedIds(new Set());
      e.target.value = '';
    });
  };

  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case 'In Research': return 'bg-chart-5/10 text-chart-5 border border-chart-5/20';
      case 'Auditing': return 'bg-chart-3/10 text-chart-3 border border-chart-3/20';
      case 'Audited': return 'bg-chart-2/10 text-chart-2 border border-chart-2/20';
      case 'Drafting': return 'bg-primary/10 text-primary border border-primary/20';
      case 'Ready to Send': return 'bg-chart-4/10 text-chart-4 border border-chart-4/20';
      case 'Outreach Sent': return 'bg-primary/20 text-primary border border-primary/30';
      case 'Meeting': return 'bg-destructive/10 text-destructive border border-destructive/20';
      case 'Won': return 'bg-chart-2/20 text-chart-2 border border-chart-2/30';
      case 'Lost': return 'bg-destructive/20 text-destructive border border-destructive/30';
      default: return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const toggleOrder = order === 'asc' ? 'desc' : 'asc';
  const stageAgeHref = `?sort=stageUpdatedAt&order=${sort === 'stageUpdatedAt' ? toggleOrder : 'desc'}`;

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg border border-border">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <select 
            className="text-sm bg-background border border-border rounded p-1.5"
            onChange={handleBulkUpdateStage}
            defaultValue=""
            disabled={isPending}
          >
            <option value="" disabled>Move to stage...</option>
            {PIPELINE_STAGES.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input 
                    type="checkbox" 
                    className="rounded border-border text-primary focus:ring-primary"
                    checked={selectedIds.size > 0 && selectedIds.size === leads.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Prospect Details</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Priority</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Pipeline Stage</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  <Link href={stageAgeHref} className="hover:text-foreground flex items-center gap-1">
                    Time in Stage
                    {sort === 'stageUpdatedAt' && (
                      <span>{order === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </Link>
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {leads.map((lead: any) => (
                <tr key={lead.id} className="hover:bg-muted/50 transition duration-150">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox"
                      className="rounded border-border text-primary focus:ring-primary"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleOne(lead.id)}
                    />
                  </td>
                  <td className="px-6 py-4 min-w-[200px]">
                    <Link href={`/leads/${lead.id}`} className="hover:underline group block">
                      <div className="font-bold text-card-foreground text-sm leading-snug group-hover:text-primary transition-colors truncate max-w-[240px] md:max-w-[320px]">{lead.name}</div>
                    </Link>
                    <div className="flex flex-col gap-0.5 mt-1">
                      {lead.company && (
                        <div className="text-xs text-foreground/85 font-semibold truncate max-w-[240px] md:max-w-[320px]">{lead.company}</div>
                      )}
                      {lead.email && (
                        <div className="text-xs text-muted-foreground font-medium truncate max-w-[240px] md:max-w-[320px]">{lead.email}</div>
                      )}
                      {lead.campaignName && (
                        <div className="mt-1 flex">
                          <Link 
                            href={`/scopes/${lead.campaignId}`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted/65 text-muted-foreground border border-border/50 uppercase tracking-wide hover:bg-muted hover:text-foreground transition-colors"
                          >
                            Campaign: {lead.campaignName}
                          </Link>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lead.scoreValue !== null && lead.scoreValue !== undefined ? (
                      <span 
                        aria-label={`${lead.scoreLabel} Priority, score ${lead.scoreValue} out of 100`}
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${
                          lead.scoreLabel === 'High' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                          lead.scoreLabel === 'Medium' ? 'bg-chart-3/15 text-chart-3 border-chart-3/30' :
                          'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                          lead.scoreLabel === 'High' ? 'bg-destructive animate-pulse' :
                          lead.scoreLabel === 'Medium' ? 'bg-chart-3' : 'bg-muted-foreground'
                        }`} />
                        {lead.scoreLabel} ({lead.scoreValue})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border bg-muted/50 text-muted-foreground border-border/60">
                        Unassessed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getStageBadgeClass(lead.stage)}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {lead.stageUpdatedAt ? new Date(lead.stageUpdatedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <form action={archiveLeadAction.bind(null, lead.id)}>
                      <Button type="submit" variant="destructive" size="xs">Archive</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
