'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, ScrollText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PersonalisationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'What I Sell',
      href: '/personalisation/offer',
      description: 'Define what you sell and your core value proposition',
      icon: ScrollText,
    },
    {
      name: 'Ideal Client',
      href: '/personalisation/icp',
      description: 'What makes a client a perfect fit (or disqualified)',
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-label-12 text-muted-foreground tracking-wide uppercase">
        <Link href="/" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span className="text-foreground">My Setup</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-heading-3xl font-bold tracking-tight text-foreground">
          My Setup
        </h1>
        <p className="text-muted-foreground mt-2 text-copy-14 max-w-2xl leading-relaxed">
          Tell the system what you sell and who your ideal customer looks like. This is what drives scoring, research, and outreach.
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-start pt-2">
        <aside className="w-full md:sticky md:top-6 flex flex-row md:flex-col gap-1 bg-muted/20 md:bg-transparent p-1 md:p-0 rounded-xl md:rounded-none">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-md text-left transition-all duration-200 w-full border border-transparent',
                  isActive
                    ? 'bg-muted text-foreground border-border/50 shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 font-medium'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <div className="flex flex-col text-left">
                  <span className="text-label-12 md:text-label-14 truncate leading-none">
                    {item.name}
                  </span>
                  <span
                    className={cn(
                      'hidden md:inline-block text-label-12 mt-1 font-normal leading-normal max-w-[180px] truncate',
                      isActive ? 'text-muted-foreground/90' : 'text-muted-foreground'
                    )}
                  >
                    {item.description}
                  </span>
                </div>
              </Link>
            );
          })}
        </aside>
        
        <main className="min-w-0 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
