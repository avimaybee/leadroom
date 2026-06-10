'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl transition disabled:opacity-50"
    >
      {pending ? 'Adding Task...' : 'Add Task'}
    </button>
  );
}

interface ClientTaskFormProps {
  leadId: string;
  createTaskAction: (prevState: any, formData: FormData) => Promise<any>;
}

export default function ClientTaskForm({ leadId, createTaskAction }: ClientTaskFormProps) {
  const [state, formAction] = useActionState(createTaskAction, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error && formRef.current) {
      formRef.current.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200/60">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Configure New Task</h4>
      {state?.error && (
        <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs border border-red-100 font-semibold">
          {state.error}
        </div>
      )}
      <input type="hidden" name="leadId" value={leadId} />
      
      <div className="space-y-3">
        <input 
          required
          type="text"
          name="title"
          placeholder="Task title..."
          className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 bg-white"
        />
        <input 
          type="text"
          name="description"
          placeholder="Short description..."
          className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 bg-white"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Due Date</label>
            <input 
              type="date"
              name="dueDate"
              className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
            <select 
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
