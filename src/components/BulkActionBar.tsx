'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBulkSelect } from './BulkSelectProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { bulkAdvanceStageAction, bulkAddTaskAction, bulkSetReminderAction } from '@/app/actions/bulk';
import { toast } from 'sonner';
import { ArrowRight, Plus, Bell, X } from 'lucide-react';

export function BulkActionBar() {
  const { selectedIds, selectionCount, clearSelection } = useBulkSelect();
  const [activeDialog, setActiveDialog] = useState<'task' | 'reminder' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (selectionCount === 0) return null;

  const ids = Array.from(selectedIds);

  const handleAdvance = async () => {
    setIsLoading(true);
    try {
      const result = await bulkAdvanceStageAction(ids);
      toast.success(`Advanced ${result.advanced} lead${result.advanced !== 1 ? 's' : ''}.${result.skipped > 0 ? ` ${result.skipped} skipped (terminal stage).` : ''}`);
      clearSelection();
    } catch {
      toast.error('Failed to advance leads');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-lg px-5 py-3 flex items-center gap-4 animate-fade-in">
        <span className="text-label-14 text-foreground font-semibold whitespace-nowrap">
          {selectionCount} selected
        </span>
        <div className="flex items-center gap-2 border-l border-border/50 pl-4">
          <Button variant="default" size="sm" onClick={handleAdvance} disabled={isLoading}>
            <ArrowRight className="w-3.5 h-3.5 mr-1" />
            Advance
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveDialog('task')} disabled={isLoading}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Task
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveDialog('reminder')} disabled={isLoading}>
            <Bell className="w-3.5 h-3.5 mr-1" />
            Remind
          </Button>
        </div>
        <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground transition-colors ml-2" disabled={isLoading}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <Dialog open={activeDialog === 'task'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add task to {selectionCount} lead{selectionCount !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              A task will be created for each selected lead with the same title, due date, and priority.
            </DialogDescription>
          </DialogHeader>
          <BulkTaskForm leadIds={ids} onSuccess={() => { setActiveDialog(null); clearSelection(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'reminder'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set reminder for {selectionCount} lead{selectionCount !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              A reminder notification will be created for each selected lead.
            </DialogDescription>
          </DialogHeader>
          <BulkReminderForm leadIds={ids} onSuccess={() => { setActiveDialog(null); clearSelection(); }} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function BulkTaskForm({ leadIds, onSuccess }: { leadIds: string[]; onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Medium');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await bulkAddTaskAction(leadIds, title.trim(), dueDate || null, priority);
      toast.success(`Task added to ${result.created} lead${result.created !== 1 ? 's' : ''}.`);
      onSuccess();
    } catch {
      toast.error('Failed to add tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-label-12 text-muted-foreground">Task title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-md border border-border bg-card px-3 py-2 text-copy-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="space-y-2">
        <label className="text-label-12 text-muted-foreground">Due date <span className="text-muted-foreground/60">(optional)</span></label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-copy-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="space-y-2">
        <label className="text-label-12 text-muted-foreground">Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-copy-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
        <Button type="submit" disabled={isSubmitting || !title.trim()}>Add Tasks</Button>
      </DialogFooter>
    </form>
  );
}

function BulkReminderForm({ leadIds, onSuccess }: { leadIds: string[]; onSuccess: () => void }) {
  const getDefaultDate = () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [remindAt, setRemindAt] = useState(getDefaultDate());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !remindAt) return;
    setIsSubmitting(true);
    try {
      const result = await bulkSetReminderAction(leadIds, title.trim(), remindAt);
      toast.success(`Reminder set for ${result.created} lead${result.created !== 1 ? 's' : ''}.`);
      onSuccess();
    } catch {
      toast.error('Failed to set reminders');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-label-12 text-muted-foreground">Reminder title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-md border border-border bg-card px-3 py-2 text-copy-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="space-y-2">
        <label className="text-label-12 text-muted-foreground">Date &amp; Time</label>
        <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} required className="w-full rounded-md border border-border bg-card px-3 py-2 text-copy-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
        <Button type="submit" disabled={isSubmitting || !title.trim() || !remindAt}>Set Reminders</Button>
      </DialogFooter>
    </form>
  );
}
