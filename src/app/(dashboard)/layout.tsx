'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, Target, Settings, FileText, ClipboardCheck, LayoutList, Lightbulb, ChevronRight, FlaskConical, Sparkles } from 'lucide-react';
import { NotificationProvider } from '@/components/NotificationProvider';
import { NotificationBell } from '@/components/NotificationBell';
import { HowToUse } from '@/components/HowToUse';
import { ApprovalBadge } from '@/components/ApprovalBadge';
import { LearningBadge } from '@/components/LearningBadge';
import { AppLogger } from '@/components/AppLogger';


const SIDEBAR_WIDTH_KEY = 'leadroom:sidebar:width';
const SIDEBAR_COLLAPSED_KEY = 'leadroom:sidebar:collapsed';
const MIN_SIDEBAR = 200;
const MAX_SIDEBAR = 400;
const DEFAULT_SIDEBAR = 272;

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
  badgeType?: 'approvals' | 'learning';
}

const navItems: NavItem[] = [
  { name: 'Command Center', href: '/', icon: LayoutDashboard },
  { name: 'Markets', href: '/markets', icon: Target },
  { name: 'Prospects', href: '/prospects', icon: Users },
  { name: 'Outreach Drafts', href: '/approvals', icon: ClipboardCheck, badge: true, badgeType: 'approvals' },
  { name: 'My Setup', href: '/personalisation', icon: Sparkles },
  { name: 'Settings', href: '/settings/pipeline', icon: Settings },
];

const legacyItems: NavItem[] = [
  { name: 'Leads (legacy)', href: '/leads', icon: Users },
  { name: 'Campaigns (legacy)', href: '/scopes', icon: Target },
];


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const dragRef = useRef(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then((data: any) => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch((err) => console.error('Failed to fetch auth me', err));
  }, []);

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
      <AppLogger />
      <div className="h-screen bg-background flex">
        {/* Skip to Main Content Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-md focus:outline-none"
        >
          Skip to main content
        </a>

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
          className={`flex items-center border-b border-sidebar-border w-full text-left hover:bg-sidebar-accent transition-colors cursor-pointer ${collapsed ? 'justify-center p-3' : 'p-3 gap-2'}`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-white font-bold shadow-sm shrink-0">
            L
          </div>
          {!collapsed && (
            <span className="text-copy-14 font-semibold text-sidebar-foreground truncate">Leadroom</span>
          )}
        </button>

        {/* Nav */}
        <nav className={`mt-1 space-y-0.5 flex-1 ${collapsed ? 'px-2' : 'px-2'}`}>
          {navItems.map((item) => {
            const active = isTabActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-md font-medium text-label-12 transition-all duration-200 ${
                  collapsed ? 'justify-center p-2' : 'px-2 py-1.5 gap-2'
                } ${
                  active
                    ? 'text-sidebar-primary-foreground bg-sidebar-primary shadow-sm font-semibold'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
                title={collapsed ? item.name : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.name}</span>}
                {!collapsed && item.badge && item.badgeType === 'approvals' && <ApprovalBadge />}
                {!collapsed && item.badge && item.badgeType === 'learning' && <LearningBadge />}
              </Link>
            );
          })}

          {/* Legacy section */}
          {!collapsed && (
            <div className="pt-2 mt-2 border-t border-sidebar-border">
              <button
                type="button"
                onClick={() => setLegacyOpen(!legacyOpen)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-label-12 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${legacyOpen ? 'rotate-90' : ''}`} />
                Legacy
              </button>
              {legacyOpen && (
                <div className="ml-4 space-y-0.5 mt-0.5">
                  {legacyItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-label-12 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="px-3 pb-3 pt-1 text-label-12 text-muted-foreground/60 truncate" title={user ? `${user.name} (${user.email})` : undefined}>
            {user ? user.name || user.email : 'Loading user...'}
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
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-w-0 outline-none">
        <header className="bg-card border-b border-border px-8 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-chart-2 animate-pulse" />
            <span className="text-label-12 text-muted-foreground uppercase">System Live</span>
          </div>
          <div className="flex items-center gap-4">
            <HowToUse />
            <NotificationBell />
            <Button type="button" variant="outline" size="xs" onClick={async () => {
              try {
                const { signOut } = await import('firebase/auth');
                const { auth } = await import('@/lib/firebase');
                await signOut(auth);
              } catch (err) { console.error('Failed to sign out', err); }
              await fetch('/api/auth/logout', { method: 'POST' });
              router.push('/login');
            }}>
              Sign out
            </Button>
          </div>
        </header>
        <div className="p-8 md:p-10 flex-1 overflow-y-auto max-w-screen-2xl w-full">
          {children}
        </div>
      </main>
    </div>
    </NotificationProvider>
  );
}