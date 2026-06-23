'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  generateOutreachDraftAction,
  updateDraftAction,
  recordApprovalAction,
  markAsSentAction,
  duplicateDraftAction,
  deleteDraftAction,
  getModelInfoAction,
} from '@/app/actions/outreach';
import type { Channel } from './ChannelSwitcher';

export interface OutreachDraft {
  id: string;
  leadId: string;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  origin?: string;
  createdByUserId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  attachments?: string | null;
  feedback?: string | null;
}

const CHANNEL_ORDER: Channel[] = ['EMAIL', 'LINKEDIN', 'CALL', 'MEETING'];

const CHANNEL_GUIDANCE = {
  EMAIL: {
    eyebrow: 'Primary outbound channel',
    headline: 'Write one evidence-backed email draft.',
    description: 'Lead with the clearest weakness, keep the ask simple, and make the next step obvious.',
    bullets: [
      'Open with one concrete observation from research or audit.',
      'Keep the body short enough to skim in a few seconds.',
      'End with a single low-friction ask.',
    ],
    cta: 'Generate email draft',
  },
  LINKEDIN: {
    eyebrow: 'Lightweight social outreach',
    headline: 'Keep the LinkedIn draft short and human.',
    description: 'This channel should feel like a grounded outreach note, not a mini-email.',
    bullets: [
      'Start with context, not a pitch.',
      'Use fewer words and lower commitment.',
      'Reference the most defensible evidence only.',
    ],
    cta: 'Generate LinkedIn draft',
  },
  CALL: {
    eyebrow: 'Call preparation',
    headline: 'Prepare a tight call opener and questions.',
    description: 'The goal is a useful opener, a few discovery prompts, and a clear close.',
    bullets: [
      'Write the opener in plain language.',
      'Add two or three discovery questions.',
      'Capture the next action instead of a script.',
    ],
    cta: 'Generate call prep',
  },
  MEETING: {
    eyebrow: 'Meeting preparation',
    headline: 'Structure the meeting around decisions.',
    description: 'Focus on agenda, context, and the outcome you want from the conversation.',
    bullets: [
      'Set the agenda and what needs to be learned.',
      'Include likely objections or clarifications.',
      'Keep the close focused on the next commitment.',
    ],
    cta: 'Generate meeting prep',
  },
};

const CHANNEL_SET = new Set<Channel>(CHANNEL_ORDER);

export function normalizeChannel(channel?: string): Channel {
  const normalized = channel?.toUpperCase() as Channel | undefined;
  return normalized && CHANNEL_SET.has(normalized) ? normalized : 'EMAIL';
}

function normalizeDraft(draft: OutreachDraft): OutreachDraft {
  return {
    ...draft,
    createdAt: draft.createdAt ? new Date(draft.createdAt) : null,
    updatedAt: draft.updatedAt ? new Date(draft.updatedAt) : null,
  };
}

export function useOutreachState(
  leadId: string,
  initialDrafts: OutreachDraft[],
  initialChannel?: string
) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [drafts, setDrafts] = useState<OutreachDraft[]>(() => initialDrafts.map(normalizeDraft));
  const [selectedChannel, setSelectedChannel] = useState<Channel>(() => normalizeChannel(initialChannel));
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  
  const [subjectInput, setSubjectInput] = useState('');
  const [bodyInput, setBodyInput] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; base64: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  
  const [generationOpen, setGenerationOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [comparePair, setComparePair] = useState<[string, string] | null>(null);
  const [modelInfo, setModelInfo] = useState<{ provider: string; modelName: string; hasVision: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OutreachDraft | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClose = () => setMenuOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [menuOpen]);

  useEffect(() => {
    setSelectedChannel(normalizeChannel(initialChannel));
  }, [initialChannel]);

  useEffect(() => {
    setDrafts(initialDrafts.map(normalizeDraft));
  }, [initialDrafts]);

  useEffect(() => {
    async function fetchInfo() {
      const res = await getModelInfoAction();
      if (res.success && res.info) {
        setModelInfo(res.info);
        return;
      }
      if (res.error) {
        console.warn('Failed to fetch model info:', res.error);
      }
    }
    fetchInfo();
  }, []);

  const channelDrafts = drafts.filter((draft) => normalizeChannel(draft.channel) === selectedChannel);
  const activeDraft = channelDrafts.find((draft) => draft.id === activeDraftId) ?? channelDrafts[0] ?? null;
  
  const draftCounts = CHANNEL_ORDER.reduce((acc, channel) => {
    acc[channel] = drafts.filter((draft) => normalizeChannel(draft.channel) === channel).length;
    return acc;
  }, {} as Record<Channel, number>);

  const channelGuidance = CHANNEL_GUIDANCE[selectedChannel];
  const editable = activeDraft ? activeDraft.status === 'DRAFT' || activeDraft.status === 'APPROVED' : false;
  const canReview = activeDraft?.status === 'DRAFT';
  const canSend = activeDraft?.status === 'APPROVED';
  const canDelete = activeDraft?.status === 'DRAFT';
  
  const isDirty = Boolean(
    activeDraft &&
    (subjectInput !== (activeDraft.subject ?? '') || bodyInput !== activeDraft.body)
  );
  
  const versionIndex = activeDraft ? channelDrafts.findIndex((draft) => draft.id === activeDraft.id) : -1;
  const versionLabel = activeDraft && versionIndex >= 0 ? `v${channelDrafts.length - versionIndex}` : null;

  useEffect(() => {
    if (channelDrafts.length === 0) {
      setActiveDraftId(null);
      setSubjectInput('');
      setBodyInput('');
      setFeedbackInput('');
      setCopied(false);
      return;
    }

    const hasActive = activeDraftId ? channelDrafts.some((draft) => draft.id === activeDraftId) : false;
    const nextActiveId = hasActive ? activeDraftId : channelDrafts[0].id;
    if (nextActiveId !== activeDraftId) {
      setActiveDraftId(nextActiveId);
    }
  }, [activeDraftId, channelDrafts]);

  useEffect(() => {
    if (!activeDraft) {
      setSubjectInput('');
      setBodyInput('');
      setFeedbackInput('');
      setCopied(false);
      return;
    }

    setSubjectInput(activeDraft.subject ?? '');
    setBodyInput(activeDraft.body);
    setFeedbackInput('');
    setCopied(false);
  }, [activeDraft?.id]);

  useEffect(() => {
    if (!isDirty) {
      setDrafts(initialDrafts.map(normalizeDraft));
    }
  }, [initialDrafts, isDirty]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [isDirty]);

  const updateUrl = useCallback((channel: Channel) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('view', 'outreach');
    next.set('channel', channel.toLowerCase());
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const updateDraftInState = useCallback((draftId: string, patch: Partial<OutreachDraft>) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId ? { ...draft, ...patch } : draft
      )
    );
  }, []);

  const handleChannelChange = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    setActiveDraftId(null);
    updateUrl(channel);
  }, [updateUrl]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    setIsUploadingAttachments(true);
    setErrorMsg(null);

    try {
      const uploaded = await Promise.all(
        fileList.map((file) =>
          new Promise<{ name: string; type: string; base64: string }>((resolve, reject) => {
            const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
            if (!validTypes.includes(file.type)) {
              reject(new Error(`Unsupported file type: ${file.name}. Use PNG, JPEG, WEBP, or PDF.`));
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              const result = typeof reader.result === 'string' ? reader.result : '';
              const base64String = result.split(',')[1];
              if (!base64String) {
                reject(new Error(`Could not read file: ${file.name}`));
                return;
              }
              resolve({ name: file.name, type: file.type, base64: base64String });
            };
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
          })
        )
      );

      setAttachments((current) => [...current, ...uploaded]);
    } catch (error: any) {
      setErrorMsg(error?.message || 'Failed to upload attachments');
    } finally {
      setIsUploadingAttachments(false);
      event.target.value = '';
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const saveCurrentDraft = useCallback(async (options?: { quiet?: boolean }) => {
    if (!activeDraft || !editable) return false;
    if (!isDirty) return true;

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const subject = subjectInput.trim() ? subjectInput.trim() : null;
      const result = await updateDraftAction(activeDraft.id, subject, bodyInput);
      if (result.error) {
        setErrorMsg(result.error);
        if (!options?.quiet) {
          toast.error(result.error);
        }
        return false;
      }

      const updatedAt = new Date();
      updateDraftInState(activeDraft.id, {
        subject,
        body: bodyInput,
        updatedAt,
      });
      if (!options?.quiet) {
        toast.success('Draft saved');
      }
      return true;
    } catch (error: any) {
      const message = error?.message || 'Failed to save draft';
      setErrorMsg(message);
      if (!options?.quiet) {
        toast.error(message);
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [activeDraft, editable, isDirty, subjectInput, bodyInput, updateDraftInState]);

  const refreshAfterMutation = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const response = await generateOutreachDraftAction(
        leadId,
        selectedChannel,
        customPrompt.trim() || undefined,
        attachments.length > 0 ? attachments : undefined
      );

      if (response.error) {
        setErrorMsg(response.error);
        toast.error(response.error);
        return;
      }

      const created = (response.drafts || []).map((draft: OutreachDraft) => normalizeDraft(draft));
      if (created.length > 0) {
        setDrafts((current) => [...created, ...current]);
        setActiveDraftId(created[0].id);
        setSelectedChannel(normalizeChannel(created[0].channel));
        updateUrl(normalizeChannel(created[0].channel));
      }

      setGenerationOpen(false);
      setCustomPrompt('');
      setAttachments([]);
      toast.success(created.length > 1 ? `${created.length} drafts generated` : 'Draft generated');
      refreshAfterMutation();
    } catch (error: any) {
      const message = error?.message || 'Failed to generate draft';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [leadId, selectedChannel, customPrompt, attachments, updateUrl, refreshAfterMutation]);

  const handleCopy = useCallback(async () => {
    if (!activeDraft) return;

    const payload = subjectInput.trim()
      ? `Subject: ${subjectInput.trim()}\n\n${bodyInput}`
      : bodyInput;

    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success('Draft copied to clipboard');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Copy failed');
    }
  }, [activeDraft, subjectInput, bodyInput]);

  const handleDuplicate = useCallback(async () => {
    if (!activeDraft) return;

    setIsDuplicating(true);
    setErrorMsg(null);
    try {
      const response = await duplicateDraftAction(activeDraft.id);
      if (response.error) {
        setErrorMsg(response.error);
        toast.error(response.error);
        return;
      }

      if (response.draft) {
        const duplicated = normalizeDraft(response.draft as OutreachDraft);
        setDrafts((current) => [duplicated, ...current]);
        setActiveDraftId(duplicated.id);
        const channel = normalizeChannel(duplicated.channel);
        setSelectedChannel(channel);
        updateUrl(channel);
        toast.success('Draft duplicated');
        refreshAfterMutation();
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to duplicate draft';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsDuplicating(false);
    }
  }, [activeDraft, updateUrl, refreshAfterMutation]);

  const handleApprove = useCallback(async () => {
    if (!activeDraft || activeDraft.status !== 'DRAFT') return;

    const saved = await saveCurrentDraft({ quiet: true });
    if (!saved) return;

    setIsApproving(true);
    setErrorMsg(null);
    try {
      const response = await recordApprovalAction(activeDraft.id, 'APPROVED');
      if (response.error) {
        setErrorMsg(response.error);
        toast.error(response.error);
        return;
      }

      updateDraftInState(activeDraft.id, { status: 'APPROVED', updatedAt: new Date() });
      setReviewOpen(false);
      toast.success('Draft approved');
      refreshAfterMutation();
    } catch (error: any) {
      const message = error?.message || 'Failed to approve draft';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsApproving(false);
    }
  }, [activeDraft, saveCurrentDraft, updateDraftInState, refreshAfterMutation]);

  const handleReject = useCallback(async () => {
    if (!activeDraft || activeDraft.status !== 'DRAFT') return;

    const saved = await saveCurrentDraft({ quiet: true });
    if (!saved) return;

    const feedback = feedbackInput.trim();
    if (!feedback) {
      toast.error('A feedback reason is required when rejecting a draft');
      return;
    }

    setIsRejecting(true);
    setErrorMsg(null);
    try {
      const response = await recordApprovalAction(activeDraft.id, 'REJECTED', feedback);
      if (response.error) {
        setErrorMsg(response.error);
        toast.error(response.error);
        return;
      }

      updateDraftInState(activeDraft.id, { status: 'REJECTED', updatedAt: new Date() });
      setReviewOpen(false);
      toast.success('Draft rejected');
      refreshAfterMutation();
    } catch (error: any) {
      const message = error?.message || 'Failed to reject draft';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsRejecting(false);
    }
  }, [activeDraft, saveCurrentDraft, feedbackInput, updateDraftInState, refreshAfterMutation]);

  const handleMarkSent = useCallback(async () => {
    if (!activeDraft || activeDraft.status !== 'APPROVED') return;

    const saved = await saveCurrentDraft({ quiet: true });
    if (!saved) return;

    setIsSending(true);
    setErrorMsg(null);
    try {
      const response = await markAsSentAction(activeDraft.id);
      if (response.error) {
        setErrorMsg(response.error);
        toast.error(response.error);
        return;
      }

      updateDraftInState(activeDraft.id, { status: 'SENT', updatedAt: new Date() });
      toast.success('Draft marked as sent');
      refreshAfterMutation();
    } catch (error: any) {
      const message = error?.message || 'Failed to mark draft as sent';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  }, [activeDraft, saveCurrentDraft, updateDraftInState, refreshAfterMutation]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setErrorMsg(null);
    try {
      const response = await deleteDraftAction(deleteTarget.id);
      if (response.error) {
        setErrorMsg(response.error);
        toast.error(response.error);
        return;
      }

      const nextDrafts = drafts.filter((draft) => draft.id !== deleteTarget.id);
      setDrafts(nextDrafts);
      setDeleteTarget(null);
      toast.success('Draft deleted');

      const nextChannelDrafts = nextDrafts.filter((draft) => normalizeChannel(draft.channel) === selectedChannel);
      if (nextChannelDrafts.length > 0) {
        setActiveDraftId(nextChannelDrafts[0].id);
      } else {
        setActiveDraftId(null);
      }

      refreshAfterMutation();
    } catch (error: any) {
      const message = error?.message || 'Failed to delete draft';
      setErrorMsg(message);
      toast.error(message);
    }
  }, [deleteTarget, drafts, selectedChannel, refreshAfterMutation]);

  const handleSelectVersion = useCallback((draft: OutreachDraft) => {
    const channel = normalizeChannel(draft.channel);
    setSelectedChannel(channel);
    setActiveDraftId(draft.id);
    setVersionOpen(false);
    updateUrl(channel);
  }, [updateUrl]);

  const handleCompareVersions = useCallback((firstId: string, secondId: string) => {
    setComparePair([firstId, secondId]);
    setVersionOpen(false);
  }, []);

  return {
    // States
    drafts,
    selectedChannel,
    activeDraftId,
    subjectInput,
    bodyInput,
    customPrompt,
    feedbackInput,
    attachments,
    errorMsg,
    copied,
    isGenerating,
    isSaving,
    isApproving,
    isRejecting,
    isSending,
    isDuplicating,
    isUploadingAttachments,
    generationOpen,
    reviewOpen,
    versionOpen,
    comparePair,
    modelInfo,
    deleteTarget,
    menuOpen,

    // State setters
    setSubjectInput,
    setBodyInput,
    setCustomPrompt,
    setFeedbackInput,
    setGenerationOpen,
    setReviewOpen,
    setVersionOpen,
    setComparePair,
    setDeleteTarget,
    setMenuOpen,
    setErrorMsg,

    // Computed
    channelDrafts,
    activeDraft,
    draftCounts,
    channelGuidance,
    editable,
    canReview,
    canSend,
    canDelete,
    isDirty,
    versionLabel,

    // Handlers
    handleChannelChange,
    handleFileChange,
    removeAttachment,
    saveCurrentDraft,
    handleGenerate,
    handleCopy,
    handleDuplicate,
    handleApprove,
    handleReject,
    handleMarkSent,
    handleDelete,
    handleSelectVersion,
    handleCompareVersions,
  };
}
