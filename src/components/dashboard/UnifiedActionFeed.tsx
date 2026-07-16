'use client';

import { useState, useTransition, useEffect, memo } from 'react';
import Link from 'next/link';
import { formatUTC } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, Mail, User, Check, EyeOff, Eye } from 'lucide-react';
import { toggleTriageStatusAction } from '@/app/actions/triage';
import { useRouter, useSearchParams } from 'next/navigation';

export type UnifiedItemType = 'lead' | 'task' | 'draft';

export interface UnifiedItem {
  id: string;
  type: UnifiedItemType;
  title: string;
  subtitle?: string | null;
  date: Date | null;
  isRead: boolean;
  link: string;
  priority?: string;
  status?: string;
  leadId?: string;
}

const UnifiedActionFeed = memo(function UnifiedActionFeed({ items }: { items: UnifiedItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showRead = searchParams.get('seen') === 'true';
  
  const [pendingItems, setPendingItems] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(id); }, []);

  const setShowRead = (val: boolean) => {
    const next = new URLSearchParams(searchParams.toString());
    if (val) {
      next.set('seen', 'true');
    } else {
      next.delete('seen');
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  const filteredItems = items.filter(item => showRead || !item.isRead);

  const handleToggleRead = (item: UnifiedItem) => {
    setPendingItems(prev => ({ ...prev, [item.id]: true }));
    startTransition(async () => {
      try {
        await toggleTriageStatusAction(item.type, item.id, !item.isRead);
      } catch (e) {
        console.error('Failed to toggle triage status:', e);
      } finally {
        setPendingItems(prev => ({ ...prev, [item.id]: false }));
      }
    });
  };

  if (filteredItems.length === 0 && items.length === 0) {
    return (
<div className="text-center text-copy-14 text-muted-foreground py-6">
          No action needed items.
    </div>
  );
}

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-label-14 text-foreground uppercase border-b border-border pb-1">
          Daily Priority ({items.filter(i => !i.isRead).length})
        </h3>
        <button
          onClick={() => setShowRead(!showRead)}
          className="text-label-12 text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          {showRead ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showRead ? 'Hide Seen' : 'Show Seen'}
        </button>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center text-copy-14 text-muted-foreground py-6 border border-dashed rounded-xl border-border">
          All caught up! No unread items.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-start gap-3 transition-all bg-card border-border shadow-sm hover:border-accent ${
                pendingItems[item.id] ? 'opacity-40 pointer-events-none' : ''
              } ${item.isRead ? 'opacity-70 bg-muted/30' : ''}`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  {item.type === 'lead' && <Badge variant="secondary" className="text-label-12 uppercase"><User className="w-3 h-3 mr-1" /> Lead</Badge>}
                  {item.type === 'task' && <Badge variant="outline" className="text-label-12 uppercase"><CheckCircle className="w-3 h-3 mr-1" /> Task</Badge>}
                  {item.type === 'draft' && <Badge variant="default" className="text-label-12 uppercase"><Mail className="w-3 h-3 mr-1" /> Draft</Badge>}
                  
                  {item.priority && (
                    <Badge variant={item.priority === 'High' ? 'destructive' : 'outline'} className="text-label-12">
                      {item.priority}
                    </Badge>
                  )}
                  {item.status && (
                    <Badge variant="outline" className="text-label-12">
                      {item.status}
                    </Badge>
                  )}
                </div>

                <Link href={item.link} className="text-copy-14 font-semibold block leading-tight text-card-foreground hover:underline hover:text-primary transition-colors">
                  {item.title}
                </Link>

                {item.subtitle && (
                  <p className="text-copy-13 text-muted-foreground leading-normal line-clamp-1">
                    {item.type !== 'lead' && 'For: '}
                    {item.type !== 'lead' && item.leadId ? (
                      <Link href={`/leads/${item.leadId}`} className="hover:underline text-primary font-medium">{item.subtitle}</Link>
                    ) : (
                      item.subtitle
                    )}
                  </p>
                )}
                
                {item.date && (() => {
                  const isTaskOverdue = item.type === 'task' && new Date(item.date).getTime() < now;
                  return (
                    <div className="flex flex-wrap gap-2 items-center pt-1.5">
                      <span className={`text-label-12 flex items-center gap-1 ${isTaskOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                        <Calendar className={`w-3.5 h-3.5 ${isTaskOverdue ? 'text-destructive' : 'text-muted-foreground'}`} />
                        {formatUTC(item.date)}
                        {isTaskOverdue && ' (Overdue)'}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="shrink-0 pt-1 sm:pt-0">
                <button
                  onClick={() => handleToggleRead(item)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-12 transition-colors ${
                    item.isRead 
                      ? 'bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground' 
                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  {item.isRead ? 'Mark as Unread' : 'Mark as Read'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default UnifiedActionFeed;
