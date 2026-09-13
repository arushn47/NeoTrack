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
  ChevronRight,
  ShieldCheck,
  Timer,
  Check,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { cn } from '@/lib/utils';
import type { NotificationPreferences } from '@/lib/notifications/preferences';
import { DEFAULT_PREFERENCES } from '@/lib/notifications/preferences';

const REMINDER_EVENT_OPTIONS = [
  {
    id: 'test',
    label: 'Tests & Coding Assessments',
    desc: 'Online exams, Hackerrank, Mettl, & Codility',
    types: ['online_test', 'coding_test'],
  },
  {
    id: 'interview',
    label: 'Technical & HR Interviews',
    desc: 'Interview rounds, slots, and panel links',
    types: ['technical_interview', 'hr_interview', 'final_interview'],
  },
  {
    id: 'ppt',
    label: 'Pre-Placement Talks (PPT)',
    desc: 'Corporate presentations and briefing sessions',
    types: ['ppt'],
  },
  {
    id: 'deadline',
    label: 'Registration Deadlines',
    desc: 'CDC portal and NeoPAT registration cut-offs',
    types: ['registration_deadline'],
  },
];

const LEAD_TIME_OPTIONS = [
  { minutes: 1440, label: '24 hours before' },
  { minutes: 120, label: '2 hours before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 30, label: '30 minutes before' },
  { minutes: 15, label: '15 minutes before' },
];

export default function NotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isChecking,
    loading: pushLoading,
    error: pushError,
    subscribeToPush,
    unsubscribeFromPush,
  } = usePushNotifications();

  const [preferences, setPreferences] = useState<Partial<NotificationPreferences>>({
    ...DEFAULT_PREFERENCES,
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

  const handleUpdatePref = async (updates: Partial<NotificationPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));

    try {
      setSavingPrefs(true);
      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Failed to save preference:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleTogglePref = (key: keyof NotificationPreferences, currentValue: boolean) => {
    handleUpdatePref({ [key]: !currentValue });
  };

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribeFromPush();
      handleUpdatePref({ browserPushEnabled: false });
    } else {
      const ok = await subscribeToPush();
      if (ok) {
        handleUpdatePref({ browserPushEnabled: true });
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
          message: 'Test notification sent! Check your notification bell and desktop alert.',
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

  const currentReminderTypes = preferences.reminderEventTypes || DEFAULT_PREFERENCES.reminderEventTypes;
  const currentLeadTimes = preferences.reminderLeadTimeMins || DEFAULT_PREFERENCES.reminderLeadTimeMins;

  const toggleReminderEventType = (types: string[]) => {
    const allIncluded = types.every((t) => currentReminderTypes.includes(t));
    let nextTypes: string[];
    if (allIncluded) {
      nextTypes = currentReminderTypes.filter((t) => !types.includes(t));
    } else {
      nextTypes = Array.from(new Set([...currentReminderTypes, ...types]));
    }
    handleUpdatePref({ reminderEventTypes: nextTypes });
  };

  const toggleLeadTime = (minutes: number) => {
    let nextTimes: number[];
    if (currentLeadTimes.includes(minutes)) {
      if (currentLeadTimes.length <= 1) {
        // Keep at least one
        return;
      }
      nextTimes = currentLeadTimes.filter((m) => m !== minutes);
    } else {
      nextTimes = [...currentLeadTimes, minutes].sort((a, b) => b - a);
    }
    handleUpdatePref({ reminderLeadTimeMins: nextTimes });
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
            <Bell className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-white">
              Notification & Reminder Preferences
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Customize real-time radar pings, push alerts, and event reminder intervals.
            </p>
          </div>
        </div>
        {savingPrefs && (
          <span className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono">
            <Loader2 className="w-3 h-3 animate-spin text-emerald-400" /> Saving…
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* Browser Push Master Toggle */}
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/90 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-zinc-100">Browser Push Notifications</span>
              </div>
              <p className="text-xs text-zinc-400">
                Receive instant alerts for test schedules, shortlists, and reminders even when the tab is closed.
              </p>
            </div>

            {isChecking ? (
              <div className="flex items-center gap-2 shrink-0 py-1.5 px-3 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500 font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                <span>Checking…</span>
              </div>
            ) : isSubscribed ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Active
                </span>
                <button
                  type="button"
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:border-rose-500/40 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer"
                >
                  {pushLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Turn Off / Disconnect'
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleTogglePush}
                disabled={pushLoading || !isSupported}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {pushLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Enable Desktop Push'
                )}
              </button>
            )}
          </div>

          {pushError && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{pushError}</span>
            </div>
          )}

          {permission === 'denied' && (
            <p className="text-[11px] text-amber-400/90">
              ⚠️ Notifications are blocked in your browser. Click the lock icon in your URL address bar to allow notifications.
            </p>
          )}

          {/* Test Notification Button */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Verify your push and bell setup:</span>
            <button
              type="button"
              onClick={handleSendTestNotification}
              disabled={testingPush}
              className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700/60 transition-colors cursor-pointer"
            >
              {testingPush ? (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
              ) : (
                <Send className="w-3 h-3 text-zinc-400" />
              )}
              <span>Send Test Notification</span>
            </button>
          </div>

          {testFeedback && (
            <div
              className={cn(
                'flex items-center gap-2 text-xs p-2.5 rounded-lg animate-fade-in',
                testFeedback.success
                  ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-rose-300 bg-rose-500/10 border border-rose-500/20'
              )}
            >
              {testFeedback.success ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              )}
              <span>{testFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Granular Notification Channels */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Notify me when:
            </p>
            <span className="text-[11px] text-zinc-500">In-app bell & push</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                key: 'notifyShortlist' as const,
                label: 'Shortlists & Neo ID Matches',
                desc: 'When your Roll / Neo ID is found in an Excel shortlist attachment',
                icon: Sparkles,
                color: 'text-emerald-400',
              },
              {
                key: 'notifyTests' as const,
                label: 'Tests & Assessments Scheduled',
                desc: 'Online & coding test timings, slots, and platform links',
                icon: FileText,
                color: 'text-amber-400',
              },
              {
                key: 'notifyInterviews' as const,
                label: 'Interviews Scheduled',
                desc: 'Technical, HR, and final round slots & meeting links',
                icon: Award,
                color: 'text-purple-400',
              },
              {
                key: 'notifyPpt' as const,
                label: 'Pre-Placement Talks (PPT)',
                desc: 'Company presentations, orientations, and attendance requirements',
                icon: Calendar,
                color: 'text-sky-400',
              },
              {
                key: 'notifyStatusChange' as const,
                label: 'Application Status Updates',
                desc: 'Applied, Selected / Offer Won, or Withdrawn changes',
                icon: CheckCircle2,
                color: 'text-cyan-400',
              },
              {
                key: 'notifyNewJds' as const,
                label: 'New Placement JDs & Drives',
                desc: 'Newly announced hiring circulars and registration notices',
                icon: Building2,
                color: 'text-indigo-400',
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
                      ? 'bg-zinc-900/60 border-zinc-700/80 hover:border-emerald-500/40'
                      : 'bg-zinc-900/20 border-zinc-800/40 opacity-50 hover:opacity-80'
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className={cn('w-4 h-4', color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-zinc-100 truncate">{label}</p>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Controlled by parent div click
                        className="rounded border-zinc-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer accent-emerald-500"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customizable Reminders Section */}
        <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/90 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10">
                <Timer className="h-3.5 w-3.5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Event Reminders & Lead Times</h3>
                <p className="text-[11px] text-zinc-500">
                  Pick exactly which events trigger countdown reminders and when they ping you.
                </p>
              </div>
            </div>

            {/* Master Reminder Toggle */}
            <button
              type="button"
              onClick={() => handleTogglePref('notifyReminders', !!preferences.notifyReminders)}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 cursor-pointer',
                preferences.notifyReminders ? 'border-emerald-500/50 bg-emerald-500/25' : 'border-zinc-700 bg-zinc-800'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-200',
                  preferences.notifyReminders ? 'left-[22px] bg-emerald-400' : 'left-0.5 bg-zinc-500'
                )}
              />
            </button>
          </div>

          {preferences.notifyReminders && (
            <div className="space-y-4 pt-2 border-t border-zinc-800/70 animate-fade-in">
              {/* Event Types to Remind For */}
              <div>
                <p className="text-xs font-semibold text-zinc-300 mb-2.5">
                  Send reminders for these events:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REMINDER_EVENT_OPTIONS.map((opt) => {
                    const isSelected = opt.types.every((t) => currentReminderTypes.includes(t));
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleReminderEventType(opt.types)}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border text-left transition-all cursor-pointer select-none',
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        )}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-xs font-semibold">{opt.label}</p>
                          <p className="text-[10px] text-zinc-500 truncate mt-0.5">{opt.desc}</p>
                        </div>
                        <div
                          className={cn(
                            'w-4 h-4 rounded flex items-center justify-center border shrink-0',
                            isSelected
                              ? 'bg-emerald-500 border-emerald-400 text-zinc-950'
                              : 'border-zinc-700 bg-zinc-800'
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lead Time Selection */}
              <div>
                <p className="text-xs font-semibold text-zinc-300 mb-2">
                  Reminder alerts schedule:
                </p>
                <div className="flex flex-wrap gap-2">
                  {LEAD_TIME_OPTIONS.map((lt) => {
                    const isSelected = currentLeadTimes.includes(lt.minutes);
                    return (
                      <button
                        key={lt.minutes}
                        type="button"
                        onClick={() => toggleLeadTime(lt.minutes)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-medium transition-all cursor-pointer',
                          isSelected
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                            : 'bg-zinc-800/40 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                        )}
                      >
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{lt.label}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">
                  Radar checks all active tests, rounds, and PPTs against these intervals.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
