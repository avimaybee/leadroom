'use client';

import { useTransition } from 'react';
import { formatUTC } from '@/lib/date';

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

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-rose-50 text-rose-600 border border-rose-100';
      case 'Low':
        return 'bg-slate-50 text-slate-500 border border-slate-200';
      default:
        return 'bg-amber-50 text-amber-600 border border-amber-100';
    }
  };

  return (
    <div 
      className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
        isCompleted 
          ? 'bg-slate-50/70 border-slate-200/50 opacity-60' 
          : 'bg-white border-slate-200/80 shadow-sm hover:border-slate-300'
      } ${isPending ? 'pointer-events-none opacity-40' : ''}`}
    >
      <input 
        type="checkbox"
        checked={isCompleted}
        disabled={isPending}
        onChange={handleToggle}
        className="mt-1 h-4 w-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
      />
      
      <div className="flex-1 min-w-0 space-y-1">
        <span className={`text-sm font-semibold block leading-tight ${
          isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'
        }`}>
          {task.title}
        </span>
        {task.description && (
          <p className="text-xs text-slate-500 leading-normal line-clamp-1">{task.description}</p>
        )}
        
        <div className="flex flex-wrap gap-2 items-center pt-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getPriorityBadgeClass(task.priority)}`}>
            {task.priority}
          </span>
          {task.dueDate && (
            <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatUTC(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
