'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { bulkAdvanceStageAction, bulkAdvanceStageToAction, bulkResearchTriggerAction, bulkArchiveAction, bulkReassignAction, bulkExportAction, bulkAddTaskAction, bulkSetReminderAction } from '@/app/actions/bulk';
import { toast } from 'sonner';
import { ArrowRight, Plus, Bell, X, FlaskConical, Archive, UserRound, Download } from 'lucide-react';
import { PIPELINE_STAGES } from '@/services/lead';

export function BulkActionBar() {
  const router = useRouter();
  const { selectedIds, selectionCount, clearSelection } = useBulkSelect();
  const [activeDialog, setActiveDialog] = useState<'task' | 'reminder' | 'advance-to' | 'reassign' | null>(null);
  const [isLoading, setIsLoading] = useState(false);


  const ids = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const handleAdvance = async () => {
    setIsLoading(true);
    try {
      const result = await bulkAdvanceStageAction(ids);
      const parts: string[] = [];
      if (result.advanced > 0) parts.push(`Advanced ${result.advanced}`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
      if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);
      toast.success(parts.join(', ') || 'Done');
      clearSelection();
      router.refresh();
    } catch {
      toast.error('Failed to advance leads');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResearch = async () => {
    setIsLoading(true);
    try {
      const result = await bulkResearchTriggerAction(ids);
      const parts: string[] = [];
      if (result.triggered > 0) parts.push(`Started research for ${result.triggered}`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
      if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);
      toast.success(parts.join(', ') || 'Done');
      clearSelection();
      router.refresh();
    } catch {
      toast.error('Failed to trigger research');
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async () => {
    setIsLoading(true);
    try {
      const result = await bulkArchiveAction(ids);
      const parts: string[] = [];
      if (result.archived > 0) parts.push(`Archived ${result.archived}`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
      if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);
      toast.success(parts.join(', ') || 'Done');
      clearSelection();
      router.refresh();
    } catch {
      toast.error('Failed to archive leads');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await bulkExportAction(ids);
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.count} leads`);
      clearSelection();
    } catch {
      toast.error('Failed to export leads');
    } finally {
      setIsLoading(false);
    }
  }, [ids, clearSelection]);

  if (selectionCount === 0) return null;

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
          <Button variant="outline" size="sm" onClick={() => setActiveDialog('advance-to')} disabled={isLoading}>
            <ArrowRight className="w-3.5 h-3.5 mr-1" />
            Stage&hellip;
          </Button>
          <Button variant="outline" size="sm" onClick={handleResearch} disabled={isLoading}>
            <FlaskConical className="w-3.5 h-3.5 mr-1" />
            Research
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveDialog('task')} disabled={isLoading}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Task
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveDialog('reminder')} disabled={isLoading}>
            <Bell className="w-3.5 h-3.5 mr-1" />
            Remind
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveDialog('reassign')} disabled={isLoading}>
            <UserRound className="w-3.5 h-3.5 mr-1" />
            Reassign
          </Button>
          <Button variant="outline" size="sm" onClick={handleArchive} disabled={isLoading}>
            <Archive className="w-3.5 h-3.5 mr-1" />
            Archive
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Export
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
          <BulkTaskForm leadIds={ids} onSuccess={() => { setActiveDialog(null); clearSelection(); router.refresh(); }} />
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
          <BulkReminderForm leadIds={ids} onSuccess={() => { setActiveDialog(null); clearSelection(); router.refresh(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'advance-to'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectionCount} lead{selectionCount !== 1 ? 's' : ''} to stage</DialogTitle>
            <DialogDescription>
              Select the target pipeline stage. Stage requirements will be checked for each lead.
            </DialogDescription>
          </DialogHeader>
          <BulkAdvanceToForm leadIds={ids} onSuccess={() => { setActiveDialog(null); clearSelection(); router.refresh(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'reassign'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign {selectionCount} lead{selectionCount !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Change the owner for all selected leads.
            </DialogDescription>
          </DialogHeader>
          <BulkReassignForm leadIds={ids} onSuccess={() => { setActiveDialog(null); clearSelection(); router.refresh(); }} />
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

function BulkAdvanceToForm({ leadIds, onSuccess }: { leadIds: string[]; onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetStage, setTargetStage] = useState('Researching');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await bulkAdvanceStageToAction(leadIds, targetStage);
      const parts: string[] = [];
      if (result.advanced > 0) parts.push(`Moved ${result.advanced} to "${targetStage}"`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
      if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);
      toast.success(parts.join(', ') || 'Done');
      onSuccess();
    } catch {
      toast.error('Failed to move leads');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-label-12 text-muted-foreground">Target stage</label>
        <select value={targetStage} onChange={(e) => setTargetStage(e.target.value)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-copy-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
        <Button type="submit" disabled={isSubmitting}>Move Leads</Button>
      </DialogFooter>
    </form>
  );
}

function BulkReassignForm({ leadIds, onSuccess }: { leadIds: string[]; onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [ownerId, setOwnerId] = useState('');
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json() as Promise<{ data?: { id: string; name: string }[]; users?: { id: string; name: string }[] }>)
      .then((data) => {
        const list = data.data || data.users || [];
        setUsers(list);
        if (list.length > 0) setOwnerId(list[0].id);
      })
      .catch(() => toast.error('Failed to load users'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    setIsSubmitting(true);
    try {
      const result = await bulkReassignAction(leadIds, ownerId);
      const parts: string[] = [];
      if (result.reassigned > 0) parts.push(`Reassigned ${result.reassigned}`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
      if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);
      toast.success(parts.join(', ') || 'Done');
      onSuccess();
    } catch {
      toast.error('Failed to reassign leads');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-label-12 text-muted-foreground">New owner</label>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-copy-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
        <Button type="submit" disabled={isSubmitting || !ownerId || users.length === 0}>Reassign</Button>
      </DialogFooter>
    </form>
  );
}
