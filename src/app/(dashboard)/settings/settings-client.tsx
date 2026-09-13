'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { detectCampus } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Mail,
  Fingerprint,
  Bell,
  AlertOctagon,
  RefreshCw,
  LogOut,
  CheckCheck,
  Loader2,
  Plus,
  Send,
} from 'lucide-react';

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

const Toggle = ({ on, onChange, id }: { on: boolean; onChange: (v: boolean) => void; id: string }) => (
  <button
    type="button"
    data-testid={`toggle-${id}`}
    onClick={() => onChange(!on)}
    className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 cursor-pointer ${
      on ? 'border-emerald-500/50 bg-emerald-500/25' : 'border-zinc-700 bg-zinc-800'
    }`}
  >
    <span
      className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-200 ${
        on ? 'left-[22px] bg-emerald-400' : 'left-0.5 bg-zinc-500'
      }`}
    />
  </button>
);

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
    className={`rounded-2xl border p-6 ${
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
  const [reprocessing, setReprocessing] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // Notification Preferences matching Emergent prototype
  const [prefs, setPrefs] = useState({
    shortlist: true,
    tests: true,
    digest: false,
  });

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
    if (!confirm('Disconnect this Gmail account from Where\'s My Offer? Sync for this inbox will pause.')) return;
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

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const res = await fetch('/api/sync/reprocess', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Archive re-sync queued', {
          description: data.message || 'Drives cleaned, stages updated, and shortlists re-verified.',
        });
        router.refresh();
      } else {
        toast.error('Re-sync failed', { description: data.error });
      }
    } catch {
      toast.error('Network error during archive re-sync');
    } finally {
      setReprocessing(false);
    }
  };

  const handleRevokeTokens = async () => {
    if (!confirm('Are you sure you want to revoke all tokens and sign out? You will need to re-authenticate both Gmail accounts.')) {
      return;
    }
    setRevoking(true);
    try {
      await fetch('/api/auth/disconnect', { method: 'DELETE' });
      toast.success('Signed out and tokens revoked');
      window.location.href = '/login';
    } catch {
      toast.error('Failed to sign out cleanly');
      setRevoking(false);
    }
  };

  return (
    <div data-testid="settings-page" className="mx-auto max-w-3xl space-y-4 w-full min-w-0 max-w-full">
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
        </div>
      </Card>

      {/* Card 3: Notification Preferences */}
      <Card
        icon={Bell}
        title="Notification Preferences"
        desc="Choose how the radar pings you when something changes."
        testid="notifications-card"
      >
        <div className="space-y-4">
          {[
            {
              id: 'shortlist',
              label: 'Shortlist alerts',
              desc: 'Instant ping when your ID is found in any Excel sheet',
            },
            {
              id: 'tests',
              label: 'Test & interview reminders',
              desc: '2 hours and 15 minutes before every scheduled round',
            },
            {
              id: 'digest',
              label: 'Morning digest',
              desc: "One 8:00 AM summary of today's drives and deadlines",
            },
          ].map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-zinc-200">{p.label}</div>
                <div className="mt-0.5 text-[11px] text-zinc-500">{p.desc}</div>
              </div>
              <Toggle
                id={p.id}
                on={prefs[p.id as keyof typeof prefs]}
                onChange={(v) => {
                  setPrefs((s) => ({ ...s, [p.id]: v }));
                  toast.success(`${p.label} ${v ? 'enabled' : 'disabled'}`);
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Card 4: Danger Zone */}
      <Card
        icon={AlertOctagon}
        title="Danger Zone"
        desc="Irreversible actions — proceed carefully."
        danger
        testid="danger-card"
      >
        <div className="flex flex-wrap gap-3">
          <button
            data-testid="resync-btn"
            onClick={handleReprocess}
            disabled={reprocessing}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reprocessing ? 'animate-spin text-amber-400' : ''}`} />
            {reprocessing ? 'Re-syncing full archive…' : 'Re-sync full archive'}
          </button>
          <button
            data-testid="revoke-btn"
            onClick={handleRevokeTokens}
            disabled={revoking}
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            {revoking ? 'Revoking…' : 'Revoke tokens & sign out'}
          </button>
        </div>
      </Card>

      {/* Legal & Compliance Footer */}
      <div className="pt-4 pb-12 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px] text-zinc-500 border-t border-zinc-850/80">
        <span className="text-zinc-600 text-center sm:text-left">Where&apos;s My Offer · Placement Radar</span>
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
