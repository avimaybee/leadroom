'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow disabled:opacity-50"
    >
      {pending ? 'Saving Note...' : 'Add Note'}
    </button>
  );
}

interface ClientNotesFormProps {
  leadId: string;
  addNoteAction: (prevState: { error?: string | null, success?: boolean } | null | undefined, formData: FormData) => Promise<{ error?: string | null, success?: boolean } | null | undefined>;
}

export default function ClientNotesForm({ leadId, addNoteAction }: ClientNotesFormProps) {
  const [state, formAction] = useActionState(addNoteAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error && formRef.current) {
      formRef.current.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      {state?.error && (
        <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-xs font-semibold border border-red-100">
          {state.error}
        </div>
      )}
      <input type="hidden" name="leadId" value={leadId} />
      <label htmlFor="note-body-input" className="sr-only">Add notes to lead</label>
      <textarea
        required
        id="note-body-input"
        name="body"
        placeholder="Type notes from calls, meetings, or research..."
        rows={3}
        className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
      />
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-slate-400 font-semibold italic">
          e.g. &apos;Called 6/14 — interested, follow up Friday&apos;
        </span>
        <SubmitButton />
      </div>
    </form>
  );
}
