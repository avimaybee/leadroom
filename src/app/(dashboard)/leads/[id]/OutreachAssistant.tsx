'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { ErrorBoundary } from './ErrorBoundary';
import { 
  generateOutreachDraftAction, 
  updateDraftAction, 
  recordApprovalAction, 
  markAsSentAction,
  duplicateDraftAction,
  deleteDraftAction,
  getModelInfoAction
} from '@/app/actions/outreach';

interface OutreachDraft {
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
}

interface OutreachAssistantProps {
  leadId: string;
  initialDrafts: OutreachDraft[];
  researchSnapshot: any;
  auditSnapshot: any;
}

function OutreachAssistantInner({ leadId, initialDrafts, researchSnapshot, auditSnapshot }: OutreachAssistantProps) {
  const router = useRouter();

  const [drafts, setDrafts] = useState<OutreachDraft[]>(initialDrafts);
  const [selectedChannel, setSelectedChannel] = useState<'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING'>('EMAIL');
  
  // Find current active draft for selected channel if any
  const channelDrafts = drafts.filter(d => d.channel === selectedChannel);
  // Default to the latest draft for this channel
  const [activeDraftId, setActiveDraftId] = useState<string | null>(
    channelDrafts.length > 0 ? channelDrafts[0].id : null
  );

  // Fallback to latest draft if activeDraftId is not in channelDrafts anymore when changing channels
  const activeDraft = drafts.find(d => d.id === activeDraftId) || channelDrafts[0] || null;

  // Local editing states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [subjectInput, setSubjectInput] = useState(activeDraft?.subject || '');
  const [bodyInput, setBodyInput] = useState(activeDraft?.body || '');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareDraftId, setCompareDraftId] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
  } | null>(null);

  const [modelInfo, setModelInfo] = useState<{ provider: string; modelName: string; hasVision: boolean } | null>(null);
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; base64: string }>>([]);

  useEffect(() => {
    async function fetchInfo() {
      const res = await getModelInfoAction();
      if (res.success && res.info) {
        setModelInfo(res.info);
      } else {
        console.warn('Failed to fetch model info:', res.error);
      }
    }
    fetchInfo();
  }, []);

  // Sync draft list when server re-renders after router.refresh()
  useEffect(() => {
    setDrafts(initialDrafts);
  }, [initialDrafts]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setIsUploadingAttachments(true);
    setErrorMsg(null);

    try {
      const results = await Promise.all(
        filesArray.map((file) => {
          return new Promise<{ name: string; type: string; base64: string }>((resolve, reject) => {
            const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
            if (!validTypes.includes(file.type)) {
              reject(new Error(`Unsupported file type: ${file.name}. Only images (PNG, JPEG, WEBP) and PDFs are allowed.`));
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = (reader.result as string).split(',')[1];
              resolve({ name: file.name, type: file.type, base64: base64String });
            };
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
          });
        })
      );

      setAttachments((prev) => [...prev, ...results]);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to upload attachments');
    } finally {
      setIsUploadingAttachments(false);
    }

    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const renderAttachmentUploadUI = () => (
    <div className="w-full space-y-2 text-left">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attachments (Images/PDFs)</span>
        {modelInfo && (
          <span className="text-[10px] text-slate-400 font-semibold">
            Active: {modelInfo.modelName} ({modelInfo.hasVision ? 'Multimodal' : 'Text-Only'})
          </span>
        )}
      </div>
      
      {/* File Select Area */}
      <label className="flex items-center justify-center border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
        <input
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          {isUploadingAttachments ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Choose Files</span>
            </>
          )}
        </div>
      </label>

      {/* Warning Banner */}
      {modelInfo && !modelInfo.hasVision && attachments.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-xs font-bold flex items-start gap-1.5 leading-normal">
          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            The active model lacks vision capabilities. Attached files will be uploaded, but text/image content will not be processed by the model.
          </div>
        </div>
      )}

      {/* Attachment Pills */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {attachments.map((att, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-700 rounded-lg">
              <span className="truncate max-w-[120px]">{att.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="text-indigo-400 hover:text-indigo-600 font-bold ml-1 text-xs"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  // Auto-resize body textarea
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs for keyboard shortcut access (initialized here, assigned after handleSaveEdits)
  const saveEditsRef = useRef<() => void>(() => {});
  const activeDraftStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';
  }, [bodyInput]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeDraftStatusRef.current === 'DRAFT') {
          saveEditsRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync inputs when active draft changes (e.g. fallback selection after channel switch)
  useEffect(() => {
    if (activeDraft) {
      setSubjectInput(activeDraft.subject || '');
      setBodyInput(activeDraft.body || '');
      setFeedbackInput('');
    }
  }, [activeDraft?.id]);

  const handleChannelChange = (channel: 'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING') => {
    setSelectedChannel(channel);
    const filtered = drafts.filter(d => d.channel === channel);
    if (filtered.length > 0) {
      setActiveDraftId(filtered[0].id);
      setSubjectInput(filtered[0].subject || '');
      setBodyInput(filtered[0].body || '');
    } else {
      setActiveDraftId(null);
      setSubjectInput('');
      setBodyInput('');
    }
    setFeedbackInput('');
    setErrorMsg(null);
  };

  const handleDuplicate = async () => {
    if (!activeDraft) return;
    setIsDuplicating(true);
    setErrorMsg(null);
    try {
      const res = await duplicateDraftAction(activeDraft.id);
      if (res.error) {
        throw new Error(res.error);
      }
      if (res.draft) {
        const parsedDraft: OutreachDraft = {
          ...res.draft,
          createdAt: res.draft.createdAt ? new Date(res.draft.createdAt) : null,
          updatedAt: res.draft.updatedAt ? new Date(res.draft.updatedAt) : null,
        };
        const updatedList = [parsedDraft, ...drafts];
        setDrafts(updatedList);
        setActiveDraftId(parsedDraft.id);
        setSubjectInput(parsedDraft.subject || '');
        setBodyInput(parsedDraft.body || '');
        toast.success('Draft duplicated');
        router.refresh();
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to duplicate draft');
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleSelectDraft = (draft: OutreachDraft) => {
    setActiveDraftId(draft.id);
    setSubjectInput(draft.subject || '');
    setBodyInput(draft.body || '');
    setFeedbackInput('');
    setErrorMsg(null);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const res = await generateOutreachDraftAction(leadId, selectedChannel, customPrompt, attachments);
      if (res.error) {
        throw new Error(res.error);
      }
      if (res.drafts && res.drafts.length > 0) {
        const parsedDrafts: OutreachDraft[] = res.drafts.map((d: any) => ({
          ...d,
          createdAt: d.createdAt ? new Date(d.createdAt) : null,
          updatedAt: d.updatedAt ? new Date(d.updatedAt) : null,
        }));
        const updatedList = [...parsedDrafts, ...drafts];
        setDrafts(updatedList);
        setActiveDraftId(parsedDrafts[0].id);
        setSubjectInput(parsedDrafts[0].subject || '');
        setBodyInput(parsedDrafts[0].body || '');
        setAttachments([]); // Clear attachments after generation
        toast.success('Draft generated successfully');
        router.refresh();
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate outreach draft');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!activeDraft) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await updateDraftAction(activeDraft.id, subjectInput || null, bodyInput);
      if (res.error) {
        throw new Error(res.error);
      }
      // Update local state
      setDrafts(drafts.map(d => d.id === activeDraft.id ? { ...d, subject: subjectInput, body: bodyInput, updatedAt: new Date() } : d));
      toast.success('Draft saved successfully');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Assign refs for keyboard shortcut access
  saveEditsRef.current = handleSaveEdits;
  activeDraftStatusRef.current = activeDraft?.status;

  const executeApproval = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!activeDraft) return;
    if (decision === 'APPROVED') setIsApproving(true);
    else setIsRejecting(true);
    setErrorMsg(null);

    try {
      // Auto-save current edits before approving
      if (decision === 'APPROVED' && activeDraft.status === 'DRAFT') {
        const currentSubject = subjectInput || null;
        const currentBody = bodyInput;
        const hasChanges = currentSubject !== activeDraft.subject || currentBody !== activeDraft.body;
        if (hasChanges) {
          const saveRes = await updateDraftAction(activeDraft.id, currentSubject, currentBody);
          if (saveRes.error) {
            throw new Error(saveRes.error);
          }
          setDrafts(drafts.map(d =>
            d.id === activeDraft.id
              ? { ...d, subject: currentSubject, body: currentBody, updatedAt: new Date() }
              : d
          ));
        }
      }

      const res = await recordApprovalAction(activeDraft.id, decision, feedbackInput || undefined);
      if (res.error) {
        throw new Error(res.error);
      }
      setDrafts(drafts.map(d => d.id === activeDraft.id ? { ...d, status: decision, updatedAt: new Date() } : d));
      setFeedbackInput('');
      toast.success(decision === 'APPROVED' ? 'Draft approved' : 'Draft rejected');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to record decision');
    } finally {
      setIsApproving(false);
      setIsRejecting(false);
    }
  };

  const handleApproval = (decision: 'APPROVED' | 'REJECTED') => {
    if (!activeDraft) return;

    if (decision === 'REJECTED' && !feedbackInput.trim()) {
      toast.error('Feedback is required when rejecting a draft');
      return;
    }

    if (decision === 'APPROVED') {
      setConfirmDialog({
        message: 'Are you sure you want to approve this draft? This action cannot be undone.',
        confirmLabel: 'Approve',
        onConfirm: () => executeApproval(decision),
      });
      return;
    }

    executeApproval(decision);
  };

  const handleMarkAsSent = async () => {
    if (!activeDraft) return;
    setIsSending(true);
    setErrorMsg(null);

    try {
      const res = await markAsSentAction(activeDraft.id);
      if (res.error) {
        throw new Error(res.error);
      }
      setDrafts(drafts.map(d => d.id === activeDraft.id ? { ...d, status: 'SENT', updatedAt: new Date() } : d));
      toast.success('Marked as sent');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark as sent');
    } finally {
      setIsSending(false);
    }
  };

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const copyToClipboard = () => {
    if (!activeDraft) return;
    const textToCopy = activeDraft.subject 
      ? `Subject: ${activeDraft.subject}\n\n${activeDraft.body}`
      : activeDraft.body;

    try {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'SENT':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      default:
        return 'bg-amber-50 text-amber-700 border border-amber-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      case 'SENT': return 'Sent';
      default: return 'Draft';
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Outreach Assistant</h3>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Prepare, edit, and approve personalized outreach messages.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          {(['EMAIL', 'LINKEDIN', 'CALL', 'MEETING'] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => handleChannelChange(ch)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                selectedChannel === ch
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {ch === 'EMAIL' ? 'Email' : ch === 'LINKEDIN' ? 'LinkedIn' : ch === 'CALL' ? 'Call Prep' : 'Meeting Prep'}
            </button>
          ))}
        </div>
      </div>

        {/* Draft Comparison Toggle */}
        {channelDrafts.length >= 2 && (
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              if (!compareMode) {
                setShowPreview(false);
              }
            }}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
              compareMode
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-slate-600 hover:text-indigo-600 border-slate-200'
            }`}
          >
            {compareMode ? 'Exit Compare' : `Compare Drafts (${channelDrafts.length})`}
          </button>
        )}

        {/* Context Panel Toggle */}
      {(researchSnapshot || auditSnapshot) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden transition-all duration-300">
          <button
            onClick={() => setShowContext(!showContext)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <span>View Lead Context (Audit & Research)</span>
            <svg
              className={`w-4 h-4 transform transition-transform ${showContext ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showContext && (
            <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {auditSnapshot && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-1">Audit Highlights</h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 font-semibold max-h-[150px] overflow-y-auto">
                    {auditSnapshot.keyWeaknesses && <li><span className="font-bold text-slate-800">Weaknesses:</span> {auditSnapshot.keyWeaknesses}</li>}
                    {auditSnapshot.recommendedImprovements && <li><span className="font-bold text-slate-800">Recommendations:</span> {auditSnapshot.recommendedImprovements}</li>}
                  </ul>
                </div>
              )}
              {researchSnapshot && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-1">Research Highlights</h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 font-semibold max-h-[150px] overflow-y-auto">
                    {researchSnapshot.companySummary && <li><span className="font-bold text-slate-800">Summary:</span> {researchSnapshot.companySummary}</li>}
                    {researchSnapshot.painPointsHypotheses && <li><span className="font-bold text-slate-800">Pain Points:</span> {researchSnapshot.painPointsHypotheses}</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full mx-4 space-y-4">
            <p className="text-sm font-bold text-slate-900">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 transition"
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Active Draft Details / Creation */}
        <div className="lg:col-span-3 space-y-4">
          {/* Comparison View */}
          {compareMode && channelDrafts.length >= 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700">Compare Drafts</h4>
                <button
                  onClick={() => setCompareMode(false)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {channelDrafts.slice(0, 2).map((draft, idx) => (
                  <div
                    key={draft.id}
                    className={`bg-white border rounded-xl p-4 space-y-2 ${
                      compareDraftId === draft.id
                        ? 'border-indigo-400 ring-2 ring-indigo-100'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg ${getStatusBadge(draft.status)}`}>
                        {getStatusLabel(draft.status)}
                      </span>
                      <button
                        onClick={() => {
                          setActiveDraftId(draft.id);
                          setSubjectInput(draft.subject || '');
                          setBodyInput(draft.body || '');
                          setCompareMode(false);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                      >
                        Edit
                      </button>
                    </div>
                    {draft.subject && (
                      <p className="text-xs font-bold text-slate-900">{draft.subject}</p>
                    )}
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {draft.body}
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      {draft.createdAt ? new Date(draft.createdAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
              {channelDrafts.length > 2 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[10px] font-bold">
                  Showing the 2 most recent drafts. {channelDrafts.length - 2} more draft(s) available in the sidebar.
                </div>
              )}
            </div>
          )}

          {!activeDraft ? (
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200/60 border-dashed text-center flex flex-col items-center justify-center space-y-4">
              <span className="p-3 bg-slate-100 text-slate-500 rounded-full">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </span>
              <div className="max-w-sm space-y-1">
                <p className="text-sm font-bold text-slate-800">No {selectedChannel.toLowerCase()} draft generated yet</p>
                <p className="text-xs text-slate-400 font-semibold">Generate a tailored message template referencing the website audit scores and opportunities.</p>
              </div>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Custom Instructions (Optional)"
                className="w-full max-w-sm text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl p-3 focus:border-indigo-500 focus:outline-none resize-y min-h-[60px]"
              />
              <div className="w-full max-w-sm">
                {renderAttachmentUploadUI()}
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow shadow-indigo-600/10 flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate AI Draft'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg ${getStatusBadge(activeDraft.status)}`}>
                    {getStatusLabel(activeDraft.status)}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    Last updated: {activeDraft.updatedAt ? new Date(activeDraft.updatedAt).toLocaleString() : 'N/A'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 bg-white transition text-[10px] font-bold flex items-center gap-1.5"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2a8.001 8.001 0 1121.21 7.89H18v3" />
                        </svg>
                        Regenerate
                      </>
                    )}
                  </button>

                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 bg-white transition text-[10px] font-bold flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v3m2 4H6a2 2 0 00-2 2v3a2 2 0 002 2h2m4 0h2a2 2 0 002-2v-3m-2-4h2a2 2 0 002-2V7a2 2 0 00-2-2h-2m-9 5h8" />
                    </svg>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>

                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`p-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 transition ${
                      showPreview
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200 bg-white'
                    }`}
                    aria-label={showPreview ? 'Show editor' : 'Show preview'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {showPreview ? 'Edit' : 'Preview'}
                  </button>

                  {activeDraft.status === 'DRAFT' && (
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          message: `Delete this ${selectedChannel.toLowerCase()} draft? This cannot be undone.`,
                          confirmLabel: 'Delete',
                          onConfirm: async () => {
                            const res = await deleteDraftAction(activeDraft.id);
                            if (res.error) {
                              toast.error(res.error);
                              return;
                            }
                            const updatedList = drafts.filter(d => d.id !== activeDraft.id);
                            setDrafts(updatedList);
                            if (activeDraftId === activeDraft.id) {
                              setActiveDraftId(updatedList.length > 0 ? updatedList[0].id : null);
                            }
                            toast.success('Draft deleted');
                            router.refresh();
                          },
                        });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 bg-white transition text-[10px] font-bold flex items-center gap-1.5"
                      aria-label="Delete draft"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  )}

                  {activeDraft.status === 'APPROVED' && (
                    <button
                      onClick={handleMarkAsSent}
                      disabled={isSending}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition shadow shadow-indigo-600/10 flex items-center gap-1"
                    >
                      {isSending ? 'Marking...' : 'Mark as Sent'}
                    </button>
                  )}
                </div>
              </div>

              {/* Edit / View Form */}
              <div className="space-y-3">
                {selectedChannel === 'EMAIL' && (
                  <div>
                    <label htmlFor="subject-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Subject</label>
                    <input
                      id="subject-input"
                      type="text"
                      value={subjectInput}
                      onChange={(e) => setSubjectInput(e.target.value)}
                      disabled={activeDraft.status !== 'DRAFT'}
                      className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="body-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Message Body</label>
                  {showPreview && activeDraft ? (
                    <div className="w-full bg-white border border-slate-200 rounded-xl p-4 min-h-[200px] text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {selectedChannel === 'EMAIL' && subjectInput && (
                        <div className="mb-3 pb-3 border-b border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</span>
                          <p className="font-bold text-slate-900 mt-1">{subjectInput}</p>
                        </div>
                      )}
                      {bodyInput}
                    </div>
                  ) : (
                    <textarea
                      id="body-input"
                      ref={bodyTextareaRef}
                      value={bodyInput}
                      onChange={(e) => setBodyInput(e.target.value)}
                      disabled={activeDraft.status !== 'DRAFT'}
                      className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-4 focus:bg-white focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 leading-relaxed"
                    />
                  )}
                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-1 px-1">
                    <span>
                      {bodyInput ? bodyInput.split(/\s+/).filter(Boolean).length : 0} words
                    </span>
                    <span>
                      {bodyInput.length} characters
                    </span>
                  </div>
                </div>

                {activeDraft.attachments && (
                  <div className="pt-2">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Attached Files</span>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        try {
                          const parsed = JSON.parse(activeDraft.attachments);
                          return parsed.map((att: any, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 rounded-xl">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {att.name}
                              {!att.base64 && <span className="text-[10px] text-slate-400 font-semibold ml-1">(Base64 cleared to keep DB light)</span>}
                            </span>
                          ));
                        } catch (e) {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                )}

                {activeDraft.status === 'DRAFT' && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveEdits}
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow shadow-indigo-600/10"
                    >
                      {isSaving ? 'Saving...' : 'Save Edits'}
                    </button>
                  </div>
                )}

                {activeDraft.status === 'REJECTED' && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleDuplicate}
                      disabled={isDuplicating}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow shadow-indigo-600/10 flex items-center gap-1.5"
                    >
                      {isDuplicating ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Duplicating...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                          </svg>
                          Duplicate & Edit
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Approvals Gating System */}
              {activeDraft.status === 'DRAFT' && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 mt-6">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900">Decision & Feedback</h4>
                    <p className="text-xs text-slate-500 font-semibold">Record a human review choice. Rejections require feedback for reference.</p>
                  </div>

                  <div>
                    <label htmlFor="feedback-input" className="sr-only">Reviewer feedback</label>
                    <textarea
                      id="feedback-input"
                      rows={2}
                      placeholder="Optional feedback or rejection reason..."
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl p-3 focus:border-indigo-500 focus:outline-none leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => handleApproval('REJECTED')}
                      disabled={isRejecting || isApproving}
                      className="bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 border border-rose-200/50 text-xs font-bold px-4 py-2 rounded-xl transition"
                    >
                      {isRejecting ? 'Rejecting...' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleApproval('APPROVED')}
                      disabled={isRejecting || isApproving}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow shadow-emerald-600/10"
                    >
                      {isApproving ? 'Approving...' : 'Approve'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* History / Drafts Sidebar */}
        <div className="border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-6 space-y-4">
          <h4 className="text-xs font-bold text-slate-900">Draft History ({channelDrafts.length})</h4>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {channelDrafts.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold italic">No previous drafts.</p>
            ) : (
              channelDrafts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleSelectDraft(d)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition duration-150 ${
                    activeDraftId === d.id
                      ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-50'
                      : 'bg-white hover:bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 truncate">
                      {d.subject || `${d.channel} Draft`}
                    </span>
                    <div className="flex items-center gap-1">
                      {d.origin === 'MANUAL' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          Manual
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getStatusBadge(d.status)}`}>
                        {getStatusLabel(d.status)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'N/A'}
                    {d.status === 'REJECTED' && (
                      <span className="text-rose-400 ml-1">(Rejected)</span>
                    )}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Custom Instructions (Optional)"
              className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl p-3 focus:border-indigo-500 focus:outline-none resize-y min-h-[60px]"
            />
            {renderAttachmentUploadUI()}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5"
            >
              {isGenerating ? 'Generating...' : 'Generate AI Draft'}
            </button>
          </div>
        </div>

      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'text-xs font-bold',
          duration: 3000,
        }}
      />
    </div>
  );
}

export default function OutreachAssistant(props: OutreachAssistantProps) {
  return (
    <ErrorBoundary>
      <OutreachAssistantInner {...props} />
    </ErrorBoundary>
  );
}
