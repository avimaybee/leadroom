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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Loader2,
  Upload,
  AlertTriangle,
  X,
  FileText,
  Sparkles,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  ChevronDown,
  PenLine,
  Plus,
  History,
} from 'lucide-react';

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
  
  const channelDrafts = drafts.filter(d => d.channel === selectedChannel);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(
    channelDrafts.length > 0 ? channelDrafts[0].id : null
  );

  const activeDraft = drafts.find(d => d.id === activeDraftId) || channelDrafts[0] || null;

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
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Attachments (Images/PDFs)</span>
        {modelInfo && (
          <span className="text-xs text-muted-foreground font-semibold">
            Active: {modelInfo.modelName} ({modelInfo.hasVision ? 'Multimodal' : 'Text-Only'})
          </span>
        )}
      </div>
      
      <Label className="flex items-center justify-center border border-dashed border-border rounded-xl p-3 bg-muted/30 hover:bg-muted/50 cursor-pointer transition text-xs font-bold text-muted-foreground">
        <input
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          {isUploadingAttachments ? (
            <>
              <Loader2 className="animate-spin h-3.5 w-3.5 text-primary" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span>Choose Files</span>
            </>
          )}
        </div>
      </Label>

      {modelInfo && !modelInfo.hasVision && attachments.length > 0 && (
        <div className="bg-chart-5/10 border border-chart-5/20 text-chart-5 p-2.5 rounded-xl text-xs font-bold flex items-start gap-1.5 leading-normal">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div>
            The active model lacks vision capabilities. Attached files will be uploaded, but text/image content will not be processed by the model.
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {attachments.map((att, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 text-xs font-bold text-primary rounded-lg">
              <span className="truncate max-w-[120px]">{att.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => removeAttachment(idx)}
                className="text-primary/60 hover:text-primary ml-1"
              >
                &times;
              </Button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const saveEditsRef = useRef<() => void>(() => {});
  const activeDraftStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';
  }, [bodyInput]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeDraftStatusRef.current === 'DRAFT' || activeDraftStatusRef.current === 'APPROVED') {
          saveEditsRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (activeDraft) {
      setSubjectInput(activeDraft.subject || '');
      setBodyInput(activeDraft.body || '');
      setFeedbackInput('');
    }
  }, [activeDraft?.id]);

  const handleChannelChange = (channel: string) => {
    const ch = channel as 'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING';
    setSelectedChannel(ch);
    const filtered = drafts.filter(d => d.channel === ch);
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
        setAttachments([]);
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
      setDrafts(drafts.map(d => d.id === activeDraft.id ? { ...d, subject: subjectInput, body: bodyInput, updatedAt: new Date() } : d));
      toast.success('Draft saved successfully');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  saveEditsRef.current = handleSaveEdits;
  activeDraftStatusRef.current = activeDraft?.status;

  const executeApproval = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!activeDraft) return;
    if (decision === 'APPROVED') setIsApproving(true);
    else setIsRejecting(true);
    setErrorMsg(null);

    try {
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'default' as const;
      case 'REJECTED': return 'destructive' as const;
      case 'SENT': return 'secondary' as const;
      default: return 'outline' as const;
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
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-bold text-card-foreground">Outreach Assistant</h3>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5">Prepare, edit, and approve personalized outreach messages.</p>
        </div>

        <Tabs value={selectedChannel} onValueChange={handleChannelChange}>
          <TabsList>
            <TabsTrigger value="EMAIL">Email</TabsTrigger>
            <TabsTrigger value="LINKEDIN">LinkedIn</TabsTrigger>
            <TabsTrigger value="CALL">Call Prep</TabsTrigger>
            <TabsTrigger value="MEETING">Meeting Prep</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {channelDrafts.length >= 2 && (
        <Button
          variant={compareMode ? 'default' : 'outline'}
          size="xs"
          onClick={() => {
            setCompareMode(!compareMode);
            if (!compareMode) {
              setShowPreview(false);
            }
          }}
        >
          <History className="w-3 h-3" />
          {compareMode ? 'Exit Compare' : `Compare Drafts (${channelDrafts.length})`}
        </Button>
      )}

      {(researchSnapshot || auditSnapshot) && (
        <div className="bg-muted/30 border border-border rounded-xl overflow-hidden transition-all duration-300">
          <Button
            onClick={() => setShowContext(!showContext)}
            variant="ghost"
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-muted-foreground"
          >
            <span>View Lead Context (Audit & Research)</span>
            <ChevronDown className={`w-4 h-4 transform transition-transform ${showContext ? 'rotate-180' : ''}`} />
          </Button>
          
          {showContext && (
            <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {auditSnapshot && (
                <div className="space-y-2">
                  <h4 className="font-bold text-foreground border-b border-border pb-1">Audit Highlights</h4>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground font-semibold max-h-[150px] overflow-y-auto">
                    {auditSnapshot.keyWeaknesses && <li><span className="font-bold text-foreground">Weaknesses:</span> {auditSnapshot.keyWeaknesses}</li>}
                    {auditSnapshot.recommendedImprovements && <li><span className="font-bold text-foreground">Recommendations:</span> {auditSnapshot.recommendedImprovements}</li>}
                  </ul>
                </div>
              )}
              {researchSnapshot && (
                <div className="space-y-2">
                  <h4 className="font-bold text-foreground border-b border-border pb-1">Research Highlights</h4>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground font-semibold max-h-[150px] overflow-y-auto">
                    {researchSnapshot.companySummary && <li><span className="font-bold text-foreground">Summary:</span> {researchSnapshot.companySummary}</li>}
                    {researchSnapshot.painPointsHypotheses && <li><span className="font-bold text-foreground">Pain Points:</span> {researchSnapshot.painPointsHypotheses}</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{confirmDialog?.message}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button onClick={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}>
              {confirmDialog?.confirmLabel || 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <div className="lg:col-span-3 space-y-4">
          {compareMode && channelDrafts.length >= 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-muted-foreground">Compare Drafts</h4>
                <Button variant="ghost" size="xs" onClick={() => setCompareMode(false)}>
                  Close
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {channelDrafts.slice(0, 2).map((draft, idx) => (
                  <Card key={draft.id} size="sm" className={compareDraftId === draft.id ? 'ring-2 ring-primary' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={getStatusVariant(draft.status)} className="text-xs uppercase">
                          {getStatusLabel(draft.status)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setActiveDraftId(draft.id);
                            setSubjectInput(draft.subject || '');
                            setBodyInput(draft.body || '');
                            setCompareMode(false);
                          }}
                        >
                          <PenLine className="w-3 h-3" />
                          Edit
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {draft.subject && (
                        <p className="text-xs font-bold text-card-foreground mb-2">{draft.subject}</p>
                      )}
                      <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                        {draft.body}
                      </div>
                      <p className="text-xs text-muted-foreground font-semibold mt-2">
                        {draft.createdAt ? new Date(draft.createdAt).toLocaleString() : 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {channelDrafts.length > 2 && (
                <div className="bg-chart-5/10 border border-chart-5/20 text-chart-5 p-3 rounded-xl text-xs font-bold">
                  Showing the 2 most recent drafts. {channelDrafts.length - 2} more draft(s) available in the sidebar.
                </div>
              )}
            </div>
          )}

          {!activeDraft ? (
            <div className="bg-muted/30 rounded-2xl p-8 border border-border/60 border-dashed text-center flex flex-col items-center justify-center space-y-4">
              <span className="p-3 bg-muted text-muted-foreground rounded-full">
                <PenLine className="w-6 h-6" />
              </span>
              <div className="max-w-sm space-y-1">
                <p className="text-sm font-bold text-foreground">No {selectedChannel.toLowerCase()} draft generated yet</p>
                <p className="text-xs text-muted-foreground font-semibold">Generate a tailored message template referencing the website audit scores and opportunities.</p>
              </div>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Custom Instructions (Optional)"
                className="w-full max-w-sm min-h-[60px]"
              />
              <div className="w-full max-w-sm">
                {renderAttachmentUploadUI()}
              </div>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate AI Draft
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(activeDraft.status)} className="text-xs uppercase">
                    {getStatusLabel(activeDraft.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Last updated: {activeDraft.updatedAt ? new Date(activeDraft.updatedAt).toLocaleString() : 'N/A'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={copyToClipboard}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>

                  <Button
                    variant={showPreview ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setShowPreview(!showPreview)}
                    aria-label={showPreview ? 'Show editor' : 'Show preview'}
                  >
                    {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPreview ? 'Edit' : 'Preview'}
                  </Button>

                  {activeDraft.status === 'DRAFT' && (
                    <Button
                      variant="outline"
                      size="xs"
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
                      aria-label="Delete draft"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </Button>
                  )}

                  {activeDraft.status === 'APPROVED' && (
                    <Button onClick={handleMarkAsSent} disabled={isSending} size="xs">
                      {isSending ? (
                        <><Loader2 className="animate-spin h-3.5 w-3.5" />Marking...</>
                      ) : (
                        <><Send className="w-3.5 h-3.5" />Mark as Sent</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {selectedChannel === 'EMAIL' && (
                  <div>
                    <Label htmlFor="subject-input" className="text-xs uppercase tracking-wider">Subject</Label>
                    <Input
                      id="subject-input"
                      type="text"
                      value={subjectInput}
                      onChange={(e) => setSubjectInput(e.target.value)}
                      disabled={activeDraft.status !== 'DRAFT' && activeDraft.status !== 'APPROVED'}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="body-input" className="text-xs uppercase tracking-wider">Message Body</Label>
                  {showPreview && activeDraft ? (
                    <Card className="min-h-[200px]" size="sm">
                      <CardContent className="text-xs text-card-foreground leading-relaxed whitespace-pre-wrap">
                        {selectedChannel === 'EMAIL' && subjectInput && (
                          <div className="mb-3 pb-3 border-b border-border">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</span>
                            <p className="font-bold text-foreground mt-1">{subjectInput}</p>
                          </div>
                        )}
                        {bodyInput}
                      </CardContent>
                    </Card>
                  ) : (
                    <Textarea
                      id="body-input"
                      ref={bodyTextareaRef}
                      value={bodyInput}
                      onChange={(e) => setBodyInput(e.target.value)}
                      disabled={activeDraft.status !== 'DRAFT' && activeDraft.status !== 'APPROVED'}
                    />
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground font-semibold mt-1 px-1">
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
                    <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Attached Files</span>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        try {
                          const parsed = JSON.parse(activeDraft.attachments);
                          return parsed.map((att: any, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-muted border border-border text-xs font-bold text-muted-foreground rounded-xl">
                              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                              {att.name}
                              {!att.base64 && <span className="text-xs text-muted-foreground font-semibold ml-1">(Base64 cleared to keep DB light)</span>}
                            </span>
                          ));
                        } catch (e) {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                )}

                {(activeDraft.status === 'DRAFT' || activeDraft.status === 'APPROVED') && (
                  <div className="flex justify-end">
                    <Button onClick={handleSaveEdits} disabled={isSaving}>
                      {isSaving ? (
                        <><Loader2 className="animate-spin" />Saving...</>
                      ) : 'Save Edits'}
                    </Button>
                  </div>
                )}

                {activeDraft.status === 'REJECTED' && (
                  <div className="flex justify-end">
                    <Button onClick={handleDuplicate} disabled={isDuplicating}>
                      {isDuplicating ? (
                        <><Loader2 className="animate-spin" />Duplicating...</>
                      ) : (
                        <><Plus className="w-3.5 h-3.5" />Duplicate & Edit</>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {activeDraft.status === 'DRAFT' && (
                <div className="bg-muted/30 p-5 rounded-2xl border border-border space-y-4 mt-6">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground">Decision & Feedback</h4>
                    <p className="text-xs text-muted-foreground font-semibold">Record a human review choice. Rejections require feedback for reference.</p>
                  </div>

                  <div>
                    <Label htmlFor="feedback-input" className="sr-only">Reviewer feedback</Label>
                    <Textarea
                      id="feedback-input"
                      rows={2}
                      placeholder="Optional feedback or rejection reason..."
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleApproval('REJECTED')}
                      disabled={isRejecting || isApproving}
                      className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/30"
                    >
                      {isRejecting ? (
                        <><Loader2 className="animate-spin" />Rejecting...</>
                      ) : (
                        <><XCircle className="w-3.5 h-3.5" />Reject</>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleApproval('APPROVED')}
                      disabled={isRejecting || isApproving}
                      className="bg-chart-2/80 text-primary-foreground hover:bg-chart-2"
                    >
                      {isApproving ? (
                        <><Loader2 className="animate-spin" />Approving...</>
                      ) : (
                        <><CheckCircle2 className="w-3.5 h-3.5" />Approve</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Generate New Variation Form */}
              <div className="bg-muted/20 p-5 rounded-2xl border border-border/60 space-y-4 mt-6">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">Generate New Draft</h4>
                  <p className="text-xs text-muted-foreground font-semibold">Generate an additional draft with different instructions. Existing drafts are kept in history.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Custom Instructions (e.g. make it shorter, mention local pricing...)"
                    className="min-h-[60px]"
                  />
                  {renderAttachmentUploadUI()}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      size="sm"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="animate-spin h-3.5 w-3.5 mr-2" />
                          Generating Variation...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 mr-2" />
                          Generate New Draft
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t lg:border-t-0 lg:border-l border-border pt-6 lg:pt-0 lg:pl-6 space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground">Versions</h4>
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">{channelDrafts.length}</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 -mr-1">
            {channelDrafts.length === 0 ? (
              <div className="text-xs text-muted-foreground font-semibold italic text-center py-8">
                No drafts generated yet.
              </div>
            ) : (
              channelDrafts.map((d, idx) => {
                const versionNum = channelDrafts.length - idx;
                const isActive = activeDraftId === d.id;
                const snippet = d.body
                  .replace(/^\[Tone:[^\]]+\]\n\n/, '')
                  .substring(0, 120)
                  .replace(/\n/g, ' ')
                  .trim();
                const bodyPreview = snippet.length < d.body.replace(/^\[Tone:[^\]]+\]\n\n/, '').length
                  ? snippet + '...'
                  : snippet;

                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleSelectDraft(d)}
                    className={`w-full text-left rounded-xl border text-xs transition-all duration-150 ${
                      isActive
                        ? 'bg-primary/[0.04] border-primary/25 ring-1 ring-primary/20 shadow-sm'
                        : 'bg-card hover:bg-muted/50 border-border/70 hover:border-border'
                    }`}
                  >
                    {/* Header row: version + status + actions */}
                    <div className="flex items-center justify-between gap-1.5 px-3 pt-2.5 pb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                          v{versionNum}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase leading-tight ${
                          d.status === 'APPROVED' ? 'bg-chart-2/10 text-chart-2 border border-chart-2/20' :
                          d.status === 'REJECTED' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                          d.status === 'SENT' ? 'bg-primary/10 text-primary border border-primary/20' :
                          'bg-muted text-muted-foreground border border-border'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${
                            d.status === 'APPROVED' ? 'bg-chart-2' :
                            d.status === 'REJECTED' ? 'bg-destructive' :
                            d.status === 'SENT' ? 'bg-primary' :
                            'bg-muted-foreground'
                          }`} />
                          {getStatusLabel(d.status)}
                        </span>
                        {d.origin === 'MANUAL' && (
                          <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">Edited</span>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => { handleSelectDraft(d); }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="View draft"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await duplicateDraftAction(d.id);
                            if (res.error) { toast.error(res.error); return; }
                            if (res.draft) {
                              const parsed = { ...res.draft, createdAt: res.draft.createdAt ? new Date(res.draft.createdAt) : null, updatedAt: res.draft.updatedAt ? new Date(res.draft.updatedAt) : null };
                              setDrafts([parsed, ...drafts]);
                              setActiveDraftId(parsed.id);
                              setSubjectInput(parsed.subject || '');
                              setBodyInput(parsed.body || '');
                              router.refresh();
                            }
                          }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Duplicate draft"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Preview snippet */}
                    <div className="px-3 pb-2.5">
                      <p className="text-[11px] text-muted-foreground font-medium leading-relaxed line-clamp-2">
                        {d.subject && (
                          <span className="font-bold text-foreground">{d.subject}</span>
                        )}
                        {d.subject && <br />}
                        {bodyPreview || '(empty)'}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 font-semibold mt-1">
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        {d.updatedAt && d.updatedAt.getTime() !== d.createdAt?.getTime() ? ' · edited' : ''}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
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
