"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recentJobUpdates, setRecentJobUpdates] = useState<Record<string, 'SUCCESS' | 'ERROR' | 'INFO'>>({});
  const router = useRouter();
  const seenIds = useRef<Set<string>>(new Set());

  const fetchInitial = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json() as Notification[];
        setNotifications(data);
        data.forEach(n => seenIds.current.add(n.id));
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
            setRecentJobUpdates(prev => ({ ...prev, [notif.jobRunId!]: notif.status }));
          }
        });

        setNotifications(prev => {
          const merged = [...newNotifs, ...prev];
          const unique = Array.from(new Map(merged.map(n => [n.id, n])).values());
          return unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      }
    } catch (e) {
      console.error('Failed to poll notifications', e);
    }
  }, [router]);

  useEffect(() => {
    fetchInitial();
    
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // Trigger initial sweep to ensure reminders/stale leads are updated
    fetch('/api/cron/sweeps').catch(() => {});

    // Set up polling intervals
    const notificationInterval = setInterval(pollNotifications, 10000);
    const sweepsInterval = setInterval(() => {
      fetch('/api/cron/sweeps').catch(() => {});
    }, 30000);

    return () => {
      clearInterval(notificationInterval);
      clearInterval(sweepsInterval);
    };
  }, [fetchInitial, pollNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await fetch('/api/notifications/read-all', { method: 'POST' });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, recentJobUpdates }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
