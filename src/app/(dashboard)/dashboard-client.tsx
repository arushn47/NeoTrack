'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Building2,
  Briefcase,
  Clock,
  MapPin,
  ArrowUpRight,
  Zap,
  CalendarClock,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { StatusChip, CategoryBadge } from '@/components/ui/status-chip';
import { formatStipend } from '@/lib/utils';
import type { DashboardStats } from '@/types';

export interface ActiveApplicationItem {
  id: string;
  companyId: string;
  companyName: string;
  companyLogo: string | null;
  status: string;
  role: string | null;
  ctc: string | null;
  stipend: string | null;
  lastUpdated: string | null;
  location?: string | null;
  category?: string | null;
}

interface DashboardClientProps {
  stats: DashboardStats;
  upcomingEvents: Array<{
    id: string;
    company_id: string;
    companyName?: string;
    event_type: string;
    title: string | null;
    start_time: string | null;
    end_time: string | null;
    venue: string | null;
    mode: string | null;
  }>;
  activeApplications?: ActiveApplicationItem[];
  hasAccounts: boolean;
  hasPersonalAccount?: boolean;
  hasCollegeAccount?: boolean;
  disconnectedAccounts?: Array<{
    id: string;
    email: string;
    account_type: string;
  }>;
  hasNeoId: boolean;
  neoId: string | null;
  campus?: string | null;
  branch?: string | null;
}

const ACCENTS = {
  indigo: 'border-indigo-500/20 bg-indigo-500/[0.06] text-indigo-300',
  sky: 'border-sky-500/20 bg-sky-500/[0.06] text-sky-300',
  amber: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-300',
  violet: 'border-violet-500/20 bg-violet-500/[0.06] text-violet-300',
  emerald: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300',
};

const NEXT_EVENT_CLS: Record<string, string> = {
  online_test: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-300',
  coding_test: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-300',
  technical_interview: 'border-cyan-500/30 bg-cyan-500/[0.07] text-cyan-300',
  hr_interview: 'border-cyan-500/30 bg-cyan-500/[0.07] text-cyan-300',
  ppt: 'border-sky-500/30 bg-sky-500/[0.07] text-sky-300',
  test: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-300',
  deadline: 'border-rose-500/30 bg-rose-500/[0.07] text-rose-300',
};

const HUES = [
  'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'border-sky-500/30 bg-sky-500/10 text-sky-300',
  'border-rose-500/30 bg-rose-500/10 text-rose-300',
  'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  'border-violet-500/30 bg-violet-500/10 text-violet-300',
];

function getHue(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[hash % HUES.length];
}

function formatEventTime(dateStr: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours > 0 && diffHours < 24) return `in ${diffHours} hrs · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  if (diffDays > 0 && diffDays <= 7) return `in ${diffDays} days`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DashboardClient({
  stats,
  upcomingEvents,
  activeApplications = [],
  hasPersonalAccount = true,
  hasCollegeAccount = true,
  hasNeoId = true,
  neoId,
  campus,
  branch,
}: DashboardClientProps) {
  // Top 4 active drives with urgent stages or high progression
  const spotlightDrives = useMemo(() => {
    const active = activeApplications.filter(
      (a) => !['not_shortlisted', 'rejected', 'not_applied', 'withdrawn', 'declined'].includes(a.status)
    );
    return active.slice(0, 4);
  }, [activeApplications]);

  const funnelCards = [
    { id: 'total', label: 'Total Drives', value: stats.total_companies, sub: 'synced from CDC circulars', accent: 'indigo' as const },
    { id: 'active', label: 'Active Drives', value: stats.active_applications, sub: 'across both inboxes', accent: 'sky' as const },
    { id: 'tests', label: 'Upcoming Tests', value: stats.upcoming_tests + stats.upcoming_interviews, sub: upcomingEvents.length > 0 ? `next ${formatEventTime(upcomingEvents[0].start_time)}` : 'all caught up', accent: 'amber' as const },
    { id: 'shortlists', label: 'Shortlists', value: stats.shortlisted, sub: 'matched in Excel files', accent: 'violet' as const },
    { id: 'offers', label: 'Offers Received', value: stats.selected, sub: stats.selected > 0 ? 'congratulations 🎉' : 'radar tracking', accent: 'emerald' as const },
  ];

  return (
    <div data-testid="dashboard-page" className="mx-auto max-w-7xl space-y-5 sm:space-y-6 w-full min-w-0">
      {/* Onboarding Alert Banner if missing requirements */}
      {(!hasCollegeAccount || !hasNeoId) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-3.5 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-zinc-200">
                {!hasCollegeAccount ? 'Link your College Gmail to unlock test circulars' : 'Add your Registration ID'}
              </h4>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
                {!hasCollegeAccount
                  ? 'Connect your @vitstudent.ac.in account in Settings so the engine can parse shortlists and test links.'
                  : "Add your roll number in Settings so Where's My Offer? can match your name in shortlist Excel files."}
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors whitespace-nowrap self-end sm:self-auto"
          >
            Go to Settings →
          </Link>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-zinc-100">
          Placement Pipeline
        </h1>
        <p className="flex flex-wrap items-center gap-1.5 mt-1 text-xs sm:text-sm text-zinc-500">
          <span>Season {new Date().getFullYear()}</span>
          {neoId && (
            <>
              <span>·</span>
              <span className="font-mono text-zinc-400">{neoId}</span>
            </>
          )}
          {campus && (
            <>
              <span>·</span>
              <span className="text-zinc-400">{campus}{branch ? ` (${branch})` : ''}</span>
            </>
          )}
        </p>
      </div>

      {/* Funnel Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {funnelCards.map((f, i) => (
          <motion.div
            key={f.id}
            data-testid={`metric-card-${f.id}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
            className={`rounded-xl border p-3 sm:p-4 min-w-0 ${ACCENTS[f.accent]}`}
          >
            <div className="font-tabular font-display text-2xl sm:text-3xl font-extrabold tracking-tight">{f.value}</div>
            <div className="mt-1 text-[11px] sm:text-xs font-semibold text-zinc-300 truncate">{f.label}</div>
            <div className="mt-0.5 font-mono text-[9px] sm:text-[10px] text-zinc-500 truncate">{f.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Upcoming Strip (Next 24 hrs) */}
      {upcomingEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 sm:px-4 py-2.5 sm:py-3 scrollbar-none max-w-full min-w-0"
          data-testid="upcoming-strip"
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-amber-300">Next 24 hrs</span>
          {upcomingEvents.slice(0, 5).map((e) => (
            <span
              key={e.id}
              className="flex shrink-0 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] text-zinc-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 pulse-dot shrink-0" />
              <span className="truncate max-w-[150px] sm:max-w-none">{e.companyName || 'Company'} — {e.title || e.event_type.replace(/_/g, ' ')}</span>
              <span className="font-tabular font-mono text-amber-300 shrink-0">{formatEventTime(e.start_time)}</span>
            </span>
          ))}
        </motion.div>
      )}

      {/* Section 1: Upcoming Schedule & Assessment Agenda */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <h2 className="font-display text-lg font-bold tracking-tight text-zinc-100">
              Upcoming Assessment Schedule
            </h2>
          </div>
          <Link
            href="/calendar"
            className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-emerald-400 transition-colors"
          >
            Full Calendar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400/80 mb-2" />
            <h3 className="font-display text-sm font-bold text-zinc-200">No imminent assessments in the queue</h3>
            <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
              You are all caught up for upcoming tests. When CDC circulars release new test dates, they appear right here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full min-w-0 max-w-full">
            {upcomingEvents.slice(0, 6).map((ev) => (
              <Link
                key={ev.id}
                href={`/companies/${ev.company_id}`}
                className="group flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#101014] p-4 transition-all duration-200 hover:border-zinc-600 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors truncate">
                      {ev.companyName || 'Company'}
                    </span>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-300">
                      {ev.event_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h4 className="mt-2 text-xs font-semibold text-zinc-300 line-clamp-1">
                    {ev.title || 'Recruitment Assessment'}
                  </h4>
                  <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                    <Clock className="h-3 w-3 text-amber-400" />
                    <span>{formatEventTime(ev.start_time)}</span>
                  </div>
                  {ev.venue && (
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 truncate">
                      <MapPin className="h-3 w-3" />
                      <span>{ev.venue}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-end gap-1 text-[11px] font-semibold text-zinc-500 group-hover:text-emerald-400 transition-colors">
                  View Drive <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Active Pipeline Spotlight */}
      <div className="space-y-3 sm:space-y-4 pt-2 sm:pt-4">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-zinc-100">
              Active Drives Spotlight
            </h2>
          </div>
          <Link
            href="/companies"
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            View all {stats.total_companies} drives <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {spotlightDrives.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 sm:p-8 text-center">
            <p className="font-mono text-xs sm:text-sm text-zinc-500">No active applications in the spotlight right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full min-w-0 max-w-full">
            {spotlightDrives.map((c) => {
              const category = c.category || (/1[0-9]\s*lpa|[2-9][0-9]\s*lpa/i.test(c.ctc || '') ? 'Super Dream' : 'Dream');
              const initials = c.companyName.slice(0, 2).toUpperCase();
              const hue = getHue(c.companyName);

              return (
                <Link
                  key={c.id}
                  href={`/companies/${c.companyId}`}
                  className="group block w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#101014] p-3.5 sm:p-4 transition-all duration-200 hover:border-zinc-600"
                >
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                    <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg border font-display text-xs sm:text-sm font-bold ${hue}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <h3 className="truncate min-w-0 flex-1 font-display text-sm sm:text-base font-bold tracking-tight text-zinc-100 group-hover:text-emerald-300 transition-colors">
                          {c.companyName}
                        </h3>
                        <StatusChip status={c.status} className="shrink-0" />
                      </div>
                      <div className="mt-1 flex items-center gap-2 min-w-0">
                        <span className="truncate text-[11px] sm:text-xs text-zinc-400">{c.role || 'Software Engineering'}</span>
                        <CategoryBadge category={category} className="shrink-0" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] text-zinc-500 min-w-0">
                    <span className="font-tabular font-mono text-xs sm:text-sm font-bold text-zinc-200 shrink-0">
                      {c.ctc || formatStipend(c.stipend) || 'TBA'}
                    </span>
                    <span className="flex items-center gap-1 min-w-0 max-w-[130px] sm:max-w-none truncate shrink-0">
                      <MapPin className="h-3 w-3 shrink-0 text-zinc-500" />
                      <span className="truncate">{c.location || 'Pan-India'}</span>
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-zinc-600 shrink-0 transition-colors duration-200 group-hover:text-emerald-400">
                      Open drive details ↗
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Big CTA banner linking to the full Placement Drives directory */}
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900/80 via-[#101014] to-zinc-900/80 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-display text-sm sm:text-base font-bold text-zinc-100">
              Browse All {stats.total_companies} Campus Placement Drives
            </h4>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
              Filter by Applied, Shortlisted, In Progress, Offers, or search by role and CTC in the Placement Drives directory.
            </p>
          </div>
          <Link
            href="/companies"
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition-colors shrink-0 shadow-lg shadow-emerald-500/10 w-full sm:w-auto text-center"
          >
            <span>Open Placement Drives</span> <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
