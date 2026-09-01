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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/constants/event-types';
import type { DashboardStats, UpcomingEvent } from '@/types';
import type { EventType } from '@/constants/event-types';
import Link from 'next/link';

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
}

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
  hasPersonalAccount = false,
  hasCollegeAccount = false,
  disconnectedAccounts,
  hasNeoId,
  neoId,
}: DashboardClientProps) {
  const isSetupIncomplete = !hasPersonalAccount || !hasCollegeAccount || !hasNeoId;

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

      {/* 3-Step Placement Setup Onboarding Checklist */}
      {isSetupIncomplete && (
        <div className="rounded-3xl bg-[#101018]/90 border border-indigo-500/30 p-5 sm:p-6 backdrop-blur-2xl shadow-xl shadow-indigo-950/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Complete Placement Setup (3 Prerequisites)
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                To guarantee zero noise and 100% accurate shortlist matching, NeoTrack starts syncing only after all 3 items are connected.
              </p>
            </div>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 self-start sm:self-center"
            >
              Complete Setup in Settings
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Step 1: Personal Gmail */}
            <div className={cn(
              'p-3.5 rounded-2xl border transition-all flex items-start gap-3',
              hasPersonalAccount
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
            )}>
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                hasPersonalAccount ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
              )}>
                {hasPersonalAccount ? '✓' : '1'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">Personal Gmail</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Where official NeoPAT invites arrive (`noreply.cdcinfo`)</p>
              </div>
            </div>

            {/* Step 2: College Gmail */}
            <div className={cn(
              'p-3.5 rounded-2xl border transition-all flex items-start gap-3',
              hasCollegeAccount
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
            )}>
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                hasCollegeAccount ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
              )}>
                {hasCollegeAccount ? '✓' : '2'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">College Gmail (VIT)</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Where CTC, stipend, JDs & shortlists arrive</p>
              </div>
            </div>

            {/* Step 3: NeoPAT ID */}
            <div className={cn(
              'p-3.5 rounded-2xl border transition-all flex items-start gap-3',
              hasNeoId
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
            )}>
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                hasNeoId ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
              )}>
                {hasNeoId ? '✓' : '3'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">NeoPAT ID</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {hasNeoId ? `Configured: ${neoId}` : 'Required for Excel candidate matching'}
                </p>
              </div>
            </div>
          </div>
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

      {/* Upcoming Placement Schedule Card */}
      <div className="rounded-3xl bg-[#101018]/95 backdrop-blur-2xl border border-zinc-800/80 overflow-hidden shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800/80 bg-zinc-950/40">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-sm shadow-indigo-500/10">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Upcoming Schedule
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  {upcomingEvents.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 truncate sm:whitespace-normal">
                Next tests, interviews & PPTs from CDC circulars
              </p>
            </div>
          </div>

          <Link
            href="/calendar"
            className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-all bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-xl border border-indigo-500/20 flex-shrink-0"
          >
            <span className="hidden sm:inline">View Calendar</span>
            <span className="sm:hidden">Calendar</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-5 sm:p-6">
          {upcomingEvents.length === 0 ? (
            <div className="py-12 text-center">
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
                const cleanVenue = event.venue ? event.venue.replace(/[\r\n]+/g, ' ').trim() : null;
                const formattedDate = event.start_time ? formatDateTime(event.start_time) : '—';

                return (
                  <div
                    key={event.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 hover:bg-zinc-900/40 transition-all group rounded-xl px-2.5"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5', eventColors.dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                            {event.title || EVENT_TYPE_LABELS[event.event_type as EventType] || event.event_type}
                          </p>
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10', eventColors.bg, eventColors.text)}>
                            {EVENT_TYPE_LABELS[event.event_type as EventType]}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 mt-1">
                          {cleanVenue && (
                            <span className="truncate max-w-[220px] sm:max-w-xs">{cleanVenue}</span>
                          )}
                          {cleanVenue && event.mode && event.mode !== 'unknown' && <span>·</span>}
                          {event.mode && event.mode !== 'unknown' && (
                            <span className="capitalize">{event.mode}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-5 sm:pl-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-800/40 sm:border-transparent flex-shrink-0">
                      <p className="text-xs font-semibold text-zinc-200">
                        {formattedDate}
                      </p>
                      {event.start_time && (
                        <a
                          href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title || 'Placement Event')}&dates=${new Date(event.start_time).toISOString().replace(/-|:|\.\d+/g, '')}/${new Date(new Date(event.start_time).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '')}&location=${encodeURIComponent(cleanVenue || 'VIT Campus / Online')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-zinc-800 sm:border-transparent hover:border-indigo-500/20 transition-all"
                          title="Add to Google Calendar"
                          aria-label="Add to Google Calendar"
                        >
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
