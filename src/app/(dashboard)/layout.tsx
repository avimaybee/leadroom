'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, Target, Settings } from 'lucide-react';
import { NotificationProvider } from '@/components/NotificationProvider';
import { NotificationBell } from '@/components/NotificationBell';

const SIDEBAR_WIDTH_KEY = 'leadroom:sidebar:width';
const SIDEBAR_COLLAPSED_KEY = 'leadroom:sidebar:collapsed';
const MIN_SIDEBAR = 200;
const MAX_SIDEBAR = 400;
const DEFAULT_SIDEBAR = 272;

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Campaigns', href: '/scopes', icon: Target },
  { name: 'Pipeline Settings', href: '/settings/pipeline', icon: Settings },
  { name: 'Integrations', href: '/settings/integrations', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const dragRef = useRef(false);

  useEffect(() => {
    const savedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const savedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (savedCollapsed === 'true') setCollapsed(true);
    if (savedWidth && sidebarRef.current) {
      sidebarRef.current.style.width = `${Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, parseInt(savedWidth, 10)))}px`;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !sidebarRef.current) return;
      const newWidth = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, e.clientX));
      sidebarRef.current.style.width = `${newWidth}px`;
    };
    const handleMouseUp = () => {
      if (!dragRef.current) return;
      dragRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (sidebarRef.current) {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarRef.current.offsetWidth));
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const isTabActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
      <aside
        ref={sidebarRef}
        style={{ width: collapsed ? '56px' : `${DEFAULT_SIDEBAR}px`, minWidth: collapsed ? '56px' : `${MIN_SIDEBAR}px` }}
        className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col hidden md:flex shrink-0 transition-[width] duration-200 ease-in-out overflow-hidden relative"
      >
        {/* Branding / Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center border-b border-sidebar-border w-full text-left hover:bg-sidebar-accent transition-colors cursor-pointer ${collapsed ? 'justify-center p-3' : 'p-6 gap-3'}`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black shadow-md shrink-0">
            L
          </div>
          {!collapsed && (
            <div className="truncate flex-1">
              <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground leading-tight">Leadroom</h1>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Internal OS</span>
            </div>
          )}
        </button>

        {/* Nav */}
        <nav className={`mt-8 space-y-1.5 flex-1 ${collapsed ? 'px-2' : 'px-4'}`}>
          {navItems.map((item) => {
            const active = isTabActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-xl font-medium text-sm transition-all duration-200 ${
                  collapsed ? 'justify-center p-3' : 'px-4 py-3 gap-3'
                } ${
                  active
                    ? 'text-sidebar-primary-foreground bg-sidebar-primary shadow-lg font-semibold'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
                title={collapsed ? item.name : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="p-6 border-t border-sidebar-border text-xs font-medium text-muted-foreground">
            Logged in as Agency Admin
          </div>
        )}

      </aside>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="hidden md:block cursor-col-resize relative shrink-0 -ml-px"
      >
        <div className="absolute inset-y-0 -left-1 w-3 group">
          <div className="h-full mx-auto w-0.5 rounded-full bg-transparent group-hover:bg-border group-active:bg-border transition-colors" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b border-border px-8 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-chart-2 animate-pulse" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">System Live</span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <form action="/api/auth/logout" method="POST">
              <Button type="submit" variant="outline" size="xs">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <div className="p-8 md:p-10 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
    </NotificationProvider>
  );
}