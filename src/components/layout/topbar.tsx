'use client';

import { Bell, RefreshCw, LogOut, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  newEmails: number;
  newCompanies: number;
  skippedDuplicates: number;
  errors: string[];
  currentSubject?: string;
}

export default function Topbar({ userName, userAvatar, lastSyncAt }: TopbarProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const hasMountedAutoSyncRef = useRef(false);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationsCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncResult, setSyncResult] = useState<{
    show: boolean;
    success: boolean;
    message: string;
    newEmails: number;
    newCompanies: number;
  } | null>(null);

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

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = '';

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6).trim();
          } else if (line === '' && currentEvent && currentData) {
            // Process the complete event
            try {
              const data = JSON.parse(currentData);

              if (currentEvent === 'sync_progress') {
                setSyncProgress(data as SyncProgress);
              } else if (currentEvent === 'sync_complete') {
                const r = data.result;
                setSyncProgress(null);
                setSyncResult({
                  show: true,
                  success: true,
                  message: `Sync complete!`,
                  newEmails: r.newEmails,
                  newCompanies: r.newCompanies,
                });
                // Step 1: Relink any orphaned emails (company_id=null) to companies
                // Step 2: Re-evaluate all stored emails against latest classification rules
                fetch('/api/sync/relink-orphans', { method: 'POST' })
                  .then(() => fetch('/api/sync/reprocess', { method: 'POST' }))
                  .then(() => router.refresh())
                  .catch(() => router.refresh());
                // Auto-hide after 5 seconds
                setTimeout(() => setSyncResult(null), 5000);
              } else if (currentEvent === 'sync_error') {
                setSyncProgress(null);
                setSyncResult({
                  show: true,
                  success: false,
                  message: data.message || 'Sync failed',
                  newEmails: 0,
                  newCompanies: 0,
                });
                setTimeout(() => setSyncResult(null), 8000);
              }
            } catch {
              // Skip malformed JSON
            }

            currentEvent = '';
            currentData = '';
          } else if (line !== '') {
            // Incomplete event, put back in buffer
            buffer += line + '\n';
          }
        }
      }
    } catch (err) {
      console.error('Sync failed:', err);
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
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/disconnect', { method: 'DELETE' });
    window.location.href = '/login';
  };

  // Auto-sync on initial mount (runs strictly once)
  useEffect(() => {
    if (hasMountedAutoSyncRef.current) return;
    hasMountedAutoSyncRef.current = true;

    if (!lastSyncAt || Date.now() - new Date(lastSyncAt).getTime() > 5 * 60 * 1000) {
      handleSync(true);
    }
  }, [lastSyncAt, handleSync]);

  // Periodic interval sync every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      handleSync(true);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [handleSync]);

  const syncFreshness = !lastSyncAt
    ? 'text-error'
    : Date.now() - new Date(lastSyncAt).getTime() < 3600000
      ? 'text-success'
      : 'text-warning';

  // Progress percentage
  const progressPercent =
    syncProgress && syncProgress.totalMessages > 0
      ? Math.round(
          (syncProgress.processedMessages / syncProgress.totalMessages) * 100
        )
      : 0;

  return (
    <>
      <header className="flex items-center justify-between h-14 px-4 sm:px-6 bg-bg-surface/90 backdrop-blur-xl border-b border-border-default sticky top-0 z-40">
        {/* Left: Mobile logo (hidden on desktop) */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent to-indigo-500 shadow-md shadow-accent/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">N</span>
          </div>
          <span className="text-text-primary font-bold text-base tracking-tight">
            Neo<span className="text-accent">Track</span>
          </span>
        </div>

        {/* Left spacer on desktop */}
        <div className="hidden lg:block" />

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Live Sync Status & Action Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSync(false)}
              disabled={isSyncing}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-70',
                isSyncing
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : syncResult?.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:text-white hover:bg-white/[0.06]'
              )}
              aria-label="Sync emails"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin-slow text-accent" />
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
                  <span>Synced just now</span>
                </>
              ) : (
                <>
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      lastSyncAt && Date.now() - new Date(lastSyncAt).getTime() < 3600000
                        ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                        : 'bg-amber-400'
                    )}
                  />
                  <span>
                    {lastSyncAt ? `Synced ${timeAgo(lastSyncAt)}` : 'Sync now'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Real Notification Bell Component */}
          <NotificationBell />

          {/* User avatar */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-bg-surface-hover transition-all"
            >
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName || 'User'}
                  className="w-7 h-7 rounded-full border border-border-default"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                  <span className="text-accent text-xs font-medium">
                    {userName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
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
                <div className="absolute right-0 top-full mt-2 w-48 bg-bg-elevated border border-border-default rounded-xl shadow-lg z-50 py-1 animate-fade-in">
                  <div className="px-3 py-2 border-b border-border-default">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {userName || 'User'}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error hover:bg-bg-surface-hover transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sync Progress Bar */}
      {syncProgress && (
        <div className="sticky top-14 z-30 bg-bg-elevated border-b border-border-default px-6 py-3 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin-slow" />
              <span className="text-xs font-medium text-text-primary">
                {syncProgress.phase === 'initializing' && 'Initializing sync...'}
                {syncProgress.phase === 'fetching' && `Fetching emails from ${syncProgress.accountEmail}...`}
                {syncProgress.phase === 'processing' && (
                  <>
                    Processing {syncProgress.processedMessages}/{syncProgress.totalMessages}
                    {syncProgress.accountType === 'college' ? ' (College)' : ' (Personal)'}
                  </>
                )}
              </span>
            </div>
            <span className="text-xs text-text-tertiary">
              {syncProgress.newEmails} new · {syncProgress.newCompanies} companies · {syncProgress.skippedDuplicates} skipped
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-accent-hover rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Current email subject */}
          {syncProgress.currentSubject && (
            <p className="text-[10px] text-text-tertiary mt-1.5 truncate">
              📧 {syncProgress.currentSubject}
            </p>
          )}
        </div>
      )}

      {/* Sync Result Toast */}
      {syncResult?.show && (
        <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 animate-fade-in">
          <div
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[300px] max-w-[400px]',
              syncResult.success
                ? 'bg-success/10 border-success/20'
                : 'bg-error/10 border-error/20'
            )}
          >
            {syncResult.success ? (
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={cn(
                  'text-sm font-medium',
                  syncResult.success ? 'text-success' : 'text-error'
                )}
              >
                {syncResult.message}
              </p>
              {syncResult.success && (
                <p className="text-xs text-text-tertiary mt-0.5">
                  {syncResult.newEmails} new emails · {syncResult.newCompanies} companies detected
                </p>
              )}
            </div>
            <button
              onClick={() => setSyncResult(null)}
              className="text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
