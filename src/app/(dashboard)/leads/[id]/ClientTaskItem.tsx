'use client';

import { useTransition } from 'react';
import { formatUTC } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  status: string;
  priority: string;
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
      className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
        isCompleted 
          ? 'bg-muted/50 border-border/50 opacity-60' 
          : 'bg-card border-border/80 shadow-sm hover:border-accent'
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
        <span className={`text-sm font-semibold block leading-tight ${
          isCompleted ? 'text-muted-foreground line-through' : 'text-card-foreground'
        }`}>
          {task.title}
        </span>
        {task.description && (
          <p className="text-xs text-muted-foreground leading-normal line-clamp-1">{task.description}</p>
        )}
        
        <div className="flex flex-wrap gap-2 items-center pt-1.5">
          <Badge variant={getPriorityVariant(task.priority)} className="uppercase">
            {task.priority}
          </Badge>
          {task.dueDate && (
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              {formatUTC(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
