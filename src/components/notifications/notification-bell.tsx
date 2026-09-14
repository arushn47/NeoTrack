'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  Building2,
  Calendar,
  Sparkles,
  Award,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/use-push-notifications';

export interface InAppNotification {
  id: string;
  type: string;
  title: string;
  message?: string;
  body?: string;
  link?: string;
  company_id?: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    isSupported: isPushSupported,
    permission: pushPermission,
    isSubscribed: isPushSubscribed,
    subscribeToPush,
    loading: pushLoading,
  } = usePushNotifications();

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, []);

  // Poll notifications periodically (every 30 seconds) & on mount
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Mark all as read with keepalive and optimistic state
  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications', { method: 'POST', keepalive: true });
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Mark single notification as read without navigating
  const handleMarkSingleRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', keepalive: true });
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  // Mark individual notification as read and navigate
  const handleNotificationClick = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        fetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH', keepalive: true }).catch(console.error);
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    }

    setIsOpen(false);

    if (notif.link) {
      router.push(notif.link);
    } else if (notif.company_id) {
      router.push(`/companies/${notif.company_id}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'shortlist_match':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'test_scheduled':
        return <FileText className="w-4 h-4 text-amber-400" />;
      case 'interview_scheduled':
        return <Award className="w-4 h-4 text-purple-400" />;
      case 'ppt_scheduled':
        return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'status_change':
        return <CheckCircle2 className="w-4 h-4 text-cyan-400" />;
      case 'new_company':
        return <Building2 className="w-4 h-4 text-indigo-400" />;
      default:
        return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-all cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-accent/40 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-84 sm:w-96 bg-[#111113] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/20 text-accent border border-accent/30">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Live Push Notifications Enablement Banner */}
          {isPushSupported && !isPushSubscribed && pushPermission !== 'denied' && (
            <div className="mx-3 my-2.5 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] flex items-center justify-between gap-2.5">
              <div className="flex items-start gap-2 min-w-0">
                <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-100 leading-tight">Live Shortlist Alerts</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">Get instant push alerts on desktop when CDC releases test lists.</p>
                </div>
              </div>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await subscribeToPush();
                }}
                disabled={pushLoading}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
              >
                {pushLoading ? '...' : 'Enable'}
              </button>
            </div>
          )}

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto text-zinc-500">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-zinc-300">No notifications yet</p>
                <p className="text-xs text-zinc-500 max-w-[200px] mx-auto">
                  Meaningful updates, shortlists, and test schedules will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    'flex items-start gap-3 p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer text-left group',
                    !notif.is_read && 'bg-accent/[0.03]'
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          'text-xs font-semibold truncate',
                          notif.is_read ? 'text-zinc-300' : 'text-white'
                        )}
                      >
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleMarkSingleRead(notif.id, e)}
                            title="Mark as read"
                            className="p-1 rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 opacity-70 group-hover:opacity-100 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {notif.body || notif.message}
                    </p>

                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 pt-0.5">
                      <Clock className="w-3 h-3" />
                      <span suppressHydrationWarning>{timeAgo(notif.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
