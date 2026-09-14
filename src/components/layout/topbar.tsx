'use client';

import { Bell, RefreshCw, LogOut, CheckCircle, AlertCircle, X, Sparkles, User, Settings, PieChart, Calendar, Search, Building2, Zap, CheckCheck, Radar, Shield, FileText, MessageSquare } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';
import NotificationBell from '@/components/notifications/notification-bell';
import { AppLogo, AppLogoMark } from '@/components/brand/logo';

interface TopbarProps {
  userName: string | null;
  userAvatar: string | null;
  lastSyncAt: string | null;
}

interface SyncProgress {
  phase: 'initializing' | 'fetching' | 'processing' | 'complete' | 'error';
  accountEmail: string;
  accountType: string;
  totalMessages: number;
  processedMessages: number;
  alreadyIndexed?: number;
  remainingMessages?: number;
  isResuming?: boolean;
  newEmails: number;
  newCompanies: number;
  skippedDuplicates: number;
  errors: string[];
  currentSubject?: string;
  isInitialSync?: boolean;
  currentPageIndex?: number;
  totalPagesCount?: number;
  isPage0Complete?: boolean;
}

export default function Topbar({ userName, userAvatar, lastSyncAt }: TopbarProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const isSseActiveRef = useRef(false);
  const chainedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasMountedAutoSyncRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncResult, setSyncResult] = useState<{
    show: boolean;
    success: boolean;
    message: string;
    newEmails: number;
    newCompanies: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((immediate: boolean = false) => {
    if (pollIntervalRef.current) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/sync/status');
        if (!res.ok) return;
        const data = await res.json();

        if (data.isSyncing) {
          setIsSyncing(true);
          isSyncingRef.current = true;
          if (data.progress) {
            setSyncProgress(data.progress);
          }
        } else {
          // Sync has finished or is idle
          stopPolling();
          isSyncingRef.current = false;
          setIsSyncing(false);

          if (data.progress && data.phase === 'complete') {
            setSyncProgress({
              ...data.progress,
              phase: 'complete',
            });
            setTimeout(() => {
              setSyncProgress(null);
              setSyncResult({
                show: true,
                success: true,
                message: 'Placement sync complete',
                newEmails: data.progress.newEmails || 0,
                newCompanies: data.progress.newCompanies || 0,
              });
              router.refresh();
              setTimeout(() => setSyncResult(null), 5000);
            }, 1200);
          } else {
            setSyncProgress(null);
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    if (immediate) {
      poll();
    }
    pollIntervalRef.current = setInterval(poll, 2500);
  }, [router, stopPolling]);

  // Clean up polling interval and chained timeouts on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (chainedTimeoutRef.current) {
        clearTimeout(chainedTimeoutRef.current);
        chainedTimeoutRef.current = null;
      }
    };
  }, [stopPolling]);

  // Close profile dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showUserMenu]);

  // Keyboard shortcut Cmd+K / Ctrl+K to jump to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        router.push('/search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const handleSync = useCallback(async (silent: boolean = false, isChained: boolean = false) => {
    if (isSyncingRef.current && !isChained) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncResult(null);

    let willAdvanceNextChunk = false;

    if (!silent) {
      setSyncProgress({
        phase: 'initializing',
        accountEmail: '',
        accountType: '',
        totalMessages: 0,
        processedMessages: 0,
        newEmails: 0,
        newCompanies: 0,
        skippedDuplicates: 0,
        errors: [],
      });
    }

    try {
      const response = await fetch('/api/sync', { method: 'POST' });

      if (!response.ok) {
        throw new Error('Sync request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      isSseActiveRef.current = true;
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split by standard SSE double-newline message delimiter
          const messages = buffer.split('\n\n');
          // Keep any incomplete trailing block in buffer
          buffer = messages.pop() || '';

          for (const message of messages) {
            const lines = message.split('\n');
            let currentEvent = '';
            let currentData = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                currentData = line.slice(6).trim();
              }
            }

            if (currentEvent && currentData) {
              try {
                const parsed = JSON.parse(currentData);

                if (currentEvent === 'sync_active' || currentEvent === 'active') {
                  // A background sync (e.g. from cron) is already actively running
                  willAdvanceNextChunk = true;
                  startPolling(true);
                  return;
                }

                if (currentEvent === 'progress' || currentEvent === 'sync_progress') {
                  setSyncProgress((prev) => {
                    if (silent && parsed.phase !== 'processing' && !prev) {
                      return null;
                    }
                    return parsed;
                  });
                } else if (currentEvent === 'complete' || currentEvent === 'sync_complete') {
                  stopPolling();
                  if (parsed.result?.hasMorePagesPending) {
                    // Keep progress banner smoothly visible with next batch indicator
                    willAdvanceNextChunk = true;
                    setSyncProgress((prev) => prev ? {
                      ...prev,
                      currentSubject: 'Chunk checkpointed. Advancing to next batch...',
                    } : null);
                    if (chainedTimeoutRef.current) clearTimeout(chainedTimeoutRef.current);
                    chainedTimeoutRef.current = setTimeout(() => {
                      chainedTimeoutRef.current = null;
                      handleSync(false, true); // Seamlessly trigger next chunk with isChained bypass
                    }, 800);
                    return;
                  }

                  // Smooth transition: show 100% completion in banner briefly before toast
                  setSyncProgress((prev) => (prev ? { ...prev, phase: 'complete' } : null));

                  setTimeout(() => {
                    setSyncProgress(null);
                    setSyncResult({
                      show: true,
                      success: true,
                      message: syncProgress?.isInitialSync
                        ? 'Sync complete! All placement drives are up to date.'
                        : 'Placement sync complete',
                      newEmails: parsed.newEmails ?? parsed.result?.newEmails ?? 0,
                      newCompanies: parsed.newCompanies ?? parsed.result?.newCompanies ?? 0,
                    });
                    router.refresh();
                    setTimeout(() => setSyncResult(null), 5000);
                  }, 1000);
                } else if (currentEvent === 'error' || currentEvent === 'sync_error') {
                  stopPolling();
                  setSyncProgress(null);
                  setSyncResult({
                    show: true,
                    success: false,
                    message: parsed.message || 'Sync encountered an issue',
                    newEmails: 0,
                    newCompanies: 0,
                  });
                  setTimeout(() => setSyncResult(null), 8000);
                }
              } catch {
                // Ignore malformed JSON
              }
            }
          }
        }
      } finally {
        isSseActiveRef.current = false;
      }

      // If stream ended without complete event, verify with /api/sync/status
      if (isSyncingRef.current) {
        try {
          const res = await fetch('/api/sync/status');
          if (res.ok) {
            const data = await res.json();
            if (data.phase === 'pending' || (data.progress && data.progress.totalPagesCount > 1)) {
              console.log('[Topbar Sync] Stream closed with pending pages. Auto-advancing...');
              willAdvanceNextChunk = true;
              if (chainedTimeoutRef.current) clearTimeout(chainedTimeoutRef.current);
              chainedTimeoutRef.current = setTimeout(() => {
                chainedTimeoutRef.current = null;
                handleSync(false, true);
              }, 1200);
              return;
            }
          }
        } catch {}
      }
    } catch (err) {
      stopPolling();
      setSyncProgress(null);
      setSyncResult({
        show: true,
        success: false,
        message: err instanceof Error ? err.message : 'Sync failed',
        newEmails: 0,
        newCompanies: 0,
      });
      setTimeout(() => setSyncResult(null), 8000);
    } finally {
      if (!willAdvanceNextChunk) {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    }
  }, [router, startPolling, stopPolling]);

  const handleLogout = async () => {
    await fetch('/api/auth/disconnect', { method: 'DELETE' });
    window.location.href = '/login';
  };

  // On mount: check if a sync is currently active (e.g. after page reload or triggered by background cron)
  useEffect(() => {
    if (hasMountedAutoSyncRef.current) return;
    hasMountedAutoSyncRef.current = true;

    fetch('/api/sync/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.isSyncing) {
          setIsSyncing(true);
          isSyncingRef.current = true;
          if (data.progress) {
            setSyncProgress(data.progress);
          }
          startPolling();
        } else if (data.phase === 'pending' || !lastSyncAt || Date.now() - new Date(lastSyncAt).getTime() > 60 * 60 * 1000) {
          // Only trigger silent sync on mount if it hasn't synced in over 1 hour
          // or if there are pending pages left to process
          handleSync(true);
        }
      })
      .catch(() => {});
  }, [lastSyncAt, handleSync, startPolling]);

  // Page Visibility guard: handle browser tab backgrounding and foregrounding
  // Avoids fighting active SSE streams, survives tab throttling, and resumes seamlessly when returning
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        // Tab backgrounded:
        // If an SSE stream is actively connected, it is already receiving server events pushed in real time.
        // DO NOT start polling — running polling concurrently with an active SSE stream creates two competing loops.
        // Only start polling if marked syncing BUT without an active SSE stream (e.g. background cron was running).
        if (isSyncingRef.current && !isSseActiveRef.current) {
          startPolling();
        }
      } else if (document.visibilityState === 'visible') {
        // Tab foregrounded:
        // If an SSE stream is currently connected and actively pumping events, let it do its job.
        if (isSseActiveRef.current) return;

        // Otherwise, query server directly to get immediate ground truth
        try {
          const res = await fetch('/api/sync/status');
          if (!res.ok) return;
          const data = await res.json();

          if (data.isSyncing) {
            setIsSyncing(true);
            isSyncingRef.current = true;
            if (data.progress) {
              setSyncProgress(data.progress);
            }
            startPolling();
          } else if (data.phase === 'pending') {
            // Pending chunks remain! Cancel any throttled timer and resume the next chunk immediately
            stopPolling();
            if (chainedTimeoutRef.current) {
              clearTimeout(chainedTimeoutRef.current);
              chainedTimeoutRef.current = null;
            }
            handleSync(false, true);
          } else if (data.phase === 'complete') {
            stopPolling();
            if (isSyncingRef.current) {
              isSyncingRef.current = false;
              setIsSyncing(false);
              setSyncProgress(null);
              setSyncResult({
                show: true,
                success: true,
                message: 'Placement sync complete',
                newEmails: data.progress?.newEmails || 0,
                newCompanies: data.progress?.newCompanies || 0,
              });
              router.refresh();
              setTimeout(() => setSyncResult(null), 5000);
            }
          } else {
            if (isSyncingRef.current && !data.isSyncing) {
              stopPolling();
              isSyncingRef.current = false;
              setIsSyncing(false);
              setSyncProgress(null);
            }
          }
        } catch {
          // Ignore network errors on visibility change
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [handleSync, router, startPolling, stopPolling]);

  // Idle Background Polling: Detect if a sync was started by the external cron job
  // while the user is just sitting on the page without switching tabs.
  useEffect(() => {
    const idleInterval = setInterval(async () => {
      // If we are already actively syncing or the tab is hidden, skip the idle check
      if (isSyncingRef.current || document.visibilityState === 'hidden') return;

      try {
        const res = await fetch('/api/sync/status');
        if (!res.ok) return;
        const data = await res.json();

        if (data.isSyncing) {
          // A sync started in the background!
          setIsSyncing(true);
          isSyncingRef.current = true;
          if (data.progress) {
            setSyncProgress(data.progress);
          }
          startPolling();
        } else if (data.phase === 'pending') {
          // Pending chunks remaining, resume them
          handleSync(true);
        }
      } catch {
        // Ignore network errors on background polling
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(idleInterval);
  }, [startPolling, handleSync]);

  // Listen for global sync requests (e.g. from Settings page re-sync button)
  useEffect(() => {
    const handleTriggerSync = () => {
      handleSync(false);
    };
    window.addEventListener('start-placement-sync', handleTriggerSync);
    return () => window.removeEventListener('start-placement-sync', handleTriggerSync);
  }, [handleSync]);

  // Progress percentage
  const progressPercent =
    syncProgress && syncProgress.totalMessages > 0
      ? Math.round(
          (syncProgress.processedMessages / syncProgress.totalMessages) * 100
        )
      : 0;

  return (
    <>
      <header className="flex items-center justify-between h-14 sm:h-16 px-5 sm:px-8 md:px-12 lg:px-16 xl:px-20 2xl:px-24 bg-[#09090b]/85 backdrop-blur-xl border-b border-zinc-800/80 sticky top-0 z-40 w-full min-w-0 max-w-full">
        {/* Left: Mobile logo (hidden on desktop) */}
        <div className="flex items-center gap-2 lg:hidden min-w-0 shrink">
          <Link href="/" className="flex items-center gap-2 min-w-0 group" title="Where's My Offer?">
            <AppLogoMark size={28} className="shrink-0 transition-transform group-hover:scale-105" />
            <span className="font-display text-xs sm:text-sm font-bold tracking-tight text-zinc-100 truncate hidden xs:inline">
              Where&apos;s My Offer<span className="text-emerald-400 font-extrabold ml-0.5 drop-shadow-[0_0_6px_rgba(52,211,153,0.55)]">?</span>
            </span>
          </Link>
        </div>

        {/* Center: Quick Search Trigger */}
        <div className="flex-1 max-w-xs md:max-w-md mx-3 hidden md:block">
          <Link
            href="/search"
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/40 text-xs text-zinc-400 hover:text-zinc-200 transition-all w-full group"
          >
            <Search className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
            <span className="truncate">Search drives, roles, CTCs…</span>
            <kbd className="ml-auto hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
              ⌘K
            </kbd>
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-auto">
          {/* Mobile Search Button */}
          <Link
            href="/search"
            className="flex md:hidden items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            title="Search drives & roles"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Link>

          {/* Live Sync Pill */}
          <button
            onClick={() => handleSync(false)}
            disabled={isSyncing}
            className={cn(
              'flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-mono transition-all duration-200 disabled:opacity-80 select-none cursor-pointer shrink-0',
              isSyncing
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.15)]'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-500/50'
            )}
            title={mounted && lastSyncAt ? `All inboxes caught up (${timeAgo(lastSyncAt)})` : 'Click to sync Gmail inboxes'}
            aria-label="Sync status"
          >
            {isSyncing ? (
              <>
                <Zap className="h-3 w-3 animate-pulse text-amber-400 shrink-0" />
                <span className="hidden sm:inline truncate max-w-[180px]">
                  {syncProgress?.currentPageIndex !== undefined && syncProgress?.totalPagesCount !== undefined
                    ? `Page ${(syncProgress.currentPageIndex) + 1} of ${syncProgress.totalPagesCount}`
                    : 'Syncing…'}
                </span>
                <span className="sm:hidden font-semibold">Syncing</span>
              </>
            ) : (
              <>
                <CheckCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline truncate">
                  {mounted && lastSyncAt ? `All inboxes caught up (${timeAgo(lastSyncAt)})` : 'Sync inboxes'}
                </span>
                <span className="sm:hidden font-medium">Sync</span>
              </>
            )}
          </button>

          {/* Real Notification Bell Component */}
          <NotificationBell />

          {/* User avatar & dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-emerald-500/40 transition-all cursor-pointer"
              aria-label="User profile menu"
            >
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName || 'User'}
                  className="w-8 h-8 rounded-full border border-violet-500/30 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/15 font-mono text-xs font-bold text-violet-300">
                  {userName?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'ST'}
                </div>
              )}
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#12121c]/95 backdrop-blur-2xl border border-zinc-800 rounded-2xl shadow-2xl z-50 py-1.5 animate-fade-in divide-y divide-zinc-800/80">
                  {/* User Profile Header */}
                  <div className="px-4 py-3">
                    <p className="text-xs font-semibold text-white truncate">
                      {userName || 'Logged in User'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Active Campus Session
                      </span>
                    </div>
                  </div>

                  {/* Primary Navigation / App Tools */}
                  <div className="p-1.5 space-y-0.5">
                    <Link
                      href="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-all group cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-indigo-400 group-hover:rotate-45 transition-transform duration-200" />
                      <span>Settings</span>
                    </Link>
                    <Link
                      href="/feedback"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-all group cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform duration-200" />
                      <span>Feedback & Bug Report</span>
                    </Link>
                  </div>

                  {/* Legal & Compliance Links */}
                  <div className="p-1.5 space-y-0.5">
                    <Link
                      href="/privacy"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-xl transition-all cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-zinc-500" />
                      <span>Privacy Policy</span>
                    </Link>
                    <Link
                      href="/terms"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-xl transition-all cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-zinc-500" />
                      <span>Terms of Service</span>
                    </Link>
                  </div>

                  {/* Sign Out */}
                  <div className="p-1.5">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sync Progress Bar Banner — Modern Emerald Radar Theme */}
      {syncProgress && (
        <div className="sticky top-16 z-30 bg-[#09090d]/95 backdrop-blur-xl border-b border-zinc-800/80 px-4 sm:px-6 py-2.5 animate-fade-in shadow-xl shadow-black/50">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 shrink-0">
                <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
              </div>
              <span className="text-xs font-semibold text-zinc-200 truncate">
                {syncProgress.phase === 'initializing' && 'Connecting to placement mailboxes...'}
                {syncProgress.phase === 'fetching' && (
                  <>
                    Scanning messages from{' '}
                    <span className="text-emerald-300 font-mono text-[11px] font-semibold">
                      {syncProgress.accountEmail || 'Gmail'}
                    </span>
                    ...
                  </>
                )}
                {syncProgress.phase === 'processing' && (
                  <>
                    {syncProgress.currentPageIndex === 0 ? (
                      <>
                        Processing recent emails (Page 1 of {syncProgress.totalPagesCount || 1}):{' '}
                        <span className="text-emerald-400 font-mono font-bold">
                          {syncProgress.processedMessages}
                        </span>{' '}
                        of{' '}
                        <span className="text-zinc-300 font-mono">
                          {syncProgress.totalMessages}
                        </span>{' '}
                        ({progressPercent}%)
                      </>
                    ) : syncProgress.currentPageIndex !== undefined && syncProgress.totalPagesCount ? (
                      <>
                        Processing archive: page{' '}
                        <span className="text-emerald-400 font-mono font-bold">
                          {syncProgress.currentPageIndex + 1} of {syncProgress.totalPagesCount}
                        </span>{' '}
                        ({syncProgress.processedMessages}/{syncProgress.totalMessages})
                      </>
                    ) : (
                      <>
                        Processing{' '}
                        <span className="text-emerald-400 font-mono font-bold">
                          {syncProgress.processedMessages}
                        </span>{' '}
                        of{' '}
                        <span className="text-zinc-300 font-mono">
                          {syncProgress.totalMessages}
                        </span>{' '}
                        emails ({progressPercent}%)
                      </>
                    )}
                    {syncProgress.remainingMessages !== undefined && syncProgress.remainingMessages > 0 && (
                      <span className="text-zinc-500 text-[11px] font-mono ml-1">
                        · {syncProgress.remainingMessages} remaining
                      </span>
                    )}
                    {syncProgress.accountType === 'college' ? ' · College CDC' : ' · Personal NeoPAT'}
                  </>
                )}
                {syncProgress.phase === 'complete' && 'Sync complete! Finalizing updates...'}
                {syncProgress.phase === 'error' && 'Sync encountered an error'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono bg-zinc-900/90 px-3 py-1 rounded-full border border-zinc-800 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-zinc-200 font-semibold">{syncProgress.newEmails} updates</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-300">{syncProgress.newCompanies} companies</span>
              </div>
            </div>
          </div>

          {/* Progress bar — emerald/teal luminous glow */}
          <div className="w-full h-1.5 bg-zinc-900/90 border border-zinc-800/60 rounded-full overflow-hidden relative">
            {syncProgress.totalMessages > 0 ? (
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-300 ease-out"
                style={{ width: `${Math.max(progressPercent, 2)}%` }}
              />
            ) : (
              <div className="h-full bg-gradient-to-r from-emerald-500/40 via-emerald-400 to-teal-300/40 animate-pulse rounded-full w-full" />
            )}
          </div>

          {/* Context details: Current email and First-time sync guidance */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 mt-2">
            {syncProgress.currentSubject ? (
              <p className="text-[11px] text-zinc-400 truncate font-mono flex-1">
                <span className="text-emerald-400 font-semibold mr-1.5">Indexing:</span>
                {syncProgress.currentSubject}
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500 font-mono">
                {syncProgress.phase === 'fetching' ? 'Indexing message headers...' : 'Analyzing emails...'}
              </p>
            )}

            {syncProgress.isResuming && syncProgress.alreadyIndexed && syncProgress.alreadyIndexed > 0 ? (
              <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 self-start sm:self-auto animate-fade-in font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-semibold text-emerald-300">Resumed:</span>
                <span className="text-zinc-300">{syncProgress.alreadyIndexed} indexed</span>
                <span className="text-zinc-500">({syncProgress.remainingMessages} left)</span>
              </span>
            ) : syncProgress.currentPageIndex === 0 ? (
              <span className="text-[10px] text-emerald-300 font-medium bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 self-start sm:self-auto font-mono">
                <span className="text-emerald-400">⚡ Recency-First:</span>
                <span className="text-zinc-400">Syncing latest circulars first</span>
              </span>
            ) : syncProgress.isInitialSync ? (
              <span className="text-[10px] text-teal-300 font-medium bg-teal-500/10 border border-teal-500/25 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 self-start sm:self-auto font-mono">
                <span className="text-teal-400">⚡ Archive Indexing:</span>
                <span className="text-zinc-400">Syncing past semester history</span>
              </span>
            ) : null}
          </div>

          {/* First-time initial sync guidance notice */}
          {syncProgress.isInitialSync && (
            <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-500/[0.03] -mx-4 -mb-2.5 px-4 py-2 border-b border-emerald-500/15">
              <div className="flex items-center gap-2 text-zinc-300 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
                <p className="leading-snug text-[11px] sm:text-xs">
                  <span className="font-semibold text-emerald-300">First-Time Setup:</span> Scanning your entire placement history takes time on the initial run. <span className="text-zinc-400">Once indexed, all future syncs are near-instant (2s delta updates).</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-zinc-400 bg-zinc-900/90 px-2.5 py-1 rounded-md border border-zinc-800 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Auto-chaining chunks · Fully Resumable</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync Result Toast */}
      {syncResult?.show && (
        <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 animate-fade-in">
          <div
            className={cn(
              'flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-2xl min-w-[320px] max-w-[420px]',
              syncResult.success
                ? 'bg-[#0f1715]/95 border-emerald-500/30 text-emerald-300'
                : 'bg-[#1a0f12]/95 border-red-500/30 text-red-300'
            )}
          >
            {syncResult.success ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-xs font-semibold">
                {syncResult.message}
              </p>
              {syncResult.success && (
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {syncResult.newEmails} new updates · {syncResult.newCompanies} companies indexed
                </p>
              )}
            </div>
            <button
              onClick={() => setSyncResult(null)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
