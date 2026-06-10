'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

interface Contact {
  id: string;
  leadId: string;
  fullName: string | null;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  otherProfileUrl: string | null;
  isPrimary: number; // 0 or 1
  confidenceLevel: string;
  sourceType: string;
}

interface ClientContactsListProps {
  leadId: string;
  initialContacts: Contact[];
  addContactAction: (prevState: any, formData: FormData) => Promise<any>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-50"
    >
      {pending ? 'Saving...' : 'Save Contact'}
    </button>
  );
}

export default function ClientContactsList({
  leadId,
  initialContacts,
  addContactAction,
}: ClientContactsListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [state, formAction] = useActionState(addContactAction, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error && formRef.current) {
      formRef.current.reset();
      setShowAddForm(false);
    }
  }, [state]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider">
          Contacts & Stakeholders
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
        >
          {showAddForm ? 'Cancel' : '+ Add Contact'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          ref={formRef}
          action={formAction}
          className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-4 animate-fade-in"
        >
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Contact Details</h4>
          {state?.error && (
            <div className="bg-red-50 text-red-600 p-2 text-xs rounded border border-red-100 font-semibold">
              {state.error}
            </div>
          )}

          <input type="hidden" name="leadId" value={leadId} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
              <input
                required
                type="text"
                name="fullName"
                placeholder="Jane Doe"
                className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role / Title</label>
              <input
                type="text"
                name="roleTitle"
                placeholder="CEO / Marketing Director"
                className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
              <input
                type="email"
                name="email"
                placeholder="jane@company.com"
                className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</label>
              <input
                type="text"
                name="phone"
                placeholder="+1 555-0199"
                className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">LinkedIn Profile URL</label>
              <input
                type="url"
                name="linkedinUrl"
                placeholder="https://linkedin.com/in/username"
                className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimary"
              name="isPrimary"
              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
            />
            <label htmlFor="isPrimary" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
              Mark as primary contact for lead outreach
            </label>
          </div>

          <div className="flex justify-end pt-1">
            <SubmitButton />
          </div>
        </form>
      )}

      {/* List */}
      <div className="space-y-3">
        {initialContacts.length === 0 ? (
          <p className="text-center text-xs font-semibold text-slate-400 py-4">
            No contacts recorded. Click "+ Add Contact" to add manually.
          </p>
        ) : (
          initialContacts.map((contact) => (
            <div
              key={contact.id}
              className="p-3.5 rounded-xl border border-slate-200/80 shadow-sm bg-white hover:border-slate-300 transition-all flex justify-between items-start"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 block leading-tight">
                    {contact.fullName}
                  </span>
                  {contact.isPrimary === 1 && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                      Primary
                    </span>
                  )}
                </div>
                {contact.roleTitle && (
                  <p className="text-xs font-semibold text-slate-500 leading-tight">{contact.roleTitle}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {contact.phone}
                    </span>
                  )}
                  {contact.linkedinUrl && (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.8v8.37h2.8v-4.67c0-.25.02-.5.1-.68a1.14 1.14 0 0 1 1-.77c.76 0 1 .58 1 1.42v4.7h2.8M6.5 8.37a1.37 1.37 0 0 0 0-2.75 1.37 1.37 0 0 0 0 2.75M8 18.5V10.13H5v8.37h3z" />
                      </svg>
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
