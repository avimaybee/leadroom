'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl transition disabled:opacity-50 shadow shadow-indigo-600/10"
    >
      {pending ? 'Adding Task...' : 'Add Task'}
    </button>
  );
}

interface ClientTaskFormProps {
  leadId: string;
  createTaskAction: (prevState: { error?: string | null, success?: boolean } | null | undefined, formData: FormData) => Promise<{ error?: string | null, success?: boolean } | null | undefined>;
  tasksCount?: number;
}

export default function ClientTaskForm({ leadId, createTaskAction, tasksCount = 0 }: ClientTaskFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction] = useActionState(createTaskAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error && formRef.current) {
      formRef.current.reset();
      setShowForm(false);
    }
  }, [state]);

  if (!showForm) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          id="add-task-trigger-btn"
          onClick={() => setShowForm(true)}
          className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/60 text-indigo-600 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Add Task
        </button>

        {tasksCount === 0 && (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center space-y-3 animate-fade-in">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 mx-auto shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-900">No Tasks Configured</h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                Keep track of outreach plans, follow-ups, audits, and meetings for this lead.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition"
            >
              Create First Task &rarr;
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 animate-fade-in">
      <div className="flex justify-between items-center pb-1 border-b border-slate-200/40">
        <h4 className="text-xs font-bold text-slate-900">Configure New Task</h4>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 transition"
        >
          Cancel
        </button>
      </div>
      {state?.error && (
        <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs border border-red-100 font-semibold">
          {state.error}
        </div>
      )}
      <input type="hidden" name="leadId" value={leadId} />
      
      <div className="space-y-3">
        <div>
          <label htmlFor="task-title" className="sr-only">Task Title</label>
          <input 
            required
            id="task-title"
            type="text"
            name="title"
            placeholder="Task title..."
            className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 bg-white"
          />
        </div>
        <div>
          <label htmlFor="task-desc" className="sr-only">Task Description</label>
          <input 
            id="task-desc"
            type="text"
            name="description"
            placeholder="Short description..."
            className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 bg-white"
          />
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="task-due-date" className="block text-xs font-bold text-slate-900 mb-1">Due Date</label>
            <input 
              id="task-due-date"
              type="date"
              name="dueDate"
              className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>
          <div>
            <label htmlFor="task-priority" className="block text-xs font-bold text-slate-900 mb-1">Priority</label>
            <select 
              id="task-priority"
              name="priority"
              defaultValue="Medium"
              className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
