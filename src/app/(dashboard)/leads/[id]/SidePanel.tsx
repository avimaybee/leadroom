'use client';

import { useState, useRef, useEffect } from 'react';

const STORAGE_KEY = 'leadroom:sidepanel:width';
const COLLAPSED_KEY = 'leadroom:sidepanel:collapsed';
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 380;

export default function SidePanel({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedWidth = localStorage.getItem(STORAGE_KEY);
    const savedCollapsed = localStorage.getItem(COLLAPSED_KEY);
    if (savedCollapsed === 'true') setCollapsed(true);
    if (savedWidth && panelRef.current) {
      const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parseInt(savedWidth, 10)));
      panelRef.current.style.width = `${w}px`;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !panelRef.current) return;
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      panelRef.current.style.width = `${newWidth}px`;
    };
    const handleMouseUp = () => {
      if (!dragRef.current) return;
      dragRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (panelRef.current) {
        localStorage.setItem(STORAGE_KEY, String(panelRef.current.offsetWidth));
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelRef.current?.offsetWidth || DEFAULT_WIDTH;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="shrink-0 self-start mt-1 p-1.5 rounded-lg border border-border/80 bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title="Expand sidepanel"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="relative shrink-0 cursor-col-resize self-stretch"
      >
        <div className="absolute inset-y-0 -left-1.5 w-1.5 group">
          <div className="h-full mx-auto w-0.5 rounded-full bg-border opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Panel */}
      <div
        ref={panelRef}
        style={{ width: `${DEFAULT_WIDTH}px`, minWidth: `${DEFAULT_WIDTH}px` }}
        className="relative shrink-0 space-y-8"
      >
        {/* Collapse button positioned in top-right */}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="absolute -top-1 right-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground z-10"
          title="Collapse sidepanel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {children}
      </div>
    </>
  );
}
