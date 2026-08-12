'use client';

import { useState, useEffect } from 'react';
import {
  Bell,
  Sparkles,
  FileText,
  Award,
  Calendar,
  Building2,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { cn } from '@/lib/utils';
import type { NotificationPreferences } from '@/lib/notifications/preferences';

export default function NotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    loading: pushLoading,
    error: pushError,
    subscribeToPush,
    unsubscribeFromPush,
  } = usePushNotifications();

  const [preferences, setPreferences] = useState<Partial<NotificationPreferences>>({
    browserPushEnabled: true,
    inAppEnabled: true,
    notifyStatusChange: true,
    notifyShortlist: true,
    notifyTests: true,
    notifyInterviews: true,
    notifyPpt: true,
    notifyNewJds: true,
    notifyReminders: true,
  });

  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Load preferences on mount
  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then((res) => res.json())
      .then((data) => {
        if (data.preferences) {
          setPreferences(data.preferences);
        }
      })
      .catch((err) => console.error('Failed to load preferences:', err))
      .finally(() => setLoadingPrefs(false));
  }, []);

  const handleTogglePref = async (key: keyof NotificationPreferences, currentValue: boolean) => {
    const newValue = !currentValue;
    setPreferences((prev) => ({ ...prev, [key]: newValue }));

    try {
      setSavingPrefs(true);
      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });
    } catch (err) {
      console.error('Failed to save preference:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribeFromPush();
      await handleTogglePref('browserPushEnabled', true); // set to false
    } else {
      const ok = await subscribeToPush();
      if (ok) {
        await handleTogglePref('browserPushEnabled', false); // set to true
      }
    }
  };

  const handleSendTestNotification = async () => {
    setTestingPush(true);
    setTestFeedback(null);
    try {
      const res = await fetch('/api/notifications/test', { method: 'POST' });
      if (res.ok) {
        setTestFeedback({
          success: true,
          message: 'Test notification sent! Check your notification bell and desktop push.',
        });
      } else {
        throw new Error('Test failed');
      }
    } catch {
      setTestFeedback({
        success: false,
        message: 'Could not send test notification.',
      });
    } finally {
      setTestingPush(false);
      setTimeout(() => setTestFeedback(null), 5000);
    }
  };

  return (
    <section className="rounded-xl bg-bg-surface border border-border-default overflow-hidden">
      <div className="px-5 py-4 border-b border-border-default flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" />
          Notification Preferences
        </h2>
        {savingPrefs && (
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
          </span>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* Browser Push Master Toggle */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-white">Browser Push Notifications</span>
              </div>
              <p className="text-xs text-zinc-400">
                Receive instant alerts for test schedules and shortlists even when NeoTrack is closed.
              </p>
            </div>

            <button
              onClick={handleTogglePush}
              disabled={pushLoading || !isSupported}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                isSubscribed
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                  : 'bg-accent text-white hover:bg-accent-hover'
              )}
            >
              {pushLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isSubscribed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Enabled
                </>
              ) : (
                'Enable Push'
              )}
            </button>
          </div>

          {pushError && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{pushError}</span>
            </div>
          )}

          {permission === 'denied' && (
            <p className="text-[11px] text-amber-400/90">
              ⚠️ Notifications are blocked in your browser settings. Click the lock icon in your URL bar to allow notifications.
            </p>
          )}

          {/* Test Notification Button */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Verify your setup</span>
            <button
              onClick={handleSendTestNotification}
              disabled={testingPush}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              {testingPush ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              <span>Send Test Notification</span>
            </button>
          </div>

          {testFeedback && (
            <div
              className={cn(
                'flex items-center gap-2 text-xs p-2 rounded-lg animate-fade-in',
                testFeedback.success
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-red-400 bg-red-500/10 border border-red-500/20'
              )}
            >
              {testFeedback.success ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              <span>{testFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Granular Notification Channels */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Notify me when:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                key: 'notifyStatusChange' as const,
                label: 'Application Status Changes',
                desc: 'Applied, Withdrawn, Rejected, or Selected',
                icon: CheckCircle2,
                color: 'text-cyan-400',
              },
              {
                key: 'notifyShortlist' as const,
                label: 'Shortlisted & Neo ID Matches',
                desc: 'When your Neo ID is found in an Excel list',
                icon: Sparkles,
                color: 'text-emerald-400',
              },
              {
                key: 'notifyTests' as const,
                label: 'Tests & Assessments Scheduled',
                desc: 'Online & coding test timings and links',
                icon: FileText,
                color: 'text-amber-400',
              },
              {
                key: 'notifyInterviews' as const,
                label: 'Interviews Scheduled',
                desc: 'Technical, HR, and final round slots',
                icon: Award,
                color: 'text-purple-400',
              },
              {
                key: 'notifyPpt' as const,
                label: 'Pre-Placement Talks (PPT)',
                desc: 'Company presentations & orientation dates',
                icon: Calendar,
                color: 'text-blue-400',
              },
              {
                key: 'notifyNewJds' as const,
                label: 'New Placement JDs & Drives',
                desc: 'New company registrations discovered',
                icon: Building2,
                color: 'text-indigo-400',
              },
              {
                key: 'notifyReminders' as const,
                label: 'Upcoming Reminders & Deadlines',
                desc: '24h and 1h alerts before test start times',
                icon: Clock,
                color: 'text-rose-400',
              },
            ].map(({ key, label, desc, icon: Icon, color }) => {
              const isChecked = !!preferences[key];
              return (
                <div
                  key={key}
                  onClick={() => handleTogglePref(key, isChecked)}
                  className={cn(
                    'flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none',
                    isChecked
                      ? 'bg-white/[0.03] border-white/10 hover:border-white/20'
                      : 'bg-white/[0.01] border-white/5 opacity-60 hover:opacity-100'
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className={cn('w-4 h-4', color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-white truncate">{label}</p>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Controlled by div click
                        className="rounded border-zinc-700 text-accent focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
