'use client';

import { createLeadAction } from '@/app/actions/leads';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-md shadow-indigo-600/10 disabled:opacity-50 hover:scale-[1.01]"
    >
      {pending ? 'Saving Lead...' : 'Save Lead'}
    </button>
  );
}

export default function NewLeadPage() {
  const [state, formAction] = useActionState(createLeadAction, undefined);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      {/* Back and Breadcrumbs */}
      <div className="space-y-1.5 text-left">
        <Link 
          href="/leads" 
          className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition w-fit py-2.5 pr-4 -my-2.5 -ml-1"
        >
          &larr; Back to Leads
        </Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">New Lead</h1>
          <p className="text-sm text-slate-500 mt-1">Enter the details of your new active pipeline prospect.</p>
        </div>
      </div>

      <form action={formAction} className="space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        {state?.error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 font-semibold">
            {state.error}
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name *</label>
            <input 
              required 
              type="text" 
              name="name" 
              placeholder="e.g. John Doe"
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Company</label>
            <input 
              type="text" 
              name="company" 
              placeholder="e.g. Acme Corp"
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
            <input 
              type="email" 
              name="email" 
              placeholder="e.g. john@acme.com"
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Industry</label>
            <input 
              type="text" 
              name="industry" 
              placeholder="e.g. Local Services"
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400" 
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pipeline Stage</label>
            <select 
              name="stage" 
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
            >
              <option value="New">New</option>
              <option value="Researching">Researching</option>
              <option value="Qualified">Qualified</option>
              <option value="Outreach in Progress">Outreach in Progress</option>
              <option value="Meeting / Call">Meeting / Call</option>
            </select>
          </div>
        </div>
        
        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
          <Link
            href="/leads"
            className="px-5 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm transition"
          >
            Cancel
          </Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
