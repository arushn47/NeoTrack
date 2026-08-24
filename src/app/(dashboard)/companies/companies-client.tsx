'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
  ChevronDown,
  Check,
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
  { id: 'rejected', label: 'Rejected' },
  { id: 'selected', label: 'Selected 🎉' },
  { id: 'withdrawn', label: 'Opted Out' },
  { id: 'all', label: 'All Drives' },
];

const SORT_OPTIONS = [
  { id: 'recent', label: 'Recently Active' },
  { id: 'name', label: 'Name (A-Z)' },
  { id: 'status', label: 'Stage Progress' },
  { id: 'ctc', label: 'Highest CTC' },
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>(
    searchParams.get('filter') || 'all'
  );
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Sync state if URL query param changes
  useEffect(() => {
    const f = searchParams.get('filter');
    if (f) {
      setSelectedFilter(f);
    }
  }, [searchParams]);

  // Click outside to close sort dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFilterChange = (filterId: string) => {
    setSelectedFilter(filterId);
    const params = new URLSearchParams(searchParams.toString());
    if (filterId === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', filterId);
    }
    router.replace(`/companies?${params.toString()}`, { scroll: false });
  };

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    const filtered = companies.filter((c) => {
      // Text search
      if (query) {
        const nameMatch = c.name.toLowerCase().includes(query);
        const roleMatch = c.application?.role?.toLowerCase().includes(query);
        const locationMatch = c.application?.location?.toLowerCase().includes(query);
        const aliasesMatch = c.aliases?.some((a) => a.toLowerCase().includes(query));
        if (!nameMatch && !roleMatch && !locationMatch && !aliasesMatch) {
          return false;
        }
      }

      // Status filter
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'active') {
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
      if (selectedFilter === 'shortlisted') {
        return c.application?.status === 'shortlisted' || c.neoIdMatched;
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
          return bPri - aPri;
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
    <div className="space-y-6 animate-fade-in selection:bg-indigo-500/20 max-w-7xl mx-auto">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-indigo-400" />
            <span>Placement Drives</span>
            <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
              {companies.length}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Track and monitor all campus hiring opportunities synced from CDC and official circulars.
          </p>
        </div>

        {/* Search bar + Sort */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search company, role, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#101018] border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          {/* Custom Sort selector */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen((prev) => !prev)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 bg-[#101018] hover:bg-[#141422] border rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm',
                isSortOpen
                  ? 'border-indigo-500 text-white ring-2 ring-indigo-500/20'
                  : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
              )}
              aria-label="Sort companies"
              aria-expanded={isSortOpen}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
              <span>{SORT_OPTIONS.find((opt) => opt.id === sortMode)?.label}</span>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-zinc-500 transition-transform duration-200',
                  isSortOpen && 'rotate-180 text-indigo-400'
                )}
              />
            </button>

            {isSortOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 p-1.5 bg-[#12121c]/95 backdrop-blur-2xl border border-zinc-800 rounded-2xl shadow-2xl z-50 animate-fade-in divide-y divide-zinc-800/60">
                <div className="space-y-0.5 pb-1">
                  {SORT_OPTIONS.map((opt) => {
                    const isSelected = opt.id === sortMode;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortMode(opt.id);
                          setIsSortOpen(false);
                        }}
                        className={cn(
                          'w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all text-left',
                          isSelected
                            ? 'bg-indigo-500/15 text-indigo-300 font-bold'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                        )}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs with Counts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
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
          } else if (filter.id === 'shortlisted') {
            count = companies.filter((c) => (c.application?.status === 'shortlisted') || c.neoIdMatched).length;
          } else {
            count = companies.filter((c) => (c.application?.status || 'not_applied') === filter.id).length;
          }

          const isActive = selectedFilter === filter.id;

          return (
            <button
              key={filter.id}
              onClick={() => handleFilterChange(filter.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 select-none active:scale-95',
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-[#101018] hover:bg-[#141420] text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              )}
            >
              <span>{filter.label}</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold',
                  isActive ? 'bg-white/20 text-white' : 'bg-zinc-850 text-zinc-500'
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
        <div className="flex flex-col items-center justify-center p-14 text-center bg-[#101018]/90 border border-zinc-800/80 rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-600">
            <Building2 className="w-6 h-6" />
          </div>
          <p className="text-zinc-200 font-bold text-base">No companies match this filter</p>
          <p className="text-zinc-500 text-xs max-w-sm mt-1">
            {searchQuery
              ? `No companies found for "${searchQuery}" under the "${selectedFilter}" category.`
              : 'Sync your Gmail to automatically discover and track new company circulars.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
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
                className="group relative flex flex-col justify-between p-5 bg-[#101018]/90 backdrop-blur-xl border border-zinc-800/80 hover:border-indigo-500/40 rounded-2xl transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 block select-none"
              >
                <div>
                  {/* Top Row: Icon, Name, Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-base group-hover:scale-110 transition-transform flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition-colors flex items-center gap-1.5 truncate">
                          <span className="truncate">{c.name}</span>
                        </h3>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          <IndianRupee className="w-3 h-3" />
                          {ctc}
                        </span>
                      )}
                      {location && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-zinc-300 bg-zinc-900 border border-zinc-800">
                          <MapPin className="w-3 h-3 text-zinc-500" />
                          {location}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stage Progress Bar */}
                  <StageProgressBar
                    status={status}
                    events={c.events}
                    className="my-3 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80"
                  />
                </div>

                {/* Bottom Info Row */}
                <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500 mt-2">
                  {nextEvent ? (
                    <div className="flex items-center gap-1.5 text-indigo-400 font-semibold truncate">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{nextEvent.title || nextEvent.event_type}</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {c.application?.applied_at ? timeAgo(c.application.applied_at) : 'Active'}
                    </span>
                  )}

                  <span className="flex items-center gap-1 font-semibold text-zinc-400 group-hover:text-white transition-colors">
                    View Details
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-zinc-500 group-hover:text-indigo-400" />
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
