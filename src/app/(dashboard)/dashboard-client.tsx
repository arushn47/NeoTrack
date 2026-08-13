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
  hasNeoId: boolean;
  neoId: string | null;
}

const METRIC_CARDS = [
  {
    key: 'total_companies',
    label: 'Total Companies',
    href: '/companies?filter=all',
    icon: Building2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    key: 'active_applications',
    label: 'Active Opportunities',
    href: '/companies?filter=active',
    icon: Briefcase,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  {
    key: 'shortlisted',
    label: 'Shortlisted',
    href: '/companies?filter=shortlisted',
    icon: CheckCircle2,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
  },
  {
    key: 'upcoming_tests',
    label: 'Upcoming Tests',
    href: '/companies?filter=test_scheduled',
    icon: FileCode,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  {
    key: 'upcoming_interviews',
    label: 'Interviews',
    href: '/companies?filter=interview_scheduled',
    icon: MessageSquare,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
  {
    key: 'not_shortlisted',
    label: 'Not Shortlisted',
    href: '/companies?filter=not_shortlisted',
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
] as const;

export default function DashboardClient({
  stats,
  upcomingEvents,
  hasAccounts,
  hasNeoId,
  neoId,
}: DashboardClientProps) {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Onboarding prompts */}
      {(!hasAccounts || !hasNeoId) && (
        <div className="space-y-3">
          {!hasAccounts && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-accent/5 border border-accent/20">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">Connect your Gmail accounts</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Link your personal and VIT Gmail to start syncing placement emails.
                </p>
              </div>
              <Link
                href="/settings"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-all flex-shrink-0"
              >
                Connect
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {!hasNeoId && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <Fingerprint className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">Set your NeoPAT Registration ID</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Enter your ID to automatically match your shortlists in CDC emails.
                </p>
              </div>
              <Link
                href="/settings"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-all flex-shrink-0"
              >
                Set ID
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Neo ID display & Active Breakdown Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-surface p-4 rounded-xl border border-border-default">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-text-primary uppercase tracking-wider text-[11px]">
            Active Pipeline:
          </span>
          <Link href="/companies?filter=applied" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-medium hover:bg-amber-500/20 transition-all">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Applied ({stats.applied})
          </Link>
          <Link href="/companies?filter=shortlisted" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 font-medium hover:bg-cyan-500/20 transition-all">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Shortlisted ({stats.shortlisted})
          </Link>
          <Link href="/companies?filter=test_scheduled" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium hover:bg-emerald-500/20 transition-all">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Upcoming Tests ({stats.upcoming_tests})
          </Link>
          {stats.withdrawn > 0 && (
            <Link href="/companies?filter=withdrawn" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 font-medium hover:bg-zinc-700 transition-all">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              Withdrawn ({stats.withdrawn})
            </Link>
          )}
        </div>

        {neoId && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary self-start sm:self-center">
            <Fingerprint className="w-3.5 h-3.5 text-violet-400" />
            <span>Neo ID:</span>
            <span className="font-mono tracking-wider text-text-secondary font-semibold bg-bg-elevated px-2 py-0.5 rounded border border-border-default">
              {neoId}
            </span>
          </div>
        )}
      </div>

      {/* Stats cards (Clickable) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger-children">
        {METRIC_CARDS.map((card) => {
          const value = stats[card.key as keyof DashboardStats];
          return (
            <Link
              key={card.key}
              href={card.href}
              className="p-4 rounded-xl bg-bg-surface border border-border-default hover:border-accent/40 hover:bg-bg-surface-hover transition-all group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/5 block"
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform', card.bgColor)}>
                <card.icon className={cn('w-4 h-4', card.color)} />
              </div>
              <p className="text-2xl font-bold text-text-primary animate-count-up">
                {value}
              </p>
              <div className="flex items-center justify-between text-xs text-text-secondary mt-0.5">
                <span>{card.label}</span>
                <ChevronRight className="w-3 h-3 text-text-tertiary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Upcoming events */}
      <div className="rounded-xl bg-bg-surface border border-border-default overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-secondary" />
            Upcoming Events
          </h2>
          {upcomingEvents.length > 0 && (
            <Link href="/calendar" className="text-xs text-accent hover:text-accent-hover transition-colors">
              View all →
            </Link>
          )}
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No upcoming events</p>
            <p className="text-xs text-text-tertiary mt-1">
              {hasAccounts ? 'Sync your emails to discover events.' : 'Connect Gmail to get started.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {upcomingEvents.map((event) => {
              const eventColors = EVENT_TYPE_COLORS[event.event_type as EventType] || EVENT_TYPE_COLORS.other;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-surface-hover transition-all"
                >
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', eventColors.dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {event.title || EVENT_TYPE_LABELS[event.event_type as EventType] || event.event_type}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {event.venue && <span>{event.venue} · </span>}
                      {event.mode && event.mode !== 'unknown' && (
                        <span className="capitalize">{event.mode} · </span>
                      )}
                      <span className={cn(eventColors.text)}>
                        {EVENT_TYPE_LABELS[event.event_type as EventType]}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right flex-shrink-0">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {event.start_time ? formatDateTime(event.start_time) : '—'}
                      </p>
                    </div>
                    {event.start_time && (
                      <a
                        href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title || 'Placement Event')}&dates=${new Date(event.start_time).toISOString().replace(/-|:|\.\d+/g, '')}/${new Date(new Date(event.start_time).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '')}&location=${encodeURIComponent(event.venue || 'VIT Campus / Online')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/10 transition-all"
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
        <div className="flex items-center gap-6 text-xs text-text-tertiary">
          {stats.selected > 0 && (
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-green-400" />
              {stats.selected} Selected
            </span>
          )}
          {stats.withdrawn > 0 && (
            <span className="flex items-center gap-1.5">
              <WithdrawIcon className="w-3.5 h-3.5 text-gray-400" />
              {stats.withdrawn} Withdrawn
            </span>
          )}
        </div>
      )}
    </div>
  );
}
