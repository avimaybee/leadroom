'use client';

import { formatDateTimeUTC } from '@/lib/date';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare,
  CheckSquare,
  GitBranch,
  Send,
  Settings,
  Layers,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  Terminal,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Activity {
  id: string;
  leadId: string;
  type: string;
  summary: string;
  timestamp: string | Date | number;
  metadata?: any;
}

export default function ClientActivityList({ activities }: { activities: Activity[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get('activityFilter') || 'all';
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [detailsActivity, setDetailsActivity] = useState<Activity | null>(null);
  const [searchBatchQuery, setSearchBatchQuery] = useState('');

  // Categories helper
  const getActivityCategory = useCallback((type: string): string => {
    const t = type.toLowerCase();
    if (t.includes('note')) return 'Notes';
    if (t.includes('task')) return 'Tasks';
    if (t.includes('stage')) return 'Stage changes';
    if (t.includes('outreach') || t.includes('sent') || t.includes('approved') || t.includes('rejected')) return 'Outreach';
    return 'System';
  }, []);

  // Filter activities based on toggle selection and query
  const filteredActivities = useMemo(() => {
    let result = activities || [];

    // Filter by type
    if (activeFilter !== 'all') {
      result = result.filter(act => getActivityCategory(act.type).toLowerCase().replace(' ', '_') === activeFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(act => act.summary.toLowerCase().includes(q) || act.type.toLowerCase().includes(q));
    }

    return result;
  }, [activities, activeFilter, searchQuery, getActivityCategory]);

  // Compute counts for category filters
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: activities.length,
      notes: 0,
      tasks: 0,
      stage_changes: 0,
      outreach: 0,
      system: 0,
    };
    activities.forEach(act => {
      const cat = getActivityCategory(act.type).toLowerCase().replace(' ', '_');
      if (cat in counts) {
        counts[cat]++;
      } else {
        counts.system++;
      }
    });
    return counts;
  }, [activities, getActivityCategory]);

  const handleFilterChange = (filter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === 'all') {
      params.delete('activityFilter');
    } else {
      params.set('activityFilter', filter);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // Group filtered activities by date (Today, Yesterday, Earlier Date)
  const groupedActivities = useMemo(() => {
    const dateMap: Record<string, Activity[]> = {};
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    filteredActivities.forEach(act => {
      const date = new Date(act.timestamp);
      const dateStr = date.toDateString();
      let groupKey = '';
      if (dateStr === todayStr) {
        groupKey = 'Today';
      } else if (dateStr === yesterdayStr) {
        groupKey = 'Yesterday';
      } else {
        groupKey = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      }
      if (!dateMap[groupKey]) {
        dateMap[groupKey] = [];
      }
      dateMap[groupKey].push(act);
    });

    const groups: Array<{ dateLabel: string; items: Activity[] }> = [];
    const keys = Object.keys(dateMap);
    keys.forEach(key => {
      groups.push({ dateLabel: key, items: dateMap[key] });
    });

    return groups;
  }, [filteredActivities]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Notes': return MessageSquare;
      case 'Tasks': return CheckSquare;
      case 'Stage changes': return GitBranch;
      case 'Outreach': return Send;
      default: return Settings;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Notes': return 'text-chart-5 bg-chart-5/10 border-chart-5/20';
      case 'Tasks': return 'text-chart-2 bg-chart-2/10 border-chart-2/20';
      case 'Stage changes': return 'text-primary bg-primary/10 border-primary/20';
      case 'Outreach': return 'text-chart-4 bg-chart-4/10 border-chart-4/20';
      default: return 'text-muted-foreground bg-muted border-border/50';
    }
  };

  const toggleNoteExpanded = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-5">
      {/* Timeline Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        {/* Toggle Group Filters */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-muted/25 p-1 w-fit">
          {[
            { value: 'all', label: 'All', icon: Layers },
            { value: 'notes', label: 'Notes', icon: MessageSquare },
            { value: 'tasks', label: 'Tasks', icon: CheckSquare },
            { value: 'stage_changes', label: 'Stage Changes', icon: GitBranch },
            { value: 'outreach', label: 'Outreach', icon: Send },
            { value: 'system', label: 'System', icon: Settings },
          ].map(opt => {
            const count = categoryCounts[opt.value];
            if (count === 0 && opt.value !== 'all') return null; // Hide zero counts
            const isSelected = activeFilter === opt.value;
            const Icon = opt.icon;

            return (
              <button
                key={opt.value}
                onClick={() => handleFilterChange(opt.value)}
                className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-label-12 font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? 'bg-card text-foreground shadow-sm font-semibold border border-border/50'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground border border-transparent'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{opt.label}</span>
                <span className="text-label-12 bg-muted/80 text-muted-foreground px-1.5 py-0.2 rounded-md">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search activity..."
            className="pl-9 h-9 text-copy-14 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Timeline List */}
      <div className="space-y-6">
        {groupedActivities.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border/60 rounded-2xl bg-card/45">
            <p className="text-copy-14 text-muted-foreground font-semibold">
              {activities.length === 0 
                ? 'No activity yet. Add a note to start the lead history.'
                : 'No matching activities found.'}
            </p>
            {searchQuery && (
              <Button variant="link" size="xs" onClick={() => setSearchQuery('')} className="mt-2">
                Clear search query
              </Button>
            )}
          </div>
        ) : (
          groupedActivities.map(group => (
            <div key={group.dateLabel} className="space-y-3">
              {/* Date Header */}
              <h3 className="text-label-12 text-muted-foreground/80 uppercase pl-3 border-l-2 border-primary/20">
                {group.dateLabel}
              </h3>

              {/* Items Container with vertical line */}
              <div className="relative border-l border-border/60 ml-[7px] pl-5 space-y-4 py-2">
                {group.items.map(act => {
                  const category = getActivityCategory(act.type);
                  const Icon = getCategoryIcon(category);
                  const badgeClass = getCategoryColor(category);
                  const isNote = category === 'Notes';
                  const hasDetails = act.metadata?.error || act.metadata?.batch;
                  const isExpanded = expandedNotes[act.id] || false;

                  return (
                    <div key={act.id} className="relative group">
                      {/* Timeline node icon */}
                      <span className="absolute -left-[27px] top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-background border border-border/85 shadow-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/85" />
                      </span>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-label-12">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-label-12 uppercase ${badgeClass}`}>
                              <Icon className="h-3 w-3" />
                              {act.type}
                            </span>
                            <span className="text-label-12 text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground/50" />
                              {formatDateTimeUTC(typeof act.timestamp === 'number' ? new Date(act.timestamp) : act.timestamp)}
                            </span>
                          </div>
                        </div>

                        <div className="bg-card/50 border border-border/40 hover:bg-card/85 transition-colors p-3.5 rounded-2xl max-w-4xl space-y-2 mt-1">
                          {isNote ? (
                            <div className="space-y-2">
                              <p className={`copy-14 leading-6 text-foreground/90 whitespace-pre-wrap font-medium ${!isExpanded ? 'line-clamp-3' : ''}`}>
                                {act.summary}
                              </p>
                              {act.summary.split('\n').length > 3 || act.summary.length > 220 ? (
                                <button
                                  onClick={() => toggleNoteExpanded(act.id)}
                                  className="text-label-12 font-semibold text-primary hover:underline flex items-center gap-1"
                                >
                                  {isExpanded ? (
                                    <>
                                      <span>Show less</span>
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    </>
                                  ) : (
                                    <>
                                      <span>Show more</span>
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </>
                                  )}
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-copy-14 leading-6 text-foreground/80 font-medium">
                              {act.summary}
                            </p>
                          )}

                          {hasDetails && (
                            <div className="pt-1.5 flex justify-end">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setDetailsActivity(act)}
                                className="font-semibold flex items-center gap-1 h-7 border-border/80 hover:bg-muted/40"
                              >
                                <Terminal className="w-3.5 h-3.5" />
                                Technical details
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Technical Details Dialog */}
      <Dialog open={detailsActivity !== null} onOpenChange={open => !open && setDetailsActivity(null)}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl bg-card border border-border p-6">
          <DialogHeader className="border-b border-border/50 pb-3">
            <DialogTitle className="text-label-14 text-foreground uppercase flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <span>Technical Details</span>
            </DialogTitle>
            <DialogDescription className="text-label-12 text-muted-foreground font-semibold pt-1">
              Diagnostic logs and API payloads for event: {detailsActivity?.type}
            </DialogDescription>
          </DialogHeader>

          {detailsActivity && (
            <div className="space-y-4 py-4 text-label-12 font-semibold">
              <div className="space-y-1">
                <span className="text-label-12 text-muted-foreground uppercase">Summary</span>
                <p className="text-copy-13 text-foreground bg-muted/45 border border-border/40 p-3 rounded-xl font-medium leading-relaxed">
                  {detailsActivity.summary}
                </p>
              </div>

              {detailsActivity.metadata?.error && (
                <div className="space-y-2 border border-destructive/25 bg-destructive/5 p-4 rounded-xl">
                  <h4 className="text-label-12 font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Error Diagnostic Log</span>
                  </h4>
                  <p className="text-label-12 text-destructive font-semibold pt-1">
                    {detailsActivity.metadata.error.message}
                  </p>
                  {detailsActivity.metadata.error.payload && (
                    <div className="space-y-1.5 pt-2">
                      <span className="text-label-12 text-destructive/80 uppercase">Request Payload:</span>
                      <pre className="text-mono-12 text-muted-foreground overflow-x-auto bg-background/60 p-3 rounded-lg border border-destructive/15">
                        {JSON.stringify(detailsActivity.metadata.error.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {detailsActivity.metadata?.batch && detailsActivity.metadata.batch.entities && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-label-12 text-muted-foreground uppercase">Batch Operations</span>
                    <input
                      type="text"
                      placeholder="Search batch items..."
                      value={searchBatchQuery}
                      onChange={e => setSearchBatchQuery(e.target.value)}
                      className="text-label-12 px-2.5 py-1 border border-border rounded-lg bg-background w-44 font-medium"
                    />
                  </div>

                  <div className="border border-border/60 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-label-12">
                      <thead className="bg-muted border-b border-border/60">
                        <tr className="text-muted-foreground font-semibold">
                          <th className="px-3 py-2">Entity ID</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Error Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 bg-background/30 font-medium">
                        {detailsActivity.metadata.batch.entities
                          .filter((e: any) =>
                            searchBatchQuery === '' ||
                            e.id.toLowerCase().includes(searchBatchQuery.toLowerCase()) ||
                            e.status.toLowerCase().includes(searchBatchQuery.toLowerCase())
                          )
                          .map((entity: any, i: number) => (
                            <tr key={i} className="hover:bg-muted/10">
                              <td className="px-3 py-2 text-mono-12">{entity.id}</td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-label-12 font-semibold ${
                                  entity.status.toLowerCase() === 'success' 
                                    ? 'bg-chart-2/10 text-chart-2' 
                                    : 'bg-destructive/10 text-destructive'
                                }`}>
                                  {entity.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{entity.error || '-'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={() => setDetailsActivity(null)}>
              Close Details
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
