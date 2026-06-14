'use client';

import { useState, useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  industry: string | null;
}

interface ClientLeadProfileProps {
  lead: Lead;
  updateLeadAction: (
    prevState: { error?: string | null; success?: boolean } | null | undefined,
    formData: FormData
  ) => Promise<{ error?: string | null; success?: boolean } | null | undefined>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow disabled:opacity-50"
    >
      {pending ? 'Saving...' : 'Save Changes'}
    </button>
  );
}

export default function ClientLeadProfile({ lead, updateLeadAction }: ClientLeadProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction] = useActionState(updateLeadAction, undefined);

  useEffect(() => {
    if (state && !state.error && state.success) {
      setIsEditing(false);
    }
  }, [state]);

  if (isEditing) {
    return (
      <form action={formAction} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 animate-fade-in">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            Edit Contact & Business Profile
          </h3>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 transition"
          >
            Cancel
          </button>
        </div>

        {state?.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs border border-red-100 font-semibold">
            {state.error}
          </div>
        )}

        <input type="hidden" name="leadId" value={lead.id} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name *</label>
            <input
              required
              type="text"
              name="name"
              defaultValue={lead.name}
              className="block w-full rounded-xl border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Company</label>
            <input
              type="text"
              name="company"
              defaultValue={lead.company || ''}
              className="block w-full rounded-xl border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              defaultValue={lead.email || ''}
              className="block w-full rounded-xl border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
            <input
              type="text"
              name="phone"
              defaultValue={lead.phone || ''}
              className="block w-full rounded-xl border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Website URL</label>
            <input
              type="url"
              name="website"
              defaultValue={lead.website || ''}
              className="block w-full rounded-xl border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Location / City</label>
            <input
              type="text"
              name="city"
              defaultValue={lead.city || ''}
              className="block w-full rounded-xl border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Industry</label>
            <input
              type="text"
              name="industry"
              defaultValue={lead.industry || ''}
              className="block w-full rounded-xl border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
          >
            Cancel
          </button>
          <SubmitButton />
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in relative group">
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900">
          Contact & Business Profile
        </h3>
        <button
          onClick={() => setIsEditing(true)}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
        >
          Edit
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <span className="block text-xs font-bold text-slate-500 uppercase">Lead Name</span>
          <span className="text-sm text-slate-800 font-semibold mt-1 block">{lead.name}</span>
        </div>
        {lead.company && (
          <div>
            <span className="block text-xs font-bold text-slate-500 uppercase">Company</span>
            <span className="text-sm text-slate-800 font-semibold mt-1 block">{lead.company}</span>
          </div>
        )}
        {lead.email && (
          <div>
            <span className="block text-xs font-bold text-slate-500 uppercase">Email Address</span>
            <a href={`mailto:${lead.email}`} className="text-sm text-indigo-600 hover:underline font-semibold mt-1 block">
              {lead.email}
            </a>
          </div>
        )}
        {lead.phone && (
          <div>
            <span className="block text-xs font-bold text-slate-500 uppercase">Phone Number</span>
            <span className="text-sm text-slate-800 font-semibold mt-1 block">{lead.phone}</span>
          </div>
        )}
        {lead.website && (
          <div>
            <span className="block text-xs font-bold text-slate-500 uppercase">Website</span>
            <a href={lead.website} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline font-semibold mt-1 block">
              {lead.website}
            </a>
          </div>
        )}
        {lead.city && (
          <div>
            <span className="block text-xs font-bold text-slate-500 uppercase">Location / City</span>
            <span className="text-sm text-slate-800 font-semibold mt-1 block">{lead.city}</span>
          </div>
        )}
        {lead.industry && (
          <div>
            <span className="block text-xs font-bold text-slate-500 uppercase">Industry</span>
            <span className="text-sm text-slate-800 font-semibold mt-1 block">{lead.industry}</span>
          </div>
        )}
      </div>
    </div>
  );
}
