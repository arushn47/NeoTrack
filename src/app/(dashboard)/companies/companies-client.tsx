'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Calendar,
  IndianRupee,
  MapPin,
  Tag,
  ArrowUpDown,
} from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/shared/status-badge';
import StageProgressBar from '@/components/companies/stage-progress-bar';

export interface CompanyWithDetails {
  id: string;
  name: string;
  legal_name: string | null;
  aliases: string[] | null;
  updated_at: string;
  application: {
    id: string;
    status: string;
    role: string | null;
    ctc: string | null;
    stipend: string | null;
    location: string | null;
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
  }>;
  neoIdMatched: boolean;
  emailCount: number;
}

interface CompaniesClientProps {
  companies: CompanyWithDetails[];
}

const STATUS_FILTERS = [
  { id: 'active', label: 'In Progress' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'applied', label: 'Applied' },
  { id: 'not_applied', label: 'Not Registered' },
  { id: 'not_shortlisted', label: 'Not Shortlisted' },
  { id: 'selected', label: 'Selected 🎉' },
  { id: 'withdrawn', label: 'Opted Out' },
  { id: 'all', label: 'All Companies' },
];

const SORT_OPTIONS = [
  { id: 'recent', label: 'Recent' },
  { id: 'name', label: 'Name A-Z' },
  { id: 'status', label: 'Status' },
  { id: 'ctc', label: 'CTC ↓' },
] as const;

type SortMode = typeof SORT_OPTIONS[number]['id'];

// Parse CTC string to a comparable number (e.g. "12 LPA" → 12, "8.5 LPA" → 8.5)
function parseCTC(ctc: string | null | undefined): number {
  if (!ctc) return 0;
  const match = ctc.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
}

// Status priority for sorting (higher = more progressed)
const SORT_STATUS_PRIORITY: Record<string, number> = {
  selected: 10, offer_received: 9, interview_scheduled: 8,
  test_scheduled: 7, shortlisted: 6, ppt_scheduled: 5,
  applied: 4, not_applied: 3, unknown: 2,
  not_shortlisted: 1, rejected: 1, withdrawn: 0, declined: 0,
};

function cleanRoleDisplay(rawRole: string | null | undefined, rawCtc?: string | null): string {
  if (rawRole) {
    const r = rawRole.replace(/<[^>]+>/g, ' ').replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim();
    if (
      r &&
      r.length >= 2 &&
      r !== 'Placement Drive' &&
      !/\byou\s*(?:are|have|re)\b|\byou\b|dear\s|greetings|hi\s+|upcoming|forwarded|scheduled|not japanese|eligible|please|kindly|hereby|inform|congratulat|registr|passout|batch|drive|details below|profile 1|profile 2|applied candidates|^[>,\.\*\s]+$/i.test(r)
    ) {
      return r;
    }
  }

  if (rawCtc) {
    const match = rawCtc.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const ctcVal = parseFloat(match[1]);
      if (ctcVal >= 10) return 'Super Dream Drive';
      if (ctcVal >= 6) return 'Dream Drive';
      if (ctcVal < 6) return 'Regular Drive';
    }
  }

  return 'Placement Drive';
}

function cleanCtcDisplay(rawCtc: string | null | undefined): string | null {
  if (!rawCtc) return null;
  const c = rawCtc.replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim();
  if (!c || c.length < 2 || /^[>,\.\*\s]+$/.test(c)) return null;
  return c;
}

function cleanLocationDisplay(rawLoc: string | null | undefined): string | null {
  if (!rawLoc) return null;
  let l = rawLoc.replace(/<[^>]+>/g, ' ').replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim();
  l = l.replace(/\s+job$/i, '').replace(/\s+position:.*$/i, '').trim();
  if (
    !l ||
    l.length < 2 ||
    /please find|mail with|nonsense|come at|assistance|applicable|candidate|round\s+\d+|results|lab|service agreement|forwarded message|scheduled on|online test|@|own location|pearl research|anna auditorium|find the below|candidates list|^[>,\.\*\s]+$/i.test(l)
  ) {
    return null;
  }
  return l;
}

export default function CompaniesClient({ companies }: CompaniesClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialFilter = searchParams.get('filter') || searchParams.get('status') || 'active';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState(initialFilter);
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  useEffect(() => {
    const urlFilter = searchParams.get('filter') || searchParams.get('status');
    if (urlFilter && urlFilter !== selectedFilter) {
      setSelectedFilter(urlFilter);
    }
  }, [searchParams]);

  const handleFilterChange = (filterId: string) => {
    setSelectedFilter(filterId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('filter', filterId);
    params.delete('status');
    router.replace(`/companies?${params.toString()}`, { scroll: false });
  };

  const filteredCompanies = useMemo(() => {
    const filtered = companies.filter((c) => {
      // Search filter
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.application?.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.application?.ctc?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Status filter
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'active') {
        // "In Progress" = applied, shortlisted, ppt_scheduled, test_scheduled, interview_scheduled, offer_received
        const s = c.application?.status || 'not_applied';
        return !['not_applied', 'withdrawn', 'declined', 'not_shortlisted', 'rejected', 'selected'].includes(s);
      }
      if (selectedFilter === 'not_applied') {
        const s = c.application?.status;
        return !s || s === 'not_applied';
      }
      if (selectedFilter === 'withdrawn') {
        const s = c.application?.status || '';
        return s === 'withdrawn' || s === 'declined';
      }
      return (c.application?.status || 'not_applied') === selectedFilter;
    });

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status': {
          const aPri = SORT_STATUS_PRIORITY[a.application?.status || 'unknown'] ?? 2;
          const bPri = SORT_STATUS_PRIORITY[b.application?.status || 'unknown'] ?? 2;
          return bPri - aPri; // Higher priority first
        }
        case 'ctc':
          return parseCTC(b.application?.ctc) - parseCTC(a.application?.ctc);
        case 'recent':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
  }, [companies, searchQuery, selectedFilter, sortMode]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Companies ({companies.length})
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Tracked placement drives from your synced emails and college announcements.
          </p>
        </div>

        {/* Search bar + Sort */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search company or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-default rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-all"
            />
          </div>

          {/* Sort selector */}
          <div className="relative">
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="appearance-none pl-8 pr-3 py-2 bg-bg-surface border border-border-default rounded-xl text-xs font-medium text-text-secondary hover:text-text-primary focus:outline-none focus:border-accent transition-all cursor-pointer"
              aria-label="Sort companies"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Filter Tabs with Counts */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {STATUS_FILTERS.map((filter) => {
          let count = 0;
          if (filter.id === 'all') {
            count = companies.length;
          } else if (filter.id === 'active') {
            count = companies.filter(
              (c) => !['not_applied', 'withdrawn', 'declined', 'not_shortlisted', 'rejected', 'selected'].includes(c.application?.status || 'not_applied')
            ).length;
          } else if (filter.id === 'not_applied') {
            count = companies.filter((c) => !c.application?.status || c.application.status === 'not_applied').length;
          } else if (filter.id === 'withdrawn') {
            count = companies.filter((c) => ['withdrawn', 'declined'].includes(c.application?.status || '')).length;
          } else {
            count = companies.filter((c) => (c.application?.status || 'not_applied') === filter.id).length;
          }

          const isActive = selectedFilter === filter.id;

          return (
            <button
              key={filter.id}
              onClick={() => handleFilterChange(filter.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5',
                isActive
                  ? 'bg-accent text-white shadow-sm shadow-accent/20'
                  : 'bg-bg-surface hover:bg-bg-surface-hover text-text-secondary hover:text-text-primary border border-border-default'
              )}
            >
              <span>{filter.label}</span>
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                  isActive ? 'bg-white/20 text-white' : 'bg-bg-elevated text-text-tertiary'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Company Cards Grid */}
      {filteredCompanies.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-bg-surface border border-border-default rounded-2xl">
          <Building2 className="w-12 h-12 text-text-tertiary mb-3 opacity-50" />
          <p className="text-text-primary font-semibold text-base">No companies found</p>
          <p className="text-text-tertiary text-sm max-w-md mt-1">
            {searchQuery
              ? `No companies matching "${searchQuery}" under filter "${selectedFilter}".`
              : 'Sync your personal Gmail to discover placement drives.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompanies.map((c) => {
            const status = c.application?.status || 'applied';
            const role = cleanRoleDisplay(c.application?.role, c.application?.ctc);
            const ctc = cleanCtcDisplay(c.application?.ctc);
            const location = cleanLocationDisplay(c.application?.location);
            const nextEvent = c.latestEvent;

            return (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="group relative flex flex-col justify-between p-5 bg-bg-surface border border-border-default hover:border-accent/40 rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5"
              >
                <div>
                  {/* Top Row: Icon, Name, Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center font-bold text-accent text-base group-hover:scale-105 transition-transform flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-text-primary text-base group-hover:text-accent transition-colors flex items-center gap-1.5 truncate">
                          <span className="truncate">{c.name}</span>
                          {c.neoIdMatched && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent border border-accent/30 flex-shrink-0" title="Neo ID Matched in Shortlist">
                              <Sparkles className="w-2.5 h-2.5" />
                              Shortlisted
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-text-tertiary truncate">
                          {role}
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={status} events={c.events} />
                  </div>

                  {/* CTC & Location Badges */}
                  {(ctc || location) && (
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {ctc && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <IndianRupee className="w-3 h-3" />
                          {ctc}
                        </span>
                      )}
                      {location && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-secondary bg-bg-surface-hover border border-border-default">
                          <MapPin className="w-3 h-3 text-text-tertiary" />
                          {location}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Hiring Pipeline Stage Flow */}
                  <StageProgressBar
                    status={status}
                    events={c.events}
                    className="my-3 bg-bg-elevated/40 p-2.5 rounded-xl border border-border-default/50"
                  />
                </div>

                {/* Bottom Info Row */}
                <div className="pt-3 border-t border-border-default/60 flex items-center justify-between text-xs text-text-tertiary mt-2">
                  {nextEvent ? (
                    <div className="flex items-center gap-1.5 text-accent font-medium truncate">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{nextEvent.title || nextEvent.event_type}</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {c.application?.applied_at ? timeAgo(c.application.applied_at) : 'Tracked'}
                    </span>
                  )}

                  <span className="flex items-center gap-1 font-medium group-hover:text-text-primary transition-colors">
                    Details
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
