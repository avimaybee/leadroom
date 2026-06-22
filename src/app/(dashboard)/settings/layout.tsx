import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground tracking-wide uppercase">
        <Link href="/" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span className="text-foreground">Settings</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          System Settings
        </h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-2xl font-medium">
          Manage pipeline timing rules, active routing rules, and credentials for AI providers.
        </p>
      </div>

      {/* Settings Panel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-start pt-2">
        <aside className="w-full md:sticky md:top-6">
          <SettingsNav />
        </aside>
        
        <main className="min-w-0 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
