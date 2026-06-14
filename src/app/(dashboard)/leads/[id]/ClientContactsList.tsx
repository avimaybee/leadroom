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
  addContactAction: (prevState: { error?: string | null, success?: boolean } | null | undefined, formData: FormData) => Promise<{ error?: string | null, success?: boolean } | null | undefined>;
  updateContactAction: (prevState: { error?: string | null, success?: boolean } | null | undefined, formData: FormData) => Promise<{ error?: string | null, success?: boolean } | null | undefined>;
  deleteContactAction: (leadId: string, contactId: string) => Promise<void>;
}

function SubmitButton({ label = 'Save Contact' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-50 shadow shadow-indigo-600/10"
    >
      {pending ? 'Saving...' : label}
    </button>
  );
}

export default function ClientContactsList({
  leadId,
  initialContacts,
  addContactAction,
  updateContactAction,
  deleteContactAction,
}: ClientContactsListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addState, addFormAction] = useActionState(addContactAction, undefined);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editState, editFormAction] = useActionState(updateContactAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (addState && !addState.error && formRef.current) {
      formRef.current.reset();
      setShowAddForm(false);
    }
  }, [addState]);

  useEffect(() => {
    if (editState && !editState.error) {
      setEditingContactId(null);
    }
  }, [editState]);

  const handleDelete = async (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      await deleteContactAction(leadId, contactId);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-950">
          Contacts & Stakeholders
        </h3>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingContactId(null);
          }}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
        >
          {showAddForm ? 'Cancel' : '+ Add Contact'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          ref={formRef}
          action={addFormAction}
          className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-4 animate-fade-in"
        >
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">New Contact Details</h4>
          {addState?.error && (
            <div className="bg-red-50 text-red-600 p-2 text-xs rounded border border-red-100 font-semibold">
              {addState.error}
            </div>
          )}

          <input type="hidden" name="leadId" value={leadId} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="contact-fullName" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
              <input
                required
                id="contact-fullName"
                type="text"
                name="fullName"
                placeholder="Jane Doe"
                className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div>
              <label htmlFor="contact-roleTitle" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role / Title</label>
              <input
                id="contact-roleTitle"
                type="text"
                name="roleTitle"
                placeholder="CEO / Marketing Director"
                className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
              <input
                id="contact-email"
                type="email"
                name="email"
                placeholder="jane@company.com"
                className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div>
              <label htmlFor="contact-phone" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Phone</label>
              <input
                id="contact-phone"
                type="text"
                name="phone"
                placeholder="+1 555-0199"
                className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="contact-linkedinUrl" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">LinkedIn Profile URL</label>
              <input
                id="contact-linkedinUrl"
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
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center space-y-3 animate-fade-in">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 mx-auto shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-900">No Stakeholder Contacts Recorded</h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                Add contacts, decision makers, and outreach recipients associated with this business profile.
              </p>
            </div>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition"
              >
                + Add First Contact
              </button>
            )}
          </div>
        ) : (
          initialContacts.map((contact) => (
            <div
              key={contact.id}
              className="p-3.5 rounded-xl border border-slate-200/80 shadow-sm bg-white hover:border-slate-300 transition-all"
            >
              {editingContactId === contact.id ? (
                <form action={editFormAction} className="space-y-3 animate-fade-in">
                  <h4 className="text-xs font-bold text-slate-950 uppercase tracking-wider">Edit Contact</h4>
                  {editState?.error && (
                    <div className="bg-red-50 text-red-600 p-2 text-xs rounded border border-red-100 font-semibold">
                      {editState.error}
                    </div>
                  )}

                  <input type="hidden" name="leadId" value={leadId} />
                  <input type="hidden" name="contactId" value={contact.id} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                      <input
                        required
                        type="text"
                        name="fullName"
                        defaultValue={contact.fullName || ''}
                        className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role / Title</label>
                      <input
                        type="text"
                        name="roleTitle"
                        defaultValue={contact.roleTitle || ''}
                        className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        defaultValue={contact.email || ''}
                        className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Phone</label>
                      <input
                        type="text"
                        name="phone"
                        defaultValue={contact.phone || ''}
                        className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">LinkedIn Profile URL</label>
                      <input
                        type="url"
                        name="linkedinUrl"
                        defaultValue={contact.linkedinUrl || ''}
                        className="block w-full rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`isPrimary-edit-${contact.id}`}
                      name="isPrimary"
                      defaultChecked={contact.isPrimary === 1}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                    />
                    <label htmlFor={`isPrimary-edit-${contact.id}`} className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                      Mark as primary contact for lead outreach
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingContactId(null)}
                      className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <SubmitButton label="Save Changes" />
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0 space-y-1 flex-1">
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingContactId(contact.id);
                        setShowAddForm(false);
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-indigo-600 p-1"
                      title="Edit Contact"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="text-xs font-bold text-slate-500 hover:text-red-600 p-1"
                      title="Delete Contact"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
