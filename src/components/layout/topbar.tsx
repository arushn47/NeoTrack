'use client';

import { Bell, RefreshCw, LogOut, CheckCircle, AlertCircle, X, Sparkles, User, Settings, PieChart, Calendar, Search, Building2 } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';
import NotificationBell from '@/components/notifications/notification-bell';

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
}

export default function Topbar({ userName, userAvatar, lastSyncAt }: TopbarProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
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

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;

    pollIntervalRef.current = setInterval(async () => {
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
    }, 2500);
  }, [router, stopPolling]);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => stopPolling();
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

  const handleSync = useCallback(async (silent: boolean = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncResult(null);

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

      const decoder = new TextDecoder();
      let buffer = '';

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
                // A background sync (e.g. from 15-min cron) is already actively running
                startPolling();
                return;
              }

              if ((currentEvent === 'progress' || currentEvent === 'sync_progress') && !silent) {
                setSyncProgress(parsed);
              } else if (currentEvent === 'complete' || currentEvent === 'sync_complete') {
                stopPolling();
                // Smooth transition: show 100% completion in banner briefly before toast
                setSyncProgress((prev) => (prev ? { ...prev, phase: 'complete' } : null));

                setTimeout(() => {
                  setSyncProgress(null);
                  setSyncResult({
                    show: true,
                    success: true,
                    message: 'Placement sync complete',
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
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [router, startPolling, stopPolling]);

  const handleLogout = async () => {
    await fetch('/api/auth/disconnect', { method: 'DELETE' });
    window.location.href = '/login';
  };

  // On mount: check if a sync is currently active (e.g. after page reload or triggered by 15-min background cron)
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
        } else if (!lastSyncAt || Date.now() - new Date(lastSyncAt).getTime() > 60 * 60 * 1000) {
          // Only trigger silent sync on mount if it hasn't synced in over 1 hour
          // (cron-job.org handles background sync every 15 minutes)
          handleSync(true);
        }
      })
      .catch(() => {});
  }, [lastSyncAt, handleSync, startPolling]);

  // Progress percentage
  const progressPercent =
    syncProgress && syncProgress.totalMessages > 0
      ? Math.round(
          (syncProgress.processedMessages / syncProgress.totalMessages) * 100
        )
      : 0;

  return (
    <>
      <header className="flex items-center justify-between h-16 px-4 sm:px-6 bg-[#0a0a10]/85 backdrop-blur-2xl border-b border-zinc-800/80 sticky top-0 z-40 selection:bg-indigo-500/20">
        {/* Left: Mobile logo (hidden on desktop) */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm font-mono">N</span>
          </div>
          <span className="text-white font-bold text-sm tracking-tight font-mono">
            Neo<span className="text-indigo-400">Track</span>
          </span>
        </div>

        {/* Center: Quick Search Trigger */}
        <div className="flex-1 max-w-xs md:max-w-md mx-3 hidden sm:block">
          <Link
            href="/search"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 hover:border-indigo-500/30 text-xs text-zinc-400 hover:text-zinc-200 transition-all w-full group"
          >
            <Search className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
            <span className="truncate">Search drives, tests, shortlists...</span>
            <kbd className="ml-auto hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/50">
              ⌘K
            </kbd>
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Live Sync Button */}
          <button
            onClick={() => handleSync(false)}
            disabled={isSyncing}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 disabled:opacity-75',
              isSyncing
                ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-300 shadow-sm shadow-indigo-500/10'
                : syncResult?.success
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-850'
            )}
            aria-label="Sync emails"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>
                  Syncing…{' '}
                  {syncProgress && syncProgress.totalMessages > 0
                    ? `${syncProgress.processedMessages}/${syncProgress.totalMessages}`
                    : ''}
                </span>
              </>
            ) : syncResult?.success ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Synced Just Now</span>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    mounted && lastSyncAt && Date.now() - new Date(lastSyncAt).getTime() < 3600000
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                      : 'bg-amber-400'
                  )}
                />
                <span>
                  {mounted && lastSyncAt ? `Synced ${timeAgo(lastSyncAt)}` : 'Sync Now'}
                </span>
              </>
            )}
          </button>

          {/* Real Notification Bell Component */}
          <NotificationBell />

          {/* User avatar & dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-indigo-500/40 transition-all"
              aria-label="User profile menu"
            >
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName || 'User'}
                  className="w-8 h-8 rounded-full border border-zinc-700/80 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 p-0.5 flex items-center justify-center">
                  <div className="w-full h-full bg-[#101018] rounded-full flex items-center justify-center text-indigo-300 font-bold text-xs">
                    {userName?.charAt(0)?.toUpperCase() || <User className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
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

                  {/* Navigation Links in Dropdown */}
                  <div className="p-1.5 space-y-0.5">
                    <Link
                      href="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-all group"
                    >
                      <Settings className="w-4 h-4 text-indigo-400 group-hover:rotate-45 transition-transform duration-200" />
                      <span>Settings</span>
                    </Link>
                  </div>

                  {/* Sign Out */}
                  <div className="p-1.5">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
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

      {/* Sync Progress Bar Banner */}
      {syncProgress && (
        <div className="sticky top-16 z-30 bg-[#0e0e18]/95 backdrop-blur-xl border-b border-indigo-500/20 px-4 sm:px-6 py-3 animate-fade-in shadow-lg shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin flex-shrink-0" />
              <span className="text-xs font-semibold text-zinc-200">
                {syncProgress.phase === 'initializing' && 'Connecting to placement mailboxes...'}
                {syncProgress.phase === 'fetching' && (
                  <>
                    Scanning messages from{' '}
                    <span className="text-indigo-300 font-mono text-[11px]">
                      {syncProgress.accountEmail || 'Gmail'}
                    </span>
                    ...
                  </>
                )}
                {syncProgress.phase === 'processing' && (
                  <>
                    Processing{' '}
                    <span className="text-indigo-300 font-mono">
                      {syncProgress.processedMessages}
                    </span>{' '}
                    of{' '}
                    <span className="text-zinc-300 font-mono">
                      {syncProgress.totalMessages}
                    </span>{' '}
                    emails ({progressPercent}%)
                    {syncProgress.remainingMessages !== undefined && syncProgress.remainingMessages > 0 && (
                      <span className="text-zinc-400 text-[11px] font-mono ml-1">
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-mono bg-zinc-900/80 px-2 py-0.5 rounded-md border border-zinc-800">
                {syncProgress.newEmails} new updates · {syncProgress.newCompanies} companies
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden relative">
            {syncProgress.totalMessages > 0 ? (
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(progressPercent, 2)}%` }}
              />
            ) : (
              <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-full animate-pulse w-full" />
            )}
          </div>

          {/* Context details: Current email and First-time sync guidance */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mt-1.5">
            {syncProgress.currentSubject ? (
              <p className="text-[10px] text-zinc-400 truncate font-mono flex-1">
                📧 {syncProgress.currentSubject}
              </p>
            ) : (
              <p className="text-[10px] text-zinc-500 font-mono">
                {syncProgress.phase === 'fetching' ? 'Indexing message headers...' : 'Analyzing emails...'}
              </p>
            )}

            {syncProgress.isResuming && syncProgress.alreadyIndexed && syncProgress.alreadyIndexed > 0 ? (
              <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 self-start sm:self-auto animate-fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-semibold text-emerald-300">Resumed checkpoint:</span>
                <span className="text-zinc-300">{syncProgress.alreadyIndexed} emails already saved</span>
                <span className="text-zinc-400 font-mono">({syncProgress.remainingMessages} remaining)</span>
              </span>
            ) : syncProgress.isInitialSync ? (
              <span className="text-[10px] text-amber-400/90 font-medium bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1 self-start sm:self-auto">
                <span>⚡ First-time sync:</span>
                <span className="text-zinc-400">Scanning placement emails from July 1st. Future syncs are fast.</span>
              </span>
            ) : null}
          </div>
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
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
