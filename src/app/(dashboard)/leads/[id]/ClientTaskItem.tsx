'use client';

import { useTransition } from 'react';
import { formatUTC } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { Calendar, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  status: string;
  priority: string;
  source?: string | null;
  playbookId?: string | null;
  playbookName?: string | null;
  googleCalendarSyncStatus?: string | null;
  googleCalendarSyncError?: string | null;
}

interface ClientTaskItemProps {
  leadId: string;
  task: Task;
  toggleTaskStatusAction: (id: string, currentStatus: string, leadId?: string | null) => Promise<void>;
}

export default function ClientTaskItem({ leadId, task, toggleTaskStatusAction }: ClientTaskItemProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      try {
        await toggleTaskStatusAction(task.id, task.status, leadId);
      } catch (e) {
        console.error('Failed to update task:', e);
      }
    });
  };

  const isCompleted = task.status === 'Completed';

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'destructive' as const;
      case 'Low':
        return 'outline' as const;
      default:
        return 'secondary' as const;
    }
  };

  return (
    <div 
      className={`py-3.5 flex items-start gap-3 transition-all ${
        isCompleted 
          ? 'opacity-60' 
          : 'hover:bg-muted/10'
      } ${isPending ? 'pointer-events-none opacity-40' : ''}`}
    >
      <input 
        type="checkbox"
        checked={isCompleted}
        disabled={isPending}
        onChange={handleToggle}
        className="mt-1 h-4 w-4 rounded-md border-input text-primary focus:ring-primary cursor-pointer"
      />
      
      <div className="flex-1 min-w-0 space-y-1">
        <span className={`label-14 font-semibold block leading-tight ${
          isCompleted ? 'text-muted-foreground line-through' : 'text-card-foreground'
        }`}>
          {task.title}
        </span>
        {task.description && (
          <p className="text-label-12 text-muted-foreground leading-normal line-clamp-1">{task.description}</p>
        )}
        
        <div className="flex flex-wrap gap-2 items-center pt-1.5">
          <Badge variant={getPriorityVariant(task.priority)} className="uppercase">
            {task.priority}
          </Badge>
          {task.playbookId && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-chart-3/10 border border-chart-3/20 text-label-12 font-medium text-chart-3 uppercase" title="Automated Playbook Task">
              <Sparkles className="w-3 h-3 text-chart-3" />
              {task.playbookName || 'Playbook'}
            </span>
          )}
          {task.dueDate && (
            <div className="flex items-center gap-1.5 text-label-12 text-muted-foreground font-semibold">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{formatUTC(task.dueDate)}</span>
              </div>
              
              {task.googleCalendarSyncStatus && (
                <span 
                  className={`flex items-center ${
                    task.googleCalendarSyncStatus === 'Synced'
                      ? 'text-emerald-500'
                      : task.googleCalendarSyncStatus === 'Error'
                      ? 'text-destructive'
                      : 'text-amber-500'
                  }`}
                  title={
                    task.googleCalendarSyncStatus === 'Synced' ? 'Synced to Google Calendar' :
                    task.googleCalendarSyncStatus === 'Error' ? (task.googleCalendarSyncError || 'Sync failed') : 
                    'Syncing to calendar...'
                  }
                >
                  {task.googleCalendarSyncStatus === 'Synced' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : task.googleCalendarSyncStatus === 'Error' ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
