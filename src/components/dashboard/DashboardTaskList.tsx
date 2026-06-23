'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { formatUTC } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

interface DashboardTask {
  id: string;
  title: string;
  dueDate: Date | null;
  status: string;
  priority: string;
  leadId: string | null;
  leadName: string | null;
}

interface DashboardTaskListProps {
  tasks: DashboardTask[];
  toggleTaskStatusAction: (id: string, currentStatus: string, leadId?: string | null) => Promise<void>;
}

export default function DashboardTaskList({ tasks, toggleTaskStatusAction }: DashboardTaskListProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (task: DashboardTask) => {
    startTransition(async () => {
      try {
        await toggleTaskStatusAction(task.id, task.status, task.leadId);
      } catch (e) {
        console.error('Failed to update task:', e);
      }
    });
  };

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

  if (tasks.length === 0) {
    return (
      <div className="text-center text-copy-14 font-semibold text-muted-foreground py-6">
        No open tasks.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div 
          key={task.id} 
          className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all bg-card border-border shadow-sm hover:border-accent ${
            isPending ? 'pointer-events-none opacity-40' : ''
          }`}
        >
          <input 
            type="checkbox"
            checked={false}
            disabled={isPending}
            onChange={() => handleToggle(task)}
            className="mt-1 h-4 w-4 rounded-md border-input text-primary focus:ring-primary cursor-pointer"
          />
          
          <div className="flex-1 min-w-0 space-y-1">
            <span className="text-copy-14 font-semibold block leading-tight text-card-foreground">
              {task.title}
            </span>
            {task.leadName && (
              <p className="text-copy-13 text-muted-foreground leading-normal line-clamp-1">
                For: <Link href={`/leads/${task.leadId}`} className="hover:underline text-primary font-medium">{task.leadName}</Link>
              </p>
            )}
            
            <div className="flex flex-wrap gap-2 items-center pt-1.5">
              <Badge variant={getPriorityVariant(task.priority)} className="">
                {task.priority}
              </Badge>
              {task.dueDate && (
                <span className={`text-label-12 flex items-center gap-1 ${
                  new Date(task.dueDate) < new Date() ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  <Calendar className={`w-3.5 h-3.5 ${new Date(task.dueDate) < new Date() ? 'text-destructive' : 'text-muted-foreground'}`} />
                  {formatUTC(task.dueDate)}
                  {new Date(task.dueDate) < new Date() && ' (Overdue)'}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
