'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Search,
  Clock,
  MapPin,
  Building2,
  ArrowUpRight,
  ChevronDown,
  Check,
  ArrowUpDown,
  X,
  Tag,
  Zap,
} from 'lucide-react';
import { cn, timeAgo, formatStipend } from '@/lib/utils';
import { StatusChip, CategoryBadge } from '@/components/ui/status-chip';

export interface CompanyWithDetails {
  id: string;
  name: string;
  legal_name: string | null;
  aliases: string[] | null;
  updated_at: string;
  latestEmailDate?: string;
  application: {
    id: string;
    status: string;
    role: string | null;
    category?: string | null;
    ctc: string | null;
    stipend: string | null;
    location: string | null;
    notes?: string | null;
    manual_override: boolean;
    applied_at: string | null;
    last_updated: string;
  } | null;
  latestEvent: {
    id: string;
    event_type: string;
    title: string | null;
    start_time: string | null;
    venue: string | null;
    mode: string | null;
  } | null;
  events?: Array<{
    id: string;
    event_type: string;
    title: string;
    start_time: string | null;
    venue?: string | null;
    mode?: string | null;
  }>;
  neoIdMatched: boolean;
  emailCount: number;
}

interface CompaniesClientProps {
  companies: CompanyWithDetails[];
}

const FILTERS = [
  { id: 'active', label: 'Active' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'not_shortlisted', label: 'Not Shortlisted' },
  { id: 'withdrawn', label: 'Withdrawn' },
  { id: 'all', label: 'All' },
];

const matchFilter = (status: string, filter: string) => {
  const s = status.toLowerCase();
  if (filter === 'all') return true;
  if (filter === 'active') {
    return ['applied', 'shortlisted', 'test', 'interview', 'offer', 'offer_received', 'selected'].includes(s);
  }
  if (filter === 'shortlisted') return s === 'shortlisted';
  if (filter === 'scheduled') {
    return ['test_scheduled', 'interview_scheduled', 'ppt_scheduled', 'ppt'].includes(s);
  }
  if (filter === 'not_shortlisted') return ['rejected', 'not_shortlisted'].includes(s);
  if (filter === 'withdrawn') return ['withdrawn', 'declined', 'not_applied'].includes(s);
  return true;
};

const NEXT_EVENT_CLS: Record<string, string> = {
  online_test: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-300',
  coding_test: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-300',
  technical_interview: 'border-cyan-500/30 bg-cyan-500/[0.07] text-cyan-300',
  hr_interview: 'border-cyan-500/30 bg-cyan-500/[0.07] text-cyan-300',
  interview: 'border-cyan-500/30 bg-cyan-500/[0.07] text-cyan-300',
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

export default function CompaniesClient({ companies }: CompaniesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [filter, setFilter] = useState('active');

  const filteredCompanies = useMemo(() => {
    return companies
      .filter((c) => matchFilter(c.application?.status || 'applied', filter))
      .filter((c) => {
        if (!q.trim()) return true;
        const haystack = `${c.name} ${c.application?.role || ''} ${c.application?.ctc || ''} ${c.application?.location || ''}`.toLowerCase();
        return haystack.includes(q.toLowerCase().trim());
      });
  }, [companies, filter, q]);

  return (
    <div data-testid="companies-page" className="mx-auto max-w-7xl w-full min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-zinc-100">
              Placement Drives
            </h1>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
              {companies.length}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500">
            Track and monitor all campus hiring opportunities synced from CDC and official circulars.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            data-testid="companies-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search drives, roles, CTCs…"
            className="h-9 sm:h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pl-9 pr-8 text-xs sm:text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-emerald-500/40 focus:outline-none"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="mt-4 sm:mt-6 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full min-w-0" data-testid="filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            data-testid={`filter-chip-${f.id}`}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-semibold transition-colors duration-200 ${
              filter === f.id
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto hidden shrink-0 font-mono text-[10px] text-zinc-600 sm:block">
          {filteredCompanies.length} / {companies.length} drives
        </span>
      </div>

      {/* 2-Column Company Cards Grid (Emergent Style) */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3 w-full min-w-0 max-w-full">
        {filteredCompanies.map((c, i) => {
          const status = c.application?.status || 'applied';
          const role = c.application?.role || 'Campus Placement Drive';
          const category = c.application?.category || (/1[0-9]\s*lpa|[2-9][0-9]\s*lpa/i.test(c.application?.ctc || '') ? 'Super Dream' : 'Dream');
          const initials = c.name.slice(0, 2).toUpperCase();
          const hue = getHue(c.name);
          const nextEv = c.latestEvent;

          // Mode & Travel display
          const notesStr = (c.application?.notes || '').toLowerCase();
          const driveMode =
            notesStr.includes('vellore')
              ? 'VIT Vellore'
              : notesStr.includes('chennai')
              ? 'VIT Chennai'
              : notesStr.includes('bhopal')
              ? 'Bhopal Labs'
              : notesStr.includes('online')
              ? 'Online'
              : 'On-Campus';

          const stipendFormatted = formatStipend(c.application?.stipend);
          const ctcDisplay = c.application?.ctc
            ? c.application.ctc.replace(/\*/g, '').trim()
            : stipendFormatted || 'TBA';

          return (
            <motion.div
              key={c.id}
              data-testid={`company-card-${c.id}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.4) }}
              whileHover={{ y: -3 }}
              className="w-full min-w-0 max-w-full"
            >
              <Link
                href={`/companies/${c.id}`}
                className={`group block w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#101014] p-3.5 sm:p-4 text-left transition-colors duration-200 hover:border-zinc-600 ${
                  status === 'selected' || status === 'offer'
                    ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.08)]'
                    : ''
                }`}
              >
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                  <div
                    className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg border font-display text-xs sm:text-sm font-bold ${hue}`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <h3 className="truncate min-w-0 flex-1 font-display text-sm sm:text-base font-bold tracking-tight text-zinc-100 group-hover:text-emerald-300 transition-colors">
                        {c.name}
                      </h3>
                      <StatusChip status={status} className="shrink-0" />
                    </div>
                    <div className="mt-1 flex items-center gap-2 min-w-0">
                      <span className="truncate text-xs text-zinc-400">{role}</span>
                      <CategoryBadge category={category} className="shrink-0" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] text-zinc-500 min-w-0">
                  <span className="font-tabular font-mono text-xs sm:text-sm font-bold text-zinc-200 shrink-0">
                    {ctcDisplay}
                  </span>
                  <span className="flex items-center gap-1 min-w-0 max-w-[130px] sm:max-w-none truncate shrink-0">
                    <MapPin className="h-3 w-3 shrink-0 text-zinc-500" />
                    <span className="truncate">{c.application?.location || 'Pan-India'}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <Building2 className="h-3 w-3 shrink-0 text-zinc-500" />
                    <span>{driveMode}</span>
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-zinc-600 shrink-0">
                    {c.application?.last_updated ? timeAgo(c.application.last_updated) : 'Active'}
                  </span>
                </div>

                {nextEv && (
                  <div
                    className={`mt-2.5 flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 sm:py-2 text-[11px] font-medium min-w-0 overflow-hidden ${
                      NEXT_EVENT_CLS[nextEv.event_type] || NEXT_EVENT_CLS.test
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0 truncate">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{nextEv.title || nextEv.event_type.replace(/_/g, ' ')}</span>
                    </span>
                    <span className="font-tabular font-mono shrink-0">{formatEventTime(nextEv.start_time)}</span>
                  </div>
                )}

                <div className="mt-2.5 flex items-center justify-end gap-1 text-[11px] font-semibold text-zinc-600 transition-colors group-hover:text-emerald-400">
                  <span>Open timeline</span> <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {filteredCompanies.length === 0 && (
        <div data-testid="empty-state" className="mt-16 text-center">
          <p className="font-mono text-sm text-zinc-500">No drives match this filter.</p>
        </div>
      )}
    </div>
  );
}
