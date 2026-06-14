'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, ClipboardCheck } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Adding Task...' : 'Add Task'}
    </Button>
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
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowForm(true)}
          className="w-full"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Task
        </Button>

        {tasksCount === 0 && (
          <div className="bg-muted/30 border border-dashed border-border rounded-xl p-6 text-center space-y-3 animate-fade-in">
            <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center text-muted-foreground mx-auto shadow-sm">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">No Tasks Configured</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                Keep track of outreach plans, follow-ups, audits, and meetings for this lead.
              </p>
            </div>
            <Button
              type="button"
              variant="link"
              onClick={() => setShowForm(true)}
            >
              Create First Task &rarr;
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border/60 animate-fade-in">
      <div className="flex justify-between items-center pb-1 border-b border-border/40">
        <h4 className="text-xs font-bold text-foreground">Configure New Task</h4>
        <Button type="button" variant="ghost" size="xs" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
      {state?.error && (
        <div className="bg-destructive/10 text-destructive p-2.5 rounded-lg text-xs border border-destructive/20 font-semibold">
          {state.error}
        </div>
      )}
      <input type="hidden" name="leadId" value={leadId} />
      
      <div className="space-y-3">
        <div>
          <Label htmlFor="task-title" className="sr-only">Task Title</Label>
          <Input 
            required
            id="task-title"
            type="text"
            name="title"
            placeholder="Task title..."
          />
        </div>
        <div>
          <Label htmlFor="task-desc" className="sr-only">Task Description</Label>
          <Input 
            id="task-desc"
            type="text"
            name="description"
            placeholder="Short description..."
          />
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="task-due-date" className="block text-xs font-bold text-foreground mb-1">Due Date</Label>
            <Input 
              id="task-due-date"
              type="date"
              name="dueDate"
            />
          </div>
          <div>
            <Label htmlFor="task-priority" className="block text-xs font-bold text-foreground mb-1">Priority</Label>
            <select 
              id="task-priority"
              name="priority"
              defaultValue="Medium"
              className="block w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground"
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
