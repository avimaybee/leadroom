'use client';

import { createScopeAction } from '@/app/actions/scopes';
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
      {pending ? 'Creating Scope...' : 'Create Scope'}
    </button>
  );
}

export default function NewScopePage() {
  const [state, formAction] = useActionState(createScopeAction, undefined);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link 
          href="/scopes" 
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-500 transition"
        >
          &larr; Back
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Scope</h1>
          <p className="text-sm text-slate-500 mt-1">Configure a new targeting scope for prospect discovery.</p>
        </div>
      </div>

      <form action={formAction} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {state?.error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 font-semibold">
            {state.error}
          </div>
        )}

        <div className="space-y-5">
          {/* Scope Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Scope Name *</label>
            <input 
              required 
              type="text" 
              name="name" 
              placeholder="e.g. Dentists in Austin"
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400" 
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
            <textarea 
              name="description" 
              placeholder="Provide context for this discovery segment..."
              rows={2}
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Industry */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Industry Filter</label>
              <input 
                type="text" 
                name="industryFilter" 
                placeholder="e.g. Dental Clinics"
                className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400" 
              />
            </div>

            {/* Geography */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Geography Filter</label>
              <input 
                type="text" 
                name="geographyFilter" 
                placeholder="e.g. Austin, TX"
                className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400" 
              />
            </div>

            {/* Company Size */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Company Size Filter</label>
              <input 
                type="text" 
                name="companySizeFilter" 
                placeholder="e.g. 5-20 employees"
                className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400" 
              />
            </div>

            {/* Business Type */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Business Type</label>
              <input 
                type="text" 
                name="businessTypeFilter" 
                placeholder="e.g. B2C Local Services"
                className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400" 
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Additional Scope Notes</label>
            <textarea 
              name="notes" 
              placeholder="e.g. Focus on dental practices that lack modern online booking systems..."
              rows={3}
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Link
            href="/scopes"
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
