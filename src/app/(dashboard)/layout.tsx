'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    { name: 'Discovery', href: '/discovery' },
    { name: 'Scopes', href: '/scopes' },
    { name: 'Integrations', href: '/settings/integrations' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-68 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20">
            D
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">Draftroom</h1>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Internal OS</span>
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
                    ? 'text-white bg-indigo-600 shadow-lg shadow-indigo-600/15 font-semibold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-6 border-t border-slate-800 text-xs font-medium text-slate-500">
          Logged in as Agency Admin
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200/80 px-8 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Live</span>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button 
              type="submit" 
              className="text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition"
            >
              Sign out
            </button>
          </form>
        </header>
        <div className="p-8 md:p-10 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
