'use client';

import { useTransition } from 'react';
import Link from 'next/link';

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

  if (tasks.length === 0) {
    return (
      <div className="text-center text-sm font-semibold text-slate-400 py-6">
        No open tasks.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div 
          key={task.id} 
          className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all bg-white border-slate-200/80 shadow-sm hover:border-slate-300 ${
            isPending ? 'pointer-events-none opacity-40' : ''
          }`}
        >
          <input 
            type="checkbox"
            checked={false}
            disabled={isPending}
            onChange={() => handleToggle(task)}
            className="mt-1 h-4 w-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          
          <div className="flex-1 min-w-0 space-y-1">
            <span className="text-sm font-semibold block leading-tight text-slate-800">
              {task.title}
            </span>
            {task.leadName && (
              <p className="text-xs text-slate-500 leading-normal line-clamp-1">
                For: <Link href={`/leads/${task.leadId}`} className="hover:underline text-indigo-600 font-medium">{task.leadName}</Link>
              </p>
            )}
            
            <div className="flex flex-wrap gap-2 items-center pt-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getPriorityBadgeClass(task.priority)}`}>
                {task.priority}
              </span>
              {task.dueDate && (
                <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                  new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-slate-400'
                }`}>
                  <svg className={`w-3.5 h-3.5 ${new Date(task.dueDate) < new Date() ? 'text-red-400' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(task.dueDate).toLocaleDateString()}
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
