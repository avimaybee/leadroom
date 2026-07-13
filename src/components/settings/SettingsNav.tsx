'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SlidersHorizontal, Cpu, Target, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsNav() {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Pipeline Preferences',
      href: '/settings/pipeline',
      description: 'Manage staleness thresholds and stage timings',
      icon: SlidersHorizontal,
    },
    {
      name: 'AI Integrations',
      href: '/settings/integrations',
      description: 'Configure provider credentials and AI routing',
      icon: Cpu,
    },
    {
      name: 'Market Settings',
      href: '/settings/market',
      description: 'Link offers and ICPs to target segments',
      icon: Target,
    },
    {
      name: 'Insights Suggestions',
      href: '/settings/insights',
      description: 'Review system learning recommendations',
      icon: Lightbulb,
    },
  ];

  return (
    <nav className="flex flex-row md:flex-col gap-1 w-full bg-muted/20 md:bg-transparent p-1 md:p-0 rounded-xl md:rounded-none">
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
    </nav>
  );
}
