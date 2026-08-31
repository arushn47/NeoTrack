'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Link2,
  Link2Off,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  Save,
  Loader2,
  Shield,
  Sparkles,
  User,
  Check,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';
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

export default function SettingsClient({ accounts, neoId: initialNeoId, userEmail }: SettingsClientProps) {
  const router = useRouter();
  const [neoId, setNeoId] = useState(initialNeoId);
  const [savingNeoId, setSavingNeoId] = useState(false);
  const [neoIdSaved, setNeoIdSaved] = useState(false);
  const [neoIdError, setNeoIdError] = useState('');
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<{
    message: string;
    neoPatDrivesCount?: number;
    deletedNonNeoPatCompanies?: string[];
    collegeCircularsLinked?: number;
    collegeCircularsDiscarded?: number;
    updatedApplications?: number;
  } | null>(null);

  const handleReprocess = async () => {
    setReprocessing(true);
    setReprocessResult(null);
    try {
      const res = await fetch('/api/sync/reprocess', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setReprocessResult(data);
        router.refresh();
      } else {
        alert(data.error || 'Failed to reprocess placement feeds');
      }
    } catch {
      alert('Failed to reprocess placement feeds');
    } finally {
      setReprocessing(false);
    }
  };

  const personalAccount = accounts.find((a) => a.account_type === 'personal');
  const collegeAccount = accounts.find((a) => a.account_type === 'college');

  const handleSaveNeoId = async () => {
    const trimmed = neoId.trim().toUpperCase();

    if (trimmed && !/^[A-Z0-9]{6,12}$/.test(trimmed)) {
      setNeoIdError('Neo ID should be 6-12 alphanumeric characters (e.g. A6S2A7G9)');
      return;
    }

    setSavingNeoId(true);
    setNeoIdError('');
    setNeoIdSaved(false);

    try {
      const res = await fetch('/api/user/neo-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neo_id: trimmed || null }),
      });

      if (!res.ok) throw new Error('Failed to save');

      setNeoId(trimmed);
      setNeoIdSaved(true);
      setTimeout(() => setNeoIdSaved(false), 3000);
    } catch {
      setNeoIdError('Failed to save — please try again.');
    } finally {
      setSavingNeoId(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId);
    try {
      await fetch('/api/auth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmail_account_id: accountId }),
      });
      window.location.reload();
    } catch {
      // Handle error
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in selection:bg-indigo-500/20">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">System Settings</h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Manage your connected Gmail accounts, Neo ID registration, and notification preferences.
        </p>
      </div>

      {/* Neo ID Section */}
      <section className="rounded-3xl bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 overflow-hidden shadow-xl shadow-black/20">
        <div className="px-6 py-5 border-b border-zinc-800/80">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-violet-400" />
            NeoPAT Candidate Registration ID
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Your unique campus Neo ID used to automatically detect your name in official shortlisted attachments.
          </p>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={neoId}
              onChange={(e) => {
                setNeoId(e.target.value.toUpperCase());
                setNeoIdError('');
                setNeoIdSaved(false);
              }}
              placeholder="e.g. A6S2A7G9"
              maxLength={12}
              className="flex-1 px-4 py-2.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-white text-sm font-mono tracking-wider placeholder:text-zinc-600 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 uppercase"
            />
            <button
              onClick={handleSaveNeoId}
              disabled={savingNeoId}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50 active:scale-95"
            >
              {savingNeoId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : neoIdSaved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {neoIdSaved ? 'Saved Successfully!' : 'Save ID'}
            </button>
          </div>
          {neoIdError && (
            <p className="text-xs text-red-400 mt-2.5 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              {neoIdError}
            </p>
          )}
        </div>
      </section>

      {/* Placement Intelligence Engine Maintenance / Reprocess */}
      <section className="rounded-3xl bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 overflow-hidden shadow-xl shadow-black/20">
        <div className="px-6 py-5 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Placement Feed Re-indexing & Cleanup
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Re-scans all stored emails with updated parser rules: deletes spurious company records (e.g. Google, role titles), fixes company aliases (e.g. EY GDS), and recalculates stage progression (e.g. MUFG, Epsilon test rejections).
            </p>
          </div>
          <button
            onClick={handleReprocess}
            disabled={reprocessing}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex-shrink-0"
          >
            {reprocessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Cleaning & Re-indexing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>Re-index & Clean All Drives</span>
              </>
            )}
          </button>
        </div>
        {reprocessResult && (
          <div className="p-6 bg-zinc-950/60 border-t border-zinc-800/60">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">{reprocessResult.message}</p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Tracking {reprocessResult.neoPatDrivesCount || 0} official NeoPAT drives · Purged {reprocessResult.deletedNonNeoPatCompanies?.length || 0} non-NeoPAT companies ({reprocessResult.deletedNonNeoPatCompanies?.slice(0, 5).join(', ') || 'none'}{((reprocessResult.deletedNonNeoPatCompanies?.length || 0) > 5) ? '...' : ''}) · Linked {reprocessResult.collegeCircularsLinked || 0} college circulars · Discarded {reprocessResult.collegeCircularsDiscarded || 0} irrelevant college broadcast emails.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Gmail Accounts Section */}
      <section className="rounded-3xl bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 overflow-hidden shadow-xl shadow-black/20">
        <div className="px-6 py-5 border-b border-zinc-800/80">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            Connected Gmail Accounts
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Connect both your personal and VIT college Gmail accounts to pull full placement feeds and official announcements.
          </p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {/* Personal Gmail */}
          <AccountRow
            label="Personal Gmail"
            description="NeoPAT notifications, direct application confirmations"
            account={personalAccount}
            connectUrl="/api/auth/google?type=personal"
            onDisconnect={handleDisconnect}
            disconnecting={disconnecting}
          />

          {/* College Gmail */}
          <AccountRow
            label="College Gmail (VIT)"
            description="Placement announcements, PPT links, tests, and JDs"
            account={collegeAccount}
            connectUrl="/api/auth/google?type=college"
            onDisconnect={handleDisconnect}
            disconnecting={disconnecting}
          />
        </div>
      </section>

      {/* Account Info */}
      <section className="rounded-3xl bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 overflow-hidden shadow-xl shadow-black/20">
        <div className="px-6 py-5 border-b border-zinc-800/80">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-zinc-400" />
            Account Information
          </h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{userEmail}</p>
              <p className="text-xs text-zinc-500 mt-0.5 font-mono">Primary Authenticated Session</p>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Active
            </span>
          </div>
        </div>
      </section>

      {/* Notification Preferences Section */}
      <NotificationSettings />
    </div>
  );
}

function AccountRow({
  label,
  description,
  account,
  connectUrl,
  onDisconnect,
  disconnecting,
}: {
  label: string;
  description: string;
  account?: Account;
  connectUrl: string;
  onDisconnect: (id: string) => void;
  disconnecting: string | null;
}) {
  const isConnected = account?.is_connected;
  const isDisconnected = account && !account.is_connected;

  return (
    <div className="flex items-center gap-4 px-6 py-5 hover:bg-zinc-850/30 transition-all">
      <div className={cn(
        'w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border',
        isConnected
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : isDisconnected
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          : 'bg-zinc-900 border-zinc-800 text-zinc-500'
      )}>
        <Mail className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-white">{label}</p>
          {isConnected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Connected
            </span>
          )}
          {isDisconnected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Session Expired
            </span>
          )}
        </div>
        {isConnected && account ? (
          <p className="text-xs text-zinc-400 mt-1 truncate font-mono">
            {account.email} · Last synced {timeAgo(account.last_sync_at)}
          </p>
        ) : isDisconnected && account ? (
          <p className="text-xs text-amber-300/90 mt-1 truncate">
            {account.email} · Token expired, click Reconnect to resume sync
          </p>
        ) : (
          <p className="text-xs text-zinc-500 mt-1">{description}</p>
        )}
      </div>
      {isConnected && account ? (
        <button
          onClick={() => onDisconnect(account.id)}
          disabled={disconnecting === account.id}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 border border-zinc-800 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all disabled:opacity-50"
        >
          {disconnecting === account.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Link2Off className="w-3.5 h-3.5" />
          )}
          Disconnect
        </button>
      ) : isDisconnected ? (
        <a
          href={connectUrl}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-gray-950 bg-amber-500 hover:bg-amber-400 shadow-md shadow-amber-500/25 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reconnect
        </a>
      ) : (
        <a
          href={connectUrl}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all"
        >
          <Link2 className="w-3.5 h-3.5" />
          Connect
        </a>
      )}
    </div>
  );
}
