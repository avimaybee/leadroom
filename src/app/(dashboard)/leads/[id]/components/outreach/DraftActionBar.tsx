'use client';

import { Button } from '@/components/ui/button';
import {
  Loader2,
  Save,
  Check,
  Send,
  Copy,
  ChevronDown,
  History,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { OutreachDraft } from './useOutreachState';

interface DraftActionBarProps {
  activeDraft: OutreachDraft;
  isDirty: boolean;
  isSaving: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  isSending: boolean;
  isDuplicating: boolean;
  canReview: boolean;
  canSend: boolean;
  canDelete: boolean;
  copied: boolean;
  versionCount: number;
  menuOpen: boolean;
  setMenuOpen: (val: boolean) => void;
  onSave: () => void;
  onReview: () => void;
  onMarkSent: () => void;
  onCopy: () => void;
  onOpenVersions: () => void;
  onGenerateVariation: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function DraftActionBar({
  activeDraft,
  isDirty,
  isSaving,
  isApproving,
  isRejecting,
  isSending,
  isDuplicating,
  canReview,
  canSend,
  canDelete,
  copied,
  versionCount,
  menuOpen,
  setMenuOpen,
  onSave,
  onReview,
  onMarkSent,
  onCopy,
  onOpenVersions,
  onGenerateVariation,
  onDuplicate,
  onDelete,
}: DraftActionBarProps) {
  const loading = isSaving || isApproving || isRejecting || isSending || isDuplicating;

  return (
    <div className="flex flex-wrap items-center gap-2 relative">
      {/* Primary Action (Save if dirty, Review if draft, Mark sent if approved) */}
      {isDirty ? (
        <Button
          size="sm"
          onClick={onSave}
          disabled={loading}
          className="shadow-sm"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          Save draft
        </Button>
      ) : canReview ? (
        <Button
          size="sm"
          onClick={onReview}
          disabled={loading}
          className="shadow-sm"
        >
          <Check className="h-3.5 w-3.5 mr-1.5" />
          Review draft
        </Button>
      ) : canSend ? (
        <Button
          size="sm"
          onClick={onMarkSent}
          disabled={loading}
          className="shadow-sm"
        >
          {isSending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <Send className="h-3.5 w-3.5 mr-1.5" />
          )}
          Mark sent
        </Button>
      ) : null}

      {/* Secondary Action (Copy) */}
      <Button
        variant="outline"
        size="sm"
        onClick={onCopy}
        disabled={loading}
        className="shadow-xs border-border/80 hover:bg-muted/50"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 mr-1.5 text-chart-2" />
        ) : (
          <Copy className="h-3.5 w-3.5 mr-1.5" />
        )}
        {copied ? 'Copied' : 'Copy'}
      </Button>

      {/* Tertiary Actions Dropdown */}
      <div className="relative inline-block text-left">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          disabled={loading}
          className="border-border/80 hover:bg-muted/50"
        >
          More
          <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
        </Button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-border bg-popover p-1.5 shadow-lg z-50 text-left animate-fade-in focus:outline-none">
            <button
              onClick={() => {
                onOpenVersions();
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-label-12 text-popover-foreground hover:bg-muted transition-colors"
            >
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              Version history {versionCount > 0 ? `(${versionCount})` : ''}
            </button>
            
            <button
              onClick={() => {
                onGenerateVariation();
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-label-12 text-popover-foreground hover:bg-muted transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              Generate variation
            </button>

            <button
              onClick={() => {
                onDuplicate();
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-label-12 text-popover-foreground hover:bg-muted transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              Duplicate draft
            </button>

            {canDelete && (
              <button
                onClick={() => {
                  onDelete();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-label-12 text-destructive hover:bg-destructive/10 transition-colors border-t border-border/40 mt-1.5 pt-2"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                Delete draft
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
