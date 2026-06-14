'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isTabActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const navItems = [
    { name: 'Dashboard', href: '/' },
    { name: 'Leads', href: '/leads' },
    { name: 'Campaigns', href: '/scopes' },
    { name: 'Integrations', href: '/settings/integrations' },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-68 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col hidden md:flex shrink-0">
        <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black shadow-md">
            L
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground leading-tight">Leadroom</h1>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Internal OS</span>
          </div>
        </div>
        
        <nav className="mt-8 px-4 space-y-1.5 flex-1">
          {navItems.map((item) => {
            const active = isTabActive(item.href);
            return (
              <Link 
                key={item.href}
                href={item.href} 
                className={`flex items-center px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  active 
                    ? 'text-sidebar-primary-foreground bg-sidebar-primary shadow-lg font-semibold' 
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-sidebar-border text-xs font-medium text-muted-foreground">
          Logged in as Agency Admin
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b border-border px-8 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-chart-2 animate-pulse" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">System Live</span>
          </div>
          <form action="/api/auth/logout" method="POST">
            <Button type="submit" variant="outline" size="xs">
              Sign out
            </Button>
          </form>
        </header>
        <div className="p-8 md:p-10 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
