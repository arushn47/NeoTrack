'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Mail,
  Fingerprint,
  AlertOctagon,
  RefreshCw,
  CheckCheck,
  Plus,
  RotateCcw,
  Trash2,
  AlertTriangle,
  X,
  Zap,
  Wrench,
} from 'lucide-react';
import NotificationSettings from '@/components/notifications/notification-settings';

interface Account {
  id: string;
  email: string;
  account_type: string;
  is_connected: boolean;
  last_sync_at: string | null;
}

interface SettingsClientProps {
  accounts: Account[];
  neoId: string;
  userEmail: string;
}

const Card = ({
  icon: Icon,
  title,
  desc,
  children,
  danger,
  testid,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  children: React.ReactNode;
  danger?: boolean;
  testid?: string;
}) => (
  <motion.section
    data-testid={testid}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45 }}
    className={`rounded-2xl border p-5 sm:p-6 ${
      danger ? 'border-rose-500/25 bg-rose-500/[0.03]' : 'border-zinc-800 bg-[#101014]'
    }`}
  >
    <div className="flex items-center gap-2.5">
      <Icon className={`h-4 w-4 ${danger ? 'text-rose-400' : 'text-emerald-400'}`} />
      <h2 className="font-display text-base font-bold tracking-tight text-white">{title}</h2>
    </div>
    <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{desc}</p>
    <div className="mt-5">{children}</div>
  </motion.section>
);

export default function SettingsClient({ accounts, neoId: initialNeoId, userEmail }: SettingsClientProps) {
  const router = useRouter();
  const [regId, setRegId] = useState(initialNeoId);
  const [isSavingId, setIsSavingId] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Reprocess state with live progress
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState<{
    step: number;
    totalSteps: number;
    message: string;
  } | null>(null);
  const [reprocessResult, setReprocessResult] = useState<{
    neoPatDrivesCount?: number;
    collegeCircularsLinked?: number;
    updatedApplications?: number;
  } | null>(null);

  // Danger Zone Modals state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const personalAccount = accounts.find((a) => a.account_type === 'personal' && a.is_connected);
  const collegeAccount = accounts.find((a) => a.account_type === 'college' && a.is_connected);

  const handleSaveRegId = async () => {
    const trimmed = regId.trim().toUpperCase();
    if (trimmed && !/^[A-Z0-9]{6,12}$/.test(trimmed)) {
      toast.error('Invalid Registration ID', {
        description: 'ID should be 6-12 alphanumeric characters (e.g. 21BCE0492).',
      });
      return;
    }

    setIsSavingId(true);
    try {
      const res = await fetch('/api/user/neo-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neo_id: trimmed || null }),
      });

      if (!res.ok) throw new Error('Failed to save ID');

      setRegId(trimmed);
      toast.success(`Registration ID saved: ${trimmed || 'None'}`);
      router.refresh();
    } catch {
      toast.error('Failed to save Registration ID');
    } finally {
      setIsSavingId(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("Disconnect this Gmail account from Where's My Offer? Sync for this inbox will pause.")) return;
    setDisconnecting(accountId);
    try {
      const res = await fetch('/api/auth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmail_account_id: accountId }),
      });
      if (res.ok) {
        toast.success('Gmail account disconnected');
        window.location.reload();
      } else {
        toast.error('Failed to disconnect');
      }
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(null);
    }
  };

  // Trigger topbar live sync
  const handleTriggerSync = () => {
    window.dispatchEvent(new CustomEvent('start-placement-sync'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info('Starting sync…', {
      description: 'Watch the live progress banner in the top navigation bar.',
    });
  };

  // Handle Reprocess Archive with live streaming progress
  const handleReprocessArchive = async () => {
    if (reprocessing) return;
    setReprocessing(true);
    setReprocessResult(null);
    setReprocessProgress({
      step: 1,
      totalSteps: 5,
      message: 'Connecting to placement archive re-indexer…',
    });

    try {
      const response = await fetch('/api/sync/reprocess?stream=true', {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
      });

      if (!response.ok) {
        throw new Error('Reprocess failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || '';

        for (const message of messages) {
          const lines = message.split('\n');
          let event = '';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
          }

          if (event && dataStr) {
            try {
              const parsed = JSON.parse(dataStr);
              if (event === 'progress') {
                setReprocessProgress(parsed);
              } else if (event === 'complete') {
                setReprocessProgress(null);
                setReprocessResult({
                  neoPatDrivesCount: parsed.neoPatDrivesCount,
                  collegeCircularsLinked: parsed.collegeCircularsLinked,
                  updatedApplications: parsed.updatedApplications,
                });
                toast.success('Archive re-index complete', {
                  description: `${parsed.neoPatDrivesCount || 0} official drives tracked, ${parsed.updatedApplications || 0} applications updated.`,
                });
                router.refresh();
              } else if (event === 'error') {
                toast.error('Re-index error', { description: parsed.message });
              }
            } catch {
              // Ignore parse error
            }
          }
        }
      }
    } catch (err: any) {
      toast.error('Reprocess failed', { description: err?.message || 'Network error' });
    } finally {
      setReprocessing(false);
      setReprocessProgress(null);
    }
  };

  // Handle Reset to Fresh Candidate Mode
  const handleResetData = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/user/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success('All placement data wiped', {
          description: 'Account reset to fresh candidate state. Starting clean sync…',
        });
        setShowResetModal(false);
        setResetConfirmText('');
        // Trigger fresh sync immediately
        handleTriggerSync();
        router.refresh();
      } else {
        toast.error('Reset failed', { description: data.error });
      }
    } catch {
      toast.error('Network error during data reset');
    } finally {
      setIsResetting(false);
    }
  };

  // Handle Complete Account Termination
  const handleTerminateAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Account terminated permanently');
        setShowDeleteModal(false);
        setDeleteConfirmText('');
        window.location.href = '/login';
      } else {
        toast.error('Termination failed', { description: data.error });
        setIsDeleting(false);
      }
    } catch {
      toast.error('Network error during account termination');
      setIsDeleting(false);
    }
  };

  return (
    <div data-testid="settings-page" className="mx-auto max-w-3xl space-y-6 w-full min-w-0">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-500">
          Connected inboxes, registration ID & sync preferences
        </p>
      </div>

      {/* Card 1: Candidate Registration ID */}
      <Card
        icon={Fingerprint}
        title="NeoPAT Candidate Registration ID"
        desc="Your unique campus ID — the Excel scanner matches this in every shortlist attachment."
        testid="regid-card"
      >
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
          <input
            data-testid="regid-input"
            value={regId}
            onChange={(e) => setRegId(e.target.value.toUpperCase())}
            placeholder="e.g. 21BCE0492"
            maxLength={12}
            className="h-11 flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 font-mono text-sm tracking-widest text-zinc-100 placeholder:text-zinc-600 placeholder:font-sans placeholder:tracking-normal focus:border-emerald-500/40 focus:outline-none"
          />
          <button
            data-testid="regid-save-btn"
            onClick={handleSaveRegId}
            disabled={isSavingId}
            className="h-11 rounded-lg bg-emerald-500 px-5 text-sm font-bold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-60 cursor-pointer w-full sm:w-auto text-center"
          >
            {isSavingId ? 'Saving…' : 'Save ID'}
          </button>
        </div>
      </Card>

      {/* Card 2: Connected Gmail Accounts */}
      <Card
        icon={Mail}
        title="Connected Gmail Accounts"
        desc="Both inboxes are read-only. Tokens are AES-256 encrypted and revocable anytime."
        testid="gmail-card"
      >
        <div className="space-y-3">
          {/* Personal Gmail Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 sm:px-4 sm:py-3.5">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
                <Mail className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">Personal Gmail</span>
                  {personalAccount ? (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                      <CheckCheck className="h-2.5 w-2.5" /> Connected
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                      Not Connected
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                  {personalAccount ? personalAccount.email : userEmail || 'your.personal@gmail.com'} · Official registrations & offer letters
                </div>
              </div>
            </div>
            {personalAccount ? (
              <button
                data-testid="disconnect-personal-btn"
                onClick={() => handleDisconnect(personalAccount.id)}
                disabled={disconnecting === personalAccount.id}
                className="shrink-0 rounded-lg border border-zinc-800 px-3.5 py-2 text-[11px] font-semibold text-zinc-500 transition-colors hover:border-rose-500/40 hover:text-rose-300 cursor-pointer w-full sm:w-auto text-center"
              >
                {disconnecting === personalAccount.id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : (
              <a
                href="/api/auth/google?type=personal"
                className="flex items-center justify-center gap-1.5 shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors w-full sm:w-auto text-center"
              >
                <Plus className="h-3.5 w-3.5" /> Connect
              </a>
            )}
          </div>

          {/* College Gmail Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 sm:px-4 sm:py-3.5">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
                <Mail className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">
                    College Gmail (VIT Bhopal)
                  </span>
                  {collegeAccount ? (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                      <CheckCheck className="h-2.5 w-2.5" /> Connected
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                      Action Required
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                  {collegeAccount ? collegeAccount.email : 'student.23bce@vitbhopal.ac.in'} · CDC circulars, test links & shortlists
                </div>
              </div>
            </div>
            {collegeAccount ? (
              <button
                data-testid="disconnect-college-btn"
                onClick={() => handleDisconnect(collegeAccount.id)}
                disabled={disconnecting === collegeAccount.id}
                className="shrink-0 rounded-lg border border-zinc-800 px-3.5 py-2 text-[11px] font-semibold text-zinc-500 transition-colors hover:border-rose-500/40 hover:text-rose-300 cursor-pointer w-full sm:w-auto text-center"
              >
                {disconnecting === collegeAccount.id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : (
              <a
                href="/api/auth/google?type=college"
                className="flex items-center justify-center gap-1.5 shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500 px-3.5 py-2 text-[11px] font-bold text-zinc-950 hover:bg-emerald-400 transition-colors w-full sm:w-auto text-center"
              >
                <Plus className="h-3.5 w-3.5" /> Link College Gmail
              </a>
            )}
          </div>

          {/* Sync Trigger Action */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-800/80">
            <div className="text-xs text-zinc-500">
              Fetch incoming emails from both Gmail inboxes. Live status shows in the top navigation bar.
            </div>
            <button
              type="button"
              onClick={handleTriggerSync}
              className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer shrink-0"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Sync Inboxes Now</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Card 3: Real Persistent Notification & Reminder Preferences */}
      <NotificationSettings />

      {/* Card 4: Archive Re-index & Engine Diagnostics */}
      <Card
        icon={Wrench}
        title="Placement Engine Diagnostics & Archive Re-index"
        desc="Re-run the latest extraction rules, drive matching algorithms, and bug fixes across all your stored emails without re-downloading from Gmail. Use this whenever you report an error in the Feedback tab and a fix is deployed."
        testid="reprocess-card"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-zinc-200">
                Reprocess Stored Placement Records
              </div>
              <p className="text-xs text-zinc-500">
                Re-evaluates drive numbers, stages, CTCs, and shortlists for all stored emails.
              </p>
            </div>
            <button
              type="button"
              data-testid="reprocess-btn"
              onClick={handleReprocessArchive}
              disabled={reprocessing}
              className="flex items-center justify-center gap-2 shrink-0 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer w-full sm:w-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reprocessing ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{reprocessing ? 'Reprocessing…' : 'Reprocess & Apply Fixes'}</span>
            </button>
          </div>

          {/* Live Reprocess Progress Banner */}
          {reprocessProgress && (
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.06] space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-200 flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
                  Step {reprocessProgress.step} of {reprocessProgress.totalSteps}: {reprocessProgress.message}
                </span>
                <span className="font-mono text-indigo-300 font-bold">
                  {Math.min(99, Math.round((reprocessProgress.step / reprocessProgress.totalSteps) * 100))}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${Math.min(99, (reprocessProgress.step / reprocessProgress.totalSteps) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {reprocessResult && !reprocessing && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] text-xs text-emerald-300 animate-fade-in">
              <CheckCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Re-indexed successfully: {reprocessResult.neoPatDrivesCount} official drives tracked, {reprocessResult.updatedApplications} applications updated.
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Card 5: Danger Zone Overhaul */}
      <Card
        icon={AlertOctagon}
        title="Danger Zone"
        desc="Irreversible actions for data purging or account termination."
        danger
        testid="danger-card"
      >
        <div className="space-y-4">
          {/* Action 1: Reset All Data */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                <RotateCcw className="h-4 w-4 text-amber-400" />
                <span>Reset Placement Data (Fresh Candidate Mode)</span>
              </div>
              <p className="text-xs text-zinc-400">
                Wipes all stored companies, applications, emails, shortlists, and events. Keeps your Google login and Candidate ID so you can re-sync from scratch.
              </p>
            </div>
            <button
              type="button"
              data-testid="reset-data-btn"
              onClick={() => {
                setResetConfirmText('');
                setShowResetModal(true);
              }}
              className="flex items-center justify-center gap-2 shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 cursor-pointer w-full sm:w-auto"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset All Data</span>
            </button>
          </div>

          {/* Action 2: Terminate Account Entirely */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.04]">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-rose-300 text-sm font-semibold">
                <Trash2 className="h-4 w-4 text-rose-400" />
                <span>Terminate & Delete Account Entirely</span>
              </div>
              <p className="text-xs text-zinc-400">
                Permanently revokes Google OAuth tokens with Google, deletes your user profile and all database records from Supabase, and logs you out completely.
              </p>
            </div>
            <button
              type="button"
              data-testid="terminate-account-btn"
              onClick={() => {
                setDeleteConfirmText('');
                setShowDeleteModal(true);
              }}
              className="flex items-center justify-center gap-2 shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/20 px-4 py-2.5 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/30 cursor-pointer w-full sm:w-auto"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Terminate Account</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal: Reset All Data */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#121218] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="font-display font-bold text-base text-white">Reset Placement Data?</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="text-xs text-zinc-300 space-y-2 leading-relaxed">
                <p>
                  This will permanently delete all your scanned drives, applications, events, and shortlists from Supabase.
                </p>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-400">
                  ✓ Preserved: Google account links, Registration ID<br />
                  ✗ Deleted: Companies, emails, applications, calendar events
                </div>
                <p className="text-zinc-400">
                  Type <strong className="text-amber-400 font-mono">RESET</strong> below to confirm.
                </p>
              </div>

              <input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 font-mono text-sm text-amber-300 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetData}
                  disabled={resetConfirmText.trim().toUpperCase() !== 'RESET' || isResetting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Resetting…</span>
                    </>
                  ) : (
                    <span>Confirm Reset</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal: Terminate Account Entirely */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#141012] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-rose-400">
                  <AlertOctagon className="h-5 w-5" />
                  <h3 className="font-display font-bold text-base text-white">Permanently Delete Account?</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="text-xs text-zinc-300 space-y-2 leading-relaxed">
                <p className="text-rose-200">
                  This action is <strong>completely irreversible</strong>.
                </p>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-400">
                  • Revokes Google OAuth permissions with Google<br />
                  • Deletes user profile & all database rows from Supabase<br />
                  • Destroys session cookies and signs you out
                </div>
                <p className="text-zinc-400">
                  To permanently delete your account, type <strong className="text-rose-400 font-mono">DELETE</strong> below.
                </p>
              </div>

              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 font-mono text-sm text-rose-300 placeholder:text-zinc-600 focus:border-rose-500/50 focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTerminateAccount}
                  disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || isDeleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Terminating…</span>
                    </>
                  ) : (
                    <span>Delete Account Permanently</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Legal & Compliance Footer */}
      <div className="pt-4 pb-12 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px] text-zinc-500 border-t border-zinc-850/80">
        <span className="text-zinc-600 text-center sm:text-left">
          Where&apos;s My Offer<span className="text-emerald-400 font-extrabold ml-0.5">?</span> · Placement Radar
        </span>
        <div className="flex items-center justify-center gap-2.5 sm:gap-4 whitespace-nowrap text-[11px]">
          <Link href="/feedback" className="hover:text-zinc-300 transition-colors whitespace-nowrap">
            Feedback
          </Link>
          <span className="text-zinc-700">·</span>
          <Link href="/privacy" className="hover:text-zinc-300 transition-colors whitespace-nowrap">
            Privacy
          </Link>
          <span className="text-zinc-700">·</span>
          <Link href="/terms" className="hover:text-zinc-300 transition-colors whitespace-nowrap">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}
