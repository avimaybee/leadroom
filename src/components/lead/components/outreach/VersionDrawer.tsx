'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@base-ui/react/checkbox';
import { History, Copy, Eye, CheckCircle2, ChevronRight, XCircle } from 'lucide-react';
import { formatDateTimeUTC } from '@/lib/date';
import { toast } from 'sonner';

interface VersionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  channelDrafts: any[];
  activeDraftId: string | null;
  onSelectDraft: (draft: any) => void;
  onDuplicate: (draftId: string) => void;
  onTriggerCompare: (id1: string, id2: string) => void;
}

export function VersionDrawer({
  isOpen,
  onClose,
  channelDrafts,
  activeDraftId,
  onSelectDraft,
  onDuplicate,
  onTriggerCompare,
}: VersionDrawerProps) {
  // Store selected IDs for comparison
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectForCompare = (id: string, checked: boolean) => {
    if (checked) {
      if (selectedIds.length >= 2) {
        toast.info('You can compare exactly 2 versions. Uncheck one first.');
        return;
      }
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleCompareClick = () => {
    if (selectedIds.length !== 2) {
      toast.error('Please select exactly 2 versions to compare.');
      return;
    }
    onTriggerCompare(selectedIds[0], selectedIds[1]);
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md w-full max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-2.5">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-label-14 text-foreground uppercase flex items-center gap-1.5">
              <History className="w-4 h-4 text-muted-foreground" />
              <span>Version History</span>
            </DialogTitle>
            <span className="text-label-12 text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">
              {channelDrafts.length} total
            </span>
          </div>
          <DialogDescription className="text-label-12 text-muted-foreground pt-1">
            Browse previous drafts. Select exactly 2 drafts below to compare their changes side-by-side.
          </DialogDescription>
        </DialogHeader>

        {selectedIds.length > 0 && (
          <div className="bg-primary/[0.04] border border-primary/20 p-3 rounded-xl flex items-center justify-between text-label-12 my-2">
            <span className="font-semibold text-foreground">
              {selectedIds.length} of 2 selected for compare
            </span>
            {selectedIds.length === 2 ? (
              <Button size="xs" onClick={handleCompareClick} className="font-semibold">
                Compare Selected
              </Button>
            ) : (
              <span className="text-label-12 text-muted-foreground">Select 1 more</span>
            )}
          </div>
        )}

        <div className="space-y-2 py-4">
          {channelDrafts.length === 0 ? (
            <div className="text-label-12 italic text-muted-foreground text-center py-8">
              No drafts generated yet.
            </div>
          ) : (
            channelDrafts.map((d, idx) => {
              const versionNum = channelDrafts.length - idx;
              const isActive = activeDraftId === d.id;
              const isChecked = selectedIds.includes(d.id);

              const snippet = d.body
                .replace(/^\[Tone:[^\]]+\]\n\n/, '')
                .substring(0, 90)
                .replace(/\n/g, ' ')
                .trim();
              const bodyPreview = snippet.length < d.body.replace(/^\[Tone:[^\]]+\]\n\n/, '').length
                ? snippet + '...'
                : snippet;

              return (
                <div
                  key={d.id}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-label-12 transition-all duration-150 ${
                    isActive
                      ? 'bg-primary/[0.03] border-primary/20 ring-1 ring-primary/10'
                      : 'bg-card border-border/60 hover:bg-muted/30 hover:border-border/80'
                  }`}
                >
                  {/* Compare Selection Checkbox */}
                  <div className="pt-1.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleSelectForCompare(d.id, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/20 shrink-0 cursor-pointer"
                      title="Select for comparison"
                    />
                  </div>

                  {/* Version Item Body */}
                  <div className="flex-1 min-w-0 space-y-1.5 cursor-pointer" onClick={() => onSelectDraft(d)}>
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="flex items-center justify-center w-5 h-5 rounded bg-muted text-label-12 text-muted-foreground shrink-0">
                          v{versionNum}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-label-12 uppercase shrink-0 ${
                          d.status === 'APPROVED' ? 'bg-chart-2/10 text-chart-2 border border-chart-2/20' :
                          d.status === 'REJECTED' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                          d.status === 'SENT' ? 'bg-primary/10 text-primary border border-primary/20' :
                          'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {getStatusLabel(d.status)}
                        </span>
                        {d.origin === 'MANUAL' && (
                          <span className="text-label-12 text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded shrink-0">
                            Edited
                          </span>
                        )}
                      </div>

                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onDuplicate(d.id)}
                          className="h-6 w-6 p-0 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                          title="Duplicate draft"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-label-12 text-muted-foreground leading-relaxed line-clamp-2">
                      {d.subject && <span className="font-semibold text-foreground block shrink-0 truncate">{d.subject}</span>}
                      {bodyPreview || '(empty)'}
                    </p>
                    <p className="text-label-12 text-muted-foreground/60 flex items-center justify-between">
                      <span>{d.createdAt ? formatDateTimeUTC(d.createdAt) : ''}</span>
                      {isActive && <span className="text-primary font-semibold">Active in workspace</span>}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="flex flex-row justify-end w-full pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
