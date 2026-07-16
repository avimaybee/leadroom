"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export type Notification = {
  id: string;
  userId: string;
  jobRunId: string | null;
  title: string;
  message: string;
  status: 'SUCCESS' | 'ERROR' | 'INFO';
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  recentJobUpdates: Record<string, 'SUCCESS' | 'ERROR' | 'INFO'>; // mapping jobRunId to status
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const MAX_NOTIFICATIONS = 100;
const MAX_SEEN_IDS = 500;
const MAX_RECENT_JOB_UPDATES = 50;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recentJobUpdates, setRecentJobUpdates] = useState<Record<string, 'SUCCESS' | 'ERROR' | 'INFO'>>({});
  const router = useRouter();
  const seenIds = useRef<Set<string>>(new Set());
  const refreshScheduled = useRef(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const fetchInitial = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json() as Notification[];
        const capped = data.slice(0, MAX_NOTIFICATIONS);
        setNotifications(capped);
        capped.forEach(n => seenIds.current.add(n.id));
        if (seenIds.current.size > MAX_SEEN_IDS) {
          const arr = Array.from(seenIds.current);
          seenIds.current = new Set(arr.slice(arr.length - MAX_SEEN_IDS));
        }
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  }, []);

  const pollNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json() as Notification[];

      const newNotifs = data.filter(n => !seenIds.current.has(n.id));
      if (newNotifs.length > 0) {
        newNotifs.forEach(notif => {
          seenIds.current.add(notif.id);

          if (notif.status === 'SUCCESS') {
            toast.success(notif.title, { description: notif.message, action: notif.link ? { label: 'View', onClick: () => router.push(notif.link!) } : undefined });
          } else if (notif.status === 'ERROR') {
            toast.error(notif.title, { description: notif.message, action: notif.link ? { label: 'View', onClick: () => router.push(notif.link!) } : undefined });
          } else {
            toast.info(notif.title, { description: notif.message, action: notif.link ? { label: 'View', onClick: () => router.push(notif.link!) } : undefined });
          }

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(notif.title, { body: notif.message });
          }

          if (notif.jobRunId) {
            setRecentJobUpdates(prev => {
              if (prev[notif.jobRunId!] === notif.status) return prev;
              const next = { ...prev, [notif.jobRunId!]: notif.status };
              const keys = Object.keys(next);
              if (keys.length > MAX_RECENT_JOB_UPDATES) {
                const trimmed: Record<string, 'SUCCESS' | 'ERROR' | 'INFO'> = {};
                const recentKeys = keys.slice(keys.length - MAX_RECENT_JOB_UPDATES);
                for (const k of recentKeys) trimmed[k] = next[k];
                return trimmed;
              }
              return next;
            });
          }
        });

        setNotifications(prev => {
          const merged = [...newNotifs, ...prev];
          const unique = Array.from(new Map(merged.map(n => [n.id, n])).values());
          const sorted = unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return sorted.slice(0, MAX_NOTIFICATIONS);
        });

        // Throttle router.refresh — at most once every 10 seconds
        if (!refreshScheduled.current) {
          refreshScheduled.current = true;
          setTimeout(() => {
            if (!mountedRef.current) return;
            refreshScheduled.current = false;
            router.refresh();
          }, 10_000);
        }
      }
    } catch (e) {
      console.error('Failed to poll notifications', e);
    }
  }, [router]);

  const pollNotificationsRef = useRef(pollNotifications);
  useEffect(() => { pollNotificationsRef.current = pollNotifications; });

  useEffect(() => {
    fetchInitial();

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // Set up polling intervals
    const notificationInterval = setInterval(() => pollNotificationsRef.current(), 10000);

    return () => {
      clearInterval(notificationInterval);
    };
  }, [fetchInitial]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await fetch('/api/notifications/read-all', { method: 'POST' });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const contextValue = useMemo(() => ({
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    recentJobUpdates,
  }), [notifications, unreadCount, markAsRead, markAllAsRead, recentJobUpdates]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
