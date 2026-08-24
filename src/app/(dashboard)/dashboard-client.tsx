'use client';

import {
  Building2,
  Briefcase,
  CheckCircle2,
  FileCode,
  MessageSquare,
  XCircle,
  LogOut as WithdrawIcon,
  Award,
  Clock,
  Mail,
  ArrowRight,
  Fingerprint,
  Calendar,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/constants/event-types';
import type { DashboardStats, UpcomingEvent } from '@/types';
import type { EventType } from '@/constants/event-types';
import Link from 'next/link';

interface DashboardClientProps {
  stats: DashboardStats;
  upcomingEvents: Array<{
    id: string;
    company_id: string;
    event_type: string;
    title: string | null;
    start_time: string | null;
    end_time: string | null;
    venue: string | null;
    mode: string | null;
  }>;
  hasAccounts: boolean;
  disconnectedAccounts?: Array<{
    id: string;
    email: string;
    account_type: string;
  }>;
  hasNeoId: boolean;
  neoId: string | null;
}

const METRIC_CARDS = [
  {
    key: 'total_companies',
    label: 'Total Drives',
    href: '/companies?filter=all',
    icon: Building2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    glowColor: 'group-hover:border-blue-500/40 group-hover:shadow-blue-500/10',
  },
  {
    key: 'active_applications',
    label: 'Active Pipeline',
    href: '/companies?filter=active',
    icon: Briefcase,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    glowColor: 'group-hover:border-emerald-500/40 group-hover:shadow-emerald-500/10',
  },
  {
    key: 'shortlisted',
    label: 'Shortlisted',
    href: '/companies?filter=shortlisted',
    icon: CheckCircle2,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 border-cyan-500/20',
    glowColor: 'group-hover:border-cyan-500/40 group-hover:shadow-cyan-500/10',
  },
  {
    key: 'upcoming_tests',
    label: 'Online Tests',
    href: '/companies?filter=test_scheduled',
    icon: FileCode,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
    glowColor: 'group-hover:border-amber-500/40 group-hover:shadow-amber-500/10',
  },
  {
    key: 'upcoming_interviews',
    label: 'Interviews',
    href: '/companies?filter=interview_scheduled',
    icon: MessageSquare,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
    glowColor: 'group-hover:border-purple-500/40 group-hover:shadow-purple-500/10',
  },
  {
    key: 'not_shortlisted',
    label: 'Not Shortlisted',
    href: '/companies?filter=not_shortlisted',
    icon: XCircle,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10 border-rose-500/20',
    glowColor: 'group-hover:border-rose-500/40 group-hover:shadow-rose-500/10',
  },
] as const;

export default function DashboardClient({
  stats,
  upcomingEvents,
  hasAccounts,
  disconnectedAccounts,
  hasNeoId,
  neoId,
}: DashboardClientProps) {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in selection:bg-indigo-500/20">
      
      {/* Disconnected Accounts Alert Banner */}
      {disconnectedAccounts && disconnectedAccounts.length > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 backdrop-blur-xl shadow-lg shadow-amber-950/20">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-200">
              Action Required: {disconnectedAccounts.map(a => a.account_type === 'college' ? 'College (VIT)' : 'Personal').join(' & ')} Gmail Disconnected
            </p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              Your session expired for {disconnectedAccounts.map(a => a.email).join(', ')}. Placement email sync is paused.
            </p>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-semibold transition-all flex-shrink-0"
          >
            Reconnect Now
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Onboarding prompts */}
      {(!hasAccounts || !hasNeoId) && (
        <div className="space-y-3">
          {!hasAccounts && (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 backdrop-blur-xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Connect your Gmail accounts</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Link your personal and VIT Gmail to start syncing placement emails.
                </p>
              </div>
              <Link
                href="/settings"
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all flex-shrink-0 shadow-md shadow-indigo-600/25"
              >
                Connect
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {!hasNeoId && (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-violet-500/10 border border-violet-500/25 backdrop-blur-xl">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Fingerprint className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Set your NeoPAT Registration ID</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Enter your ID to automatically match your shortlists in CDC emails.
                </p>
              </div>
              <Link
                href="/settings"
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all flex-shrink-0 shadow-md shadow-violet-600/25"
              >
                Set ID
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Active Pipeline Segment Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#101018]/90 backdrop-blur-2xl p-4 sm:p-5 rounded-2xl border border-zinc-800/80 shadow-lg shadow-black/30">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
          <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px] sm:text-[11px] mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Active Pipeline:
          </span>
          <Link href="/companies?filter=applied" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/25 hover:bg-amber-500/20 active:scale-95 transition-all">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Applied ({stats.applied})
          </Link>
          <Link href="/companies?filter=shortlisted" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-300 font-semibold border border-cyan-500/25 hover:bg-cyan-500/20 active:scale-95 transition-all">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Shortlisted ({stats.shortlisted})
          </Link>
          <Link href="/companies?filter=test_scheduled" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/25 hover:bg-emerald-500/20 active:scale-95 transition-all">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Upcoming Tests ({stats.upcoming_tests})
          </Link>
          {stats.withdrawn > 0 && (
            <Link href="/companies?filter=withdrawn" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 text-zinc-400 font-medium border border-zinc-700/50 hover:bg-zinc-800 active:scale-95 transition-all">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              Withdrawn ({stats.withdrawn})
            </Link>
          )}
        </div>

        {neoId && (
          <div className="flex items-center gap-2 text-xs self-start sm:self-center bg-zinc-900/80 px-3.5 py-1.5 rounded-xl border border-zinc-800">
            <Fingerprint className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
            <span className="text-zinc-500 font-medium">Neo ID:</span>
            <span className="font-mono tracking-wider text-zinc-200 font-bold">
              {neoId}
            </span>
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 stagger-children">
        {METRIC_CARDS.map((card) => {
          const value = stats[card.key as keyof DashboardStats];
          return (
            <Link
              key={card.key}
              href={card.href}
              className={cn(
                'p-4 rounded-2xl bg-[#101018]/90 backdrop-blur-xl border border-zinc-800/80 hover:bg-[#141420] active:scale-[0.98] transition-all duration-200 group hover:-translate-y-1 hover:shadow-xl block select-none',
                card.glowColor
              )}
            >
              <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm', card.bgColor)}>
                <card.icon className={cn('w-4 h-4', card.color)} />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight animate-count-up font-mono">
                {value}
              </p>
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-zinc-400 mt-1.5 font-medium">
                <span className="truncate">{card.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Upcoming Events Section */}
      <div className="rounded-2xl bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 overflow-hidden shadow-xl shadow-black/20">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Upcoming Placement Schedule
          </h2>
          {upcomingEvents.length > 0 && (
            <Link href="/calendar" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
              Full Calendar <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-500">
              <Calendar className="w-6 h-6 text-zinc-500" />
            </div>
            <p className="text-sm font-semibold text-zinc-300">No upcoming tests or interviews scheduled</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              {hasAccounts ? 'All upcoming PPTs, assessments, and interview rounds will appear here automatically.' : 'Connect your college Gmail in Settings to extract CDC schedules.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {upcomingEvents.map((event) => {
              const eventColors = EVENT_TYPE_COLORS[event.event_type as EventType] || EVENT_TYPE_COLORS.other;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-800/30 transition-all group"
                >
                  <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', eventColors.dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                      {event.title || EVENT_TYPE_LABELS[event.event_type as EventType] || event.event_type}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                      {event.venue && <span>{event.venue}</span>}
                      {event.venue && <span>·</span>}
                      {event.mode && event.mode !== 'unknown' && (
                        <span className="capitalize">{event.mode} · </span>
                      )}
                      <span className={cn('font-medium', eventColors.text)}>
                        {EVENT_TYPE_LABELS[event.event_type as EventType]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right flex-shrink-0">
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">
                        {event.start_time ? formatDateTime(event.start_time) : '—'}
                      </p>
                    </div>
                    {event.start_time && (
                      <a
                        href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title || 'Placement Event')}&dates=${new Date(event.start_time).toISOString().replace(/-|:|\.\d+/g, '')}/${new Date(new Date(event.start_time).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '')}&location=${encodeURIComponent(event.venue || 'VIT Campus / Online')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
                        title="Add to Google Calendar"
                        aria-label="Add to Google Calendar"
                      >
                        <Calendar className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick stats footer */}
      {stats.total_companies > 0 && (
        <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 px-1">
          <div className="flex items-center gap-6">
            {stats.selected > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Award className="w-4 h-4" />
                {stats.selected} Offers Received
              </span>
            )}
            {stats.withdrawn > 0 && (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <WithdrawIcon className="w-3.5 h-3.5" />
                {stats.withdrawn} Withdrawn
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-zinc-600">NeoTrack Intelligence Engine</span>
        </div>
      )}
    </div>
  );
}
