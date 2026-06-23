"use client";

import { useNotifications } from '@/components/NotificationProvider';
import { Bell, Check, CheckCircle2, AlertCircle, Info, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref]);

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(!open)}>
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/50 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-popover text-popover-foreground border shadow-lg rounded-md z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <h4 className="text-label-14">Notifications</h4>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="flex items-center text-label-12 hover:text-primary transition-colors text-muted-foreground">
                <Check className="w-3 h-3 mr-1" />
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-copy-14 text-muted-foreground">No recent notifications</p>
                <Link href="/leads" className="inline-flex items-center gap-1.5 text-label-12 text-primary hover:underline">
                  <ArrowRight className="h-3 w-3" /> View Active Leads
                </Link>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.isRead) markAsRead(n.id);
                      if (n.link) {
                        router.push(n.link);
                        setOpen(false);
                      }
                    }}
                    className={`p-4 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${!n.isRead ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {n.status === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-chart-2" />}
                        {n.status === 'ERROR' && <AlertCircle className="w-4 h-4 text-destructive" />}
                        {n.status === 'INFO' && <Info className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-copy-14 font-medium leading-tight truncate">{n.title}</p>
                        <p className="text-label-12 text-muted-foreground line-clamp-2">{n.message}</p>
                        <p className="text-mono-12 text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                      {!n.isRead && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
