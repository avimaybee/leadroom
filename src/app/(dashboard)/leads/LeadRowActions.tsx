'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { MoreVertical, ExternalLink, Mail, Clock, Trash2, Eye } from 'lucide-react';
import { archiveLeadAction } from '@/app/actions/leads';

export default function LeadRowActions({ leadId }: { leadId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleArchive = () => {
    if (confirm('Are you sure you want to archive this lead?')) {
      startTransition(async () => {
        try {
          await archiveLeadAction(leadId);
        } catch (e) {
          console.error(e);
          alert('Failed to archive lead');
        }
      });
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
        aria-label="Lead actions"
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-4 h-4" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-card border border-border/80 shadow-lg z-50 py-1 text-left focus:outline-none animate-fade-in">
          <Link
            href={`/leads/${leadId}`}
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2 text-label-12 text-foreground hover:bg-muted/80 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Open Lead</span>
          </Link>
          <Link
            href={`/leads/${leadId}?view=outreach`}
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2 text-label-12 text-foreground hover:bg-muted/80 transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Open Outreach</span>
          </Link>
          <Link
            href={`/leads/${leadId}?view=activity`}
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2 text-label-12 text-foreground hover:bg-muted/80 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Open Activity</span>
          </Link>
          <hr className="border-border/50 my-1" />
          <button
            onClick={handleArchive}
            disabled={isPending}
            className="flex items-center gap-2 px-3.5 py-2 text-label-12 text-destructive hover:bg-destructive/5 transition-colors w-full text-left"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isPending ? 'Archiving...' : 'Archive Lead'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
