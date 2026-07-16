'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, Loader2, Save, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PIPELINE_STAGES, type PipelineStage } from '@/services/lead';
import { upsertPlaybookAction, togglePlaybookActiveAction, deletePlaybookAction } from '@/app/actions/pipeline';

interface PlaybookTaskInput {
  title: string;
  description?: string;
  daysOffset: number;
  priority: string;
  category?: string;
  actionType?: string;
  jobType?: string;
}

interface PlaybookData {
  id: string;
  stage: string;
  name: string;
  isActive: boolean;
  tasks: {
    id: string;
    title: string;
    description: string | null;
    daysOffset: number;
    priority: string;
    category: string | null;
    actionType: string;
    jobType: string | null;
  }[];
}

interface Props {
  initialPlaybooks: PlaybookData[];
}

const PRIORITIES = ['Low', 'Medium', 'High'];
const TASK_CATEGORIES = ['Follow-up', 'Research', 'Outreach', 'Review', 'Meeting Prep'];
const JOB_TYPES = ['RESEARCH_GENERATION', 'AUDIT_GENERATION', 'OUTREACH_DRAFT'];
const DEFAULT_PRIORITY = 'Medium';

function emptyTask(): PlaybookTaskInput {
  return { title: '', daysOffset: 0, priority: DEFAULT_PRIORITY, description: '', category: '', actionType: 'TASK', jobType: '' };
}

export function PlaybooksEditor({ initialPlaybooks }: Props) {
  const [playbooks, setPlaybooks] = useState<Record<string, PlaybookData>>(() => {
    const map: Record<string, PlaybookData> = {};
    for (const pb of initialPlaybooks) {
      map[pb.stage] = {
        ...pb,
        tasks: pb.tasks.map((t) => ({ ...t, actionType: (t as any).actionType || 'TASK', jobType: (t as any).jobType || null })),
      };
    }
    return map;
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { name: string; tasks: PlaybookTaskInput[] }>>({});
  const [saving, setSaving] = useState(false);

  const existingStages = useMemo(() => new Set(Object.keys(playbooks)), [playbooks]);

  const getDraft = useCallback((stage: string) => {
    if (drafts[stage]) return drafts[stage];
    const existing = playbooks[stage];
    if (existing) {
      return {
        name: existing.name,
        tasks: existing.tasks.map((t) => ({
          title: t.title,
          description: t.description || '',
          daysOffset: t.daysOffset,
          priority: t.priority,
          category: t.category || '',
          actionType: (t as any).actionType || 'TASK',
          jobType: (t as any).jobType || '',
        })),
      };
    }
    return { name: `Playbook: ${stage}`, tasks: [emptyTask()] };
  }, [drafts, playbooks]);

  const setDraftField = (stage: string, field: 'name' | 'tasks', value: any) => {
    setDrafts((prev) => ({
      ...prev,
      [stage]: { ...getDraft(stage), [field]: value },
    }));
  };

  const setTaskField = (stage: string, index: number, field: keyof PlaybookTaskInput, value: any) => {
    const draft = getDraft(stage);
    const tasks = [...draft.tasks];
    tasks[index] = { ...tasks[index], [field]: value };
    setDraftField(stage, 'tasks', tasks);
  };

  const addTask = (stage: string) => {
    const draft = getDraft(stage);
    setDraftField(stage, 'tasks', [...draft.tasks, emptyTask()]);
  };

  const removeTask = (stage: string, index: number) => {
    const draft = getDraft(stage);
    setDraftField(stage, 'tasks', draft.tasks.filter((_, i) => i !== index));
  };

  const handleSave = async (stage: string) => {
    const draft = getDraft(stage);
    const validTasks = draft.tasks.filter((t) => t.title.trim().length > 0);
    if (validTasks.length === 0) {
      toast.error('Add at least one task with a title');
      return;
    }

    setSaving(true);
    const result = await upsertPlaybookAction(
      stage,
      draft.name,
      validTasks.map((t) => ({
        title: t.title.trim(),
        description: t.description?.trim() || undefined,
        daysOffset: t.daysOffset,
        priority: t.priority,
        category: t.category?.trim() || undefined,
        actionType: t.actionType || 'TASK',
        jobType: t.actionType === 'JOB' ? t.jobType || undefined : undefined,
      })),
    );
    setSaving(false);

    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`Playbook saved for ${stage}`);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[stage];
        return next;
      });
      setExpanded(null);
    }
  };

  const handleToggleActive = async (stage: string, isActive: boolean) => {
    const pb = playbooks[stage];
    if (!pb) return;
    const result = await togglePlaybookActiveAction(stage, isActive);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setPlaybooks((prev) => ({
        ...prev,
        [stage]: { ...prev[stage], isActive },
      }));
      toast.success(isActive ? 'Playbook activated' : 'Playbook paused');
    }
  };

  const handleDelete = async (stage: string) => {
    const result = await deletePlaybookAction(stage);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setPlaybooks((prev) => {
        const next = { ...prev };
        delete next[stage];
        return next;
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[stage];
        return next;
      });
      setExpanded(null);
      toast.success('Playbook deleted');
    }
  };

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[1fr_100px_auto] gap-4 px-4 pb-2 border-b border-border mb-2">
        <span className="text-label-12 text-muted-foreground uppercase">Stage</span>
        <span className="text-label-12 text-muted-foreground uppercase text-center">Status</span>
        <span className="text-label-12 text-muted-foreground uppercase">Tasks</span>
      </div>

      {(PIPELINE_STAGES as readonly string[]).map((stage) => {
        const pb = playbooks[stage];
        const isExpanded = expanded === stage;
        const draft = isExpanded ? getDraft(stage) : null;

        return (
          <div key={stage}>
            <div
              className={`grid grid-cols-[1fr_100px_auto] gap-4 items-center px-4 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-muted/30 ${
                isExpanded ? 'bg-muted/20 border border-border' : ''
              }`}
              onClick={() => setExpanded(isExpanded ? null : stage)}
            >
              <span className="text-label-14 text-foreground font-semibold">{stage}</span>

              <div className="flex justify-center">
                {pb ? (
                  <span className={`inline-flex items-center gap-1.5 text-label-12 font-semibold ${pb.isActive ? 'text-chart-2' : 'text-muted-foreground'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pb.isActive ? 'bg-chart-2' : 'bg-muted-foreground'}`} />
                    {pb.isActive ? 'Active' : 'Paused'}
                  </span>
                ) : (
                  <span className="text-label-12 text-muted-foreground">—</span>
                )}
              </div>

              <div className="text-label-12 text-muted-foreground">
                {pb ? `${pb.tasks.length} task${pb.tasks.length !== 1 ? 's' : ''}` : 'No playbook'}
              </div>
            </div>

            {isExpanded && (
              <div className="ml-6 mt-2 mb-4 p-4 border border-border rounded-lg bg-muted/10 space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-label-12 text-muted-foreground shrink-0 w-16">Name</label>
                  <input
                    type="text"
                    value={draft?.name || ''}
                    onChange={(e) => setDraftField(stage, 'name', e.target.value)}
                    className="flex-1 min-h-9 rounded-md border border-border bg-card px-3 text-label-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={`Playbook: ${stage}`}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-label-12 text-muted-foreground uppercase">Tasks</span>
                    <Button variant="ghost" size="xs" onClick={() => addTask(stage)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
                    </Button>
                  </div>

                  {draft?.tasks.map((task, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_90px_90px_100px_80px_auto_32px] gap-2 items-start p-2 rounded-md bg-card border border-border">
                      <div className="space-y-1 min-w-0">
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => setTaskField(stage, idx, 'title', e.target.value)}
                          className="w-full min-h-8 rounded border border-border bg-background px-2 text-label-14 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="Task title"
                        />
                        <input
                          type="text"
                          value={task.description || ''}
                          onChange={(e) => setTaskField(stage, idx, 'description', e.target.value)}
                          className="w-full min-h-7 rounded border border-border bg-background px-2 text-label-12 text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="Optional description"
                        />
                      </div>
                      <div>
                        <label className="block text-label-12 text-muted-foreground mb-0.5">Type</label>
                        <select
                          value={task.actionType || 'TASK'}
                          onChange={(e) => setTaskField(stage, idx, 'actionType', e.target.value)}
                          className="w-full min-h-8 rounded border border-border bg-background px-2 text-label-14 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="TASK">Task</option>
                          <option value="JOB">Job</option>
                        </select>
                      </div>
                      {task.actionType === 'JOB' && (
                        <div>
                          <label className="block text-label-12 text-muted-foreground mb-0.5">Job Type</label>
                          <select
                            value={task.jobType || ''}
                            onChange={(e) => setTaskField(stage, idx, 'jobType', e.target.value)}
                            className="w-full min-h-8 rounded border border-border bg-background px-2 text-label-14 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="">Select&hellip;</option>
                            {JOB_TYPES.map((j) => <option key={j} value={j}>{j}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-label-12 text-muted-foreground mb-0.5">Days</label>
                        <input
                          type="number"
                          min={0}
                          value={task.daysOffset}
                          onChange={(e) => setTaskField(stage, idx, 'daysOffset', Number(e.target.value))}
                          className="w-full min-h-8 rounded border border-border bg-background px-2 text-label-14 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-label-12 text-muted-foreground mb-0.5">Priority</label>
                        <select
                          value={task.priority}
                          onChange={(e) => setTaskField(stage, idx, 'priority', e.target.value)}
                          className="w-full min-h-8 rounded border border-border bg-background px-2 text-label-14 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-label-12 text-muted-foreground mb-0.5">Category</label>
                        <select
                          value={task.category || ''}
                          onChange={(e) => setTaskField(stage, idx, 'category', e.target.value)}
                          className="w-full min-h-8 rounded border border-border bg-background px-2 text-label-14 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">None</option>
                          {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTask(stage, idx)}
                        className="mt-5 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    {playbooks[stage] && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(stage, !playbooks[stage].isActive)}
                        >
                          {playbooks[stage].isActive ? <Square className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                          {playbooks[stage].isActive ? 'Pause' : 'Activate'}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(stage)}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setExpanded(null); }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => handleSave(stage)} disabled={saving}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}
