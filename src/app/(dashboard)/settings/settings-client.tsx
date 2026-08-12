'use client';

import { useState } from 'react';
import {
  Mail,
  Link2,
  Link2Off,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  Save,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';

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
  const [neoId, setNeoId] = useState(initialNeoId);
  const [savingNeoId, setSavingNeoId] = useState(false);
  const [neoIdSaved, setNeoIdSaved] = useState(false);
  const [neoIdError, setNeoIdError] = useState('');
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

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
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your Gmail accounts, Neo ID, and preferences.
        </p>
      </div>

      {/* Neo ID Section */}
      <section className="rounded-xl bg-bg-surface border border-border-default overflow-hidden">
        <div className="px-5 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-violet-400" />
            Neo ID
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Your NeoPAT identification number used to match you in candidate shortlists.
          </p>
        </div>
        <div className="px-5 py-4">
          <div className="flex gap-3">
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
              className="flex-1 px-3 py-2 rounded-lg bg-bg-primary border border-border-default text-text-primary text-sm font-mono tracking-wider placeholder:text-text-tertiary placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
            />
            <button
              onClick={handleSaveNeoId}
              disabled={savingNeoId}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-all disabled:opacity-50"
            >
              {savingNeoId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : neoIdSaved ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {neoIdSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
          {neoIdError && (
            <p className="text-xs text-error mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {neoIdError}
            </p>
          )}
        </div>
      </section>

      {/* Gmail Accounts Section */}
      <section className="rounded-xl bg-bg-surface border border-border-default overflow-hidden">
        <div className="px-5 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400" />
            Gmail Accounts
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Connect your personal and VIT college Gmail for placement email sync.
          </p>
        </div>
        <div className="divide-y divide-border-subtle">
          {/* Personal Gmail */}
          <AccountRow
            label="Personal Gmail"
            description="NeoPAT notifications, application updates"
            account={personalAccount}
            connectUrl="/api/auth/google?type=personal"
            onDisconnect={handleDisconnect}
            disconnecting={disconnecting}
          />

          {/* College Gmail */}
          <AccountRow
            label="College Gmail (VIT)"
            description="Placement announcements, PPTs, tests, JDs"
            account={collegeAccount}
            connectUrl="/api/auth/google?type=college"
            onDisconnect={handleDisconnect}
            disconnecting={disconnecting}
          />
        </div>
      </section>

      {/* Account Info */}
      <section className="rounded-xl bg-bg-surface border border-border-default overflow-hidden">
        <div className="px-5 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">Account</h2>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{userEmail}</p>
              <p className="text-xs text-text-secondary mt-0.5">Primary sign-in account</p>
            </div>
          </div>
        </div>
      </section>
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

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
        isConnected ? 'bg-success/10' : 'bg-bg-surface-hover'
      )}>
        <Mail className={cn('w-5 h-5', isConnected ? 'text-success' : 'text-text-tertiary')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text-primary">{label}</p>
          {isConnected && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Connected
            </span>
          )}
        </div>
        {isConnected && account ? (
          <p className="text-xs text-text-secondary mt-0.5 truncate">
            {account.email} · Last synced {timeAgo(account.last_sync_at)}
          </p>
        ) : (
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        )}
      </div>
      {isConnected && account ? (
        <button
          onClick={() => onDisconnect(account.id)}
          disabled={disconnecting === account.id}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary border border-border-default hover:text-error hover:border-error/30 transition-all disabled:opacity-50"
        >
          {disconnecting === account.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Link2Off className="w-3.5 h-3.5" />
          )}
          Disconnect
        </button>
      ) : (
        <a
          href={connectUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white bg-accent hover:bg-accent-hover transition-all"
        >
          <Link2 className="w-3.5 h-3.5" />
          Connect
        </a>
      )}
    </div>
  );
}
