'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  X,
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
  SlidersHorizontal,
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
  }>;
  neoIdMatched: boolean;
  emailCount: number;
}

interface CompaniesClientProps {
  companies: CompanyWithDetails[];
}

const SHORTLISTED_STAGE_STATUSES = ['shortlisted', 'test_scheduled', 'interview_scheduled'];

const STATUS_FILTERS = [
  { id: 'all', label: 'All Drives', group: 'status' },
  { id: 'active', label: 'In Progress', group: 'status' },
  { id: 'shortlisted', label: 'Shortlisted', group: 'status' },
  { id: 'applied', label: 'Applied', group: 'status' },
  { id: 'not_applied', label: 'Not Registered', group: 'status' },
  { id: 'not_shortlisted', label: 'Not Shortlisted', group: 'status' },
  { id: 'rejected', label: 'Eliminated', group: 'status' },
  { id: 'selected', label: 'Selected 🎉', group: 'status' },
  { id: 'withdrawn', label: 'Opted Out', group: 'status' },
  // Tier filters (derived from CTC)
  { id: 'tier-superdream', label: '⭐ Super Dream', group: 'tier' },
  { id: 'tier-dream', label: '✦ Dream', group: 'tier' },
  { id: 'tier-regular', label: 'Regular', group: 'tier' },
  // Special filters
  { id: 'has-stipend', label: '💰 Internship / Stipend', group: 'special' },
  { id: 'upcoming-test', label: '📅 Upcoming Test', group: 'special' },
];

const SORT_OPTIONS = [
  { id: 'nearest-test', label: 'Nearest Test / Event' },
  { id: 'date-applied-desc', label: 'Date Applied ↓ Newest' },
  { id: 'date-applied', label: 'Date Applied ↑ Oldest' },
  { id: 'recent', label: 'Newest Activity' },
  { id: 'date-asc', label: 'Oldest Activity' },
  { id: 'name', label: 'Name (A–Z)' },
  { id: 'name-za', label: 'Name (Z–A)' },
  { id: 'status', label: 'Stage Progress' },
  { id: 'ctc', label: 'CTC: High → Low' },
  { id: 'ctc-asc', label: 'CTC: Low → High' },
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

function cleanRoleDisplay(rawRole: string | null | undefined, category?: string | null): string {
  if (rawRole) {
    const r = rawRole.replace(/<[^>]+>/g, ' ').replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim();
    if (
      r &&
      r.length >= 2 &&
      r !== 'Placement Drive' &&
      !/\byou\s*(?:are|have|re)\b|\byou\b|dear\s|greetings|hi\s+|upcoming|forwarded|scheduled|not japanese|eligible|please|kindly|hereby|inform|congratulat|registr|passout|batch|drive|for the candidate|reserve a position|expect them|details below|profile 1|profile 2|applied candidates|^[>,\.\*\s]+$/i.test(r) &&
      !/^(?:super\s+dream|dream|regular)(?:\s+(?:internship|offer|placement|drive))?$/i.test(r.trim())
    ) {
      return r;
    }
  }

  return category ? 'Campus Placement Drive' : 'Software Engineering Profile';
}

function getCategoryDisplay(category?: string | null, rawCtc?: string | null): string {
  if (category && category !== 'Placement Drive') {
    return category;
  }
  if (rawCtc) {
    const matches = [...rawCtc.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
    if (matches.length > 0) {
      const maxCtc = Math.max(...matches);
      if (maxCtc >= 10) return 'Super Dream';
      if (maxCtc >= 4.5) return 'Dream';
      return 'Regular';
    }
  }
  return 'Campus Placement Drive';
}

function cleanCtcDisplay(rawCtc: string | null | undefined): string | null {
  if (!rawCtc) return null;
  let c = rawCtc.replace(/<[^>]+>/g, ' ').replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim();
  // Strip redundant leading currency symbol/text since <IndianRupee /> icon is prepended in UI
  c = c.replace(/^(?:₹|rs\.?|inr)\s*/i, '').trim();
  if (!c || c.length < 2 || /^[>,\.\*\s]+$/.test(c)) return null;
  return c;
}

function cleanStipendDisplay(rawStipend: string | null | undefined): string | null {
  if (!rawStipend) return null;
  let s = rawStipend.replace(/<[^>]+>/g, ' ').replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim();
  // Strip redundant leading currency symbol/text since <IndianRupee /> icon is prepended in UI
  s = s.replace(/^(?:₹|rs\.?|inr)\s*/i, '').trim();
  // Strip redundant trailing per-month suffix since "/mo" is appended in UI
  s = s.replace(/\s*(?:\/\-?|\s+)?(?:month|per\s*month|pm|p\.m\.|\/mo|\/m)\s*$/i, '').trim();
  if (!s || s.length < 2 || /^[>,\.\*\s]+$/.test(s)) return null;
  return s;
}

function cleanLocationDisplay(rawLoc: string | null | undefined): string | null {
  if (!rawLoc) return null;
  let l = rawLoc.replace(/<[^>]+>/g, ' ').replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim();

  // Strip anything following common sentence triggers
  l = l.replace(/\s*(?:All\s+the|All\s+interested|Placement\s+Office|On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)|Students\s+with|Registered\s+students|Registration|Note|Eligibility|Skills|Service|Work\s+Mode|Joining|Economy|Round\s+Trip|Depending\s+on|Below\s+attachment|Job\s+Description|JD|You\s+can|Write\s+from|Forwarded|Queries|LC\s*\d|PRP|SJT|Anna|Lab|Hall|Venue|---).*$/i, '');

  // Strip non-location junk prefixes/words
  l = l.replace(/\b(?:internship|placement|drive|hiring|offer|job|role|any\s+honeywell\s+site)\b/gi, '');
  l = l.replace(/^\s*(?:\(Core\):?|Core\):?)\s*/i, '');
  l = l.replace(/[\.\,\:\-\(\)\–—]+$/, '').replace(/^[\.\,\:\-\(\)\–—]+/, '').replace(/\s+/g, ' ').trim();

  // Clean comma and 'and' spacing: "Pune , Mumbai and Bengaluru" -> "Pune, Mumbai, Bengaluru"
  l = l.replace(/\s*,\s*/g, ', ').replace(/\s+and\s+/gi, ', ').replace(/,([^\s])/g, ', $1').replace(/\s+/g, ' ').trim();

  if (
    !l ||
    l.length < 2 ||
    /\byou\b|\bwe\b|\bi\b|\bcan\b|\bwrite\b|\bwant\b|\bfrom\s+(?:lc|sjt|prp|lab|home|hostel)\b|\bqueries\b|---|forwarded|own\s+location|\b(?:lc|sjt|prp|tt|mb|cb|smv)\s*\d+\b|please find|mail with|nonsense|come at|assistance|applicable|candidate|round\s+\d+|results|service agreement|forwarded message|candidates list|as per business|interested students|shortlisted stu|economy class|round\s+trip|placement office|online|^[>,\.\*\s]+$/i.test(l) ||
    /^(?:vit\s+)?(?:vellore|chennai|bhopal(?:\s+labs)?)$/i.test(l.trim())
  ) {
    return null;
  }

  if (/pan\s+india/i.test(l)) return 'Pan India';
  if (/remote/i.test(l)) return 'Remote';
  return l;
}

export default function CompaniesClient({ companies }: CompaniesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>(
    searchParams.get('filter') || 'all'
  );
  const isSecondaryFilterActive = ['tier-superdream', 'tier-dream', 'tier-regular', 'has-stipend', 'upcoming-test'].includes(selectedFilter);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(isSecondaryFilterActive);
  const [sortMode, setSortMode] = useState<SortMode>('nearest-test');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Sync state on mount from URL query params or sessionStorage
  useEffect(() => {
    try {
      const urlSearch = searchParams.get('search') || searchParams.get('q');
      const savedSearch = urlSearch !== null ? urlSearch : sessionStorage.getItem('neotrack_companies_search');
      if (savedSearch && savedSearch !== searchQuery) {
        setSearchQuery(savedSearch);
      }

      const urlSort = searchParams.get('sort') as SortMode;
      const savedSort = urlSort || (sessionStorage.getItem('neotrack_companies_sort') as SortMode);
      if (savedSort && SORT_OPTIONS.some((o) => o.id === savedSort)) {
        setSortMode(savedSort);
      }

      const urlFilter = searchParams.get('filter');
      const savedFilter = urlFilter || sessionStorage.getItem('neotrack_companies_filter');
      if (savedFilter && savedFilter !== selectedFilter && STATUS_FILTERS.some((f) => f.id === savedFilter)) {
        setSelectedFilter(savedFilter);
      }
    } catch {}
  }, []);

  // Sync state if URL query param changes externally (e.g. back/forward button)
  useEffect(() => {
    const f = searchParams.get('filter');
    if (f && f !== selectedFilter) {
      setSelectedFilter(f);
    }
  }, [searchParams]);

  // Open secondary filters if secondary filter is selected
  useEffect(() => {
    if (['tier-superdream', 'tier-dream', 'tier-regular', 'has-stipend', 'upcoming-test'].includes(selectedFilter)) {
      setIsMoreFiltersOpen(true);
    }
  }, [selectedFilter]);

  // Debounced URL and sessionStorage sync for search query
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (searchQuery.trim()) {
          sessionStorage.setItem('neotrack_companies_search', searchQuery.trim());
        } else {
          sessionStorage.removeItem('neotrack_companies_search');
        }
      } catch {}

      const params = new URLSearchParams(searchParams.toString());
      const currentUrlSearch = params.get('search') || params.get('q') || '';
      if (searchQuery.trim() !== currentUrlSearch.trim()) {
        if (searchQuery.trim()) {
          params.set('search', searchQuery.trim());
          params.delete('q');
        } else {
          params.delete('search');
          params.delete('q');
        }
        const qs = params.toString();
        router.replace(qs ? `/companies?${qs}` : '/companies', { scroll: false });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    try {
      sessionStorage.setItem('neotrack_companies_filter', filterId);
    } catch {}
    const params = new URLSearchParams(searchParams.toString());
    if (filterId === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', filterId);
    }
    const qs = params.toString();
    router.replace(qs ? `/companies?${qs}` : '/companies', { scroll: false });
  };

  const handleSortChange = (newSort: SortMode) => {
    setSortMode(newSort);
    setIsSortOpen(false);
    try {
      sessionStorage.setItem('neotrack_companies_sort', newSort);
    } catch {}
    const params = new URLSearchParams(searchParams.toString());
    if (newSort === 'nearest-test') {
      params.delete('sort');
    } else {
      params.set('sort', newSort);
    }
    const qs = params.toString();
    router.replace(qs ? `/companies?${qs}` : '/companies', { scroll: false });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    try {
      sessionStorage.removeItem('neotrack_companies_search');
    } catch {}
    const params = new URLSearchParams(searchParams.toString());
    params.delete('search');
    params.delete('q');
    const qs = params.toString();
    router.replace(qs ? `/companies?${qs}` : '/companies', { scroll: false });
  };

  // Helper: derive tier from CTC value
  function getCompanyTier(ctc: string | null | undefined): 'super_dream' | 'dream' | 'regular' | null {
    if (!ctc) return null;
    const nums = [...ctc.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
    if (nums.length === 0) return null;
    const max = Math.max(...nums);
    if (max >= 10) return 'super_dream';
    if (max >= 4.5) return 'dream';
    return 'regular';
  }

  // Helper: get nearest upcoming test/interview event start time
  function getNearestTestTime(company: CompanyWithDetails): number {
    const now = Date.now();
    const testTypes = ['online_test', 'coding_test', 'technical_interview', 'hr_interview', 'final_interview', 'ppt'];
    const upcoming = (company.events || [])
      .filter((e) => testTypes.includes(e.event_type) && e.start_time && new Date(e.start_time).getTime() > now)
      .map((e) => new Date(e.start_time!).getTime())
      .sort((a, b) => a - b);
    return upcoming[0] ?? Infinity;
  }

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const now = Date.now();

    const filtered = companies.filter((c) => {
      // 1. Status / tier / special filters
      if (selectedFilter !== 'all') {
        if (selectedFilter === 'active') {
          const s = c.application?.status || 'not_applied';
          if (['not_applied', 'withdrawn', 'declined', 'not_shortlisted', 'rejected', 'selected'].includes(s)) return false;
        } else if (selectedFilter === 'not_applied') {
          const s = c.application?.status;
          if (s && s !== 'not_applied') return false;
        } else if (selectedFilter === 'withdrawn') {
          const s = c.application?.status || '';
          if (s !== 'withdrawn' && s !== 'declined') return false;
        } else if (selectedFilter === 'shortlisted') {
          if (!SHORTLISTED_STAGE_STATUSES.includes(c.application?.status || '')) return false;
        } else if (selectedFilter === 'tier-superdream') {
          if (getCompanyTier(c.application?.ctc) !== 'super_dream') return false;
        } else if (selectedFilter === 'tier-dream') {
          if (getCompanyTier(c.application?.ctc) !== 'dream') return false;
        } else if (selectedFilter === 'tier-regular') {
          if (getCompanyTier(c.application?.ctc) !== 'regular') return false;
        } else if (selectedFilter === 'has-stipend') {
          if (!c.application?.stipend) return false;
        } else if (selectedFilter === 'upcoming-test') {
          const testTypes = ['online_test', 'coding_test', 'technical_interview', 'hr_interview', 'final_interview', 'ppt'];
          const hasUpcoming = (c.events || []).some(
            (e) => testTypes.includes(e.event_type) && e.start_time && new Date(e.start_time).getTime() > now
          );
          if (!hasUpcoming) return false;
        } else {
          if ((c.application?.status || 'not_applied') !== selectedFilter) return false;
        }
      }

      // 2. Text search (with word-boundary precision for short queries like 'ey')
      if (query) {
        const isShort = query.length <= 2;
        const nameLower = c.name.toLowerCase();
        const roleLower = (c.application?.role || '').toLowerCase();
        const locLower = (c.application?.location || '').toLowerCase();

        const nameMatch = isShort
          ? nameLower.startsWith(query) || new RegExp(`\\b${query}\\b`, 'i').test(nameLower)
          : nameLower.includes(query);
        const roleMatch = isShort
          ? new RegExp(`\\b${query}\\b`, 'i').test(roleLower)
          : roleLower.includes(query);
        const locMatch = isShort
          ? new RegExp(`\\b${query}\\b`, 'i').test(locLower)
          : locLower.includes(query);
        const aliasesMatch = c.aliases?.some((a) => {
          const al = a.toLowerCase();
          return isShort ? al.startsWith(query) || new RegExp(`\\b${query}\\b`, 'i').test(al) : al.includes(query);
        });

        if (!nameMatch && !roleMatch && !locMatch && !aliasesMatch) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (query) {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aScore = aName.startsWith(query) ? 3 : (new RegExp(`\\b${query}\\b`, 'i').test(aName) ? 2 : (aName.includes(query) ? 1 : 0));
        const bScore = bName.startsWith(query) ? 3 : (new RegExp(`\\b${query}\\b`, 'i').test(bName) ? 2 : (bName.includes(query) ? 1 : 0));
        if (aScore !== bScore) return bScore - aScore;
      }

      switch (sortMode) {
        case 'name': return a.name.localeCompare(b.name);
        case 'name-za': return b.name.localeCompare(a.name);
        case 'status': {
          const aPri = SORT_STATUS_PRIORITY[a.application?.status || 'unknown'] ?? 2;
          const bPri = SORT_STATUS_PRIORITY[b.application?.status || 'unknown'] ?? 2;
          return bPri - aPri;
        }
        case 'ctc': return parseCTC(b.application?.ctc || b.application?.stipend) - parseCTC(a.application?.ctc || a.application?.stipend);
        case 'ctc-asc': return parseCTC(a.application?.ctc || a.application?.stipend) - parseCTC(b.application?.ctc || b.application?.stipend);
        case 'nearest-test': {
          const aTest = getNearestTestTime(a);
          const bTest = getNearestTestTime(b);
          const aHasTest = aTest !== Infinity;
          const bHasTest = bTest !== Infinity;

          // Drives with upcoming confirmed tests/PPTs bubble to the top
          if (aHasTest && !bHasTest) return -1;
          if (!aHasTest && bHasTest) return 1;

          // Both have upcoming events: sort chronologically (earliest event first)
          if (aHasTest && bHasTest) {
            if (aTest !== bTest) return aTest - bTest;
          }

          // Stable tiebreaker for drives with no upcoming events (or identical event time):
          // Sort by date applied / announced (newest first)
          const aApplied = a.application?.applied_at ? new Date(a.application.applied_at).getTime() : 0;
          const bApplied = b.application?.applied_at ? new Date(b.application.applied_at).getTime() : 0;
          if (aApplied !== bApplied) return bApplied - aApplied;

          return a.name.localeCompare(b.name);
        }
        case 'date-asc': {
          // Oldest email activity first
          const aTime = new Date(a.latestEmailDate || a.updated_at).getTime();
          const bTime = new Date(b.latestEmailDate || b.updated_at).getTime();
          return aTime - bTime;
        }
        case 'date-applied': {
          const aApplied = a.application?.applied_at ? new Date(a.application.applied_at).getTime() : 0;
          const bApplied = b.application?.applied_at ? new Date(b.application.applied_at).getTime() : 0;
          return aApplied - bApplied; // oldest first
        }
        case 'date-applied-desc': {
          const aApplied = a.application?.applied_at ? new Date(a.application.applied_at).getTime() : 0;
          const bApplied = b.application?.applied_at ? new Date(b.application.applied_at).getTime() : 0;
          return bApplied - aApplied; // newest first
        }
        case 'recent':
        default: {
          const bTime = new Date(b.latestEmailDate || b.updated_at).getTime();
          const aTime = new Date(a.latestEmailDate || a.updated_at).getTime();
          return bTime - aTime;
        }
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
              className="w-full pl-9 pr-8 py-2 bg-[#101018] border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 rounded-full hover:bg-zinc-800 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
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

      {/* Filter Tabs with Counts — grouped: Status | Tier | Special */}
      {/* Primary Status Tabs Row with More Filters Toggle */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_FILTERS.filter((f) => f.group === 'status').map((filter) => {
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
              count = companies.filter((c) => SHORTLISTED_STAGE_STATUSES.includes(c.application?.status || '')).length;
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

          {/* Toggle More Filters (Tier, Stipend, Events) */}
          <button
            type="button"
            onClick={() => setIsMoreFiltersOpen(!isMoreFiltersOpen)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shrink-0 border select-none ml-auto active:scale-95',
              isSecondaryFilterActive || isMoreFiltersOpen
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 font-bold'
                : 'bg-[#101018] text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700'
            )}
            title="Toggle Tier and Special Filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {isSecondaryFilterActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            )}
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 transition-transform duration-200 text-zinc-500',
                isMoreFiltersOpen && 'rotate-180 text-indigo-400'
              )}
            />
          </button>
        </div>

        {/* Collapsible Secondary Filters Tray */}
        {isMoreFiltersOpen && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-[#101018]/90 backdrop-blur-xl border border-zinc-800/80 rounded-2xl animate-fade-in text-xs">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 pl-1">
              Tier:
            </span>
            {STATUS_FILTERS.filter((f) => f.group === 'tier').map((filter) => {
              const count =
                filter.id === 'tier-superdream'
                  ? companies.filter((c) => getCompanyTier(c.application?.ctc) === 'super_dream').length
                  : filter.id === 'tier-dream'
                  ? companies.filter((c) => getCompanyTier(c.application?.ctc) === 'dream').length
                  : companies.filter((c) => getCompanyTier(c.application?.ctc) === 'regular').length;
              const isActive = selectedFilter === filter.id;

              return (
                <button
                  key={filter.id}
                  onClick={() => handleFilterChange(filter.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 select-none',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <span>{filter.label}</span>
                  <span className={cn('text-[10px] font-mono', isActive ? 'text-indigo-200' : 'text-zinc-500')}>
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="h-4 w-px bg-zinc-800 mx-1 hidden sm:block" />

            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 pl-1">
              Special:
            </span>
            {STATUS_FILTERS.filter((f) => f.group === 'special').map((filter) => {
              const now = Date.now();
              const count =
                filter.id === 'has-stipend'
                  ? companies.filter((c) => !!c.application?.stipend).length
                  : companies.filter((c) => {
                      const testTypes = ['online_test', 'coding_test', 'technical_interview', 'hr_interview', 'final_interview', 'ppt'];
                      return (c.events || []).some(
                        (e) => testTypes.includes(e.event_type) && e.start_time && new Date(e.start_time).getTime() > now
                      );
                    }).length;
              const isActive = selectedFilter === filter.id;

              return (
                <button
                  key={filter.id}
                  onClick={() => handleFilterChange(filter.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 select-none',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <span>{filter.label}</span>
                  <span className={cn('text-[10px] font-mono', isActive ? 'text-indigo-200' : 'text-zinc-500')}>
                    {count}
                  </span>
                </button>
              );
            })}

            {isSecondaryFilterActive && (
              <button
                type="button"
                onClick={() => handleFilterChange('all')}
                className="ml-auto px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        )}
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
            const role = cleanRoleDisplay(c.application?.role, c.application?.category);
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
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition-colors truncate">
                          {c.name}
                        </h3>
                        <p className="text-xs text-zinc-400 truncate mt-0.5 font-medium">
                          {getCategoryDisplay(c.application?.category, c.application?.ctc)}
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={status} events={c.events} />
                  </div>

                  {/* CTC, Drive Mode & Work Location Badges */}
                  {(() => {
                    const notesStr = (c.application?.notes || '').toLowerCase();
                    const travelBadge =
                      notesStr.includes('vellore')
                        ? '✈️ VIT Vellore'
                        : notesStr.includes('chennai')
                        ? '✈️ VIT Chennai'
                        : notesStr.includes('bhopal_lab')
                        ? '🏫 Bhopal Labs'
                        : notesStr.includes('online')
                        ? '💻 Online'
                        : null;

                    const cleanLoc = cleanLocationDisplay(location);

                    const stipend = cleanStipendDisplay(c.application?.stipend);
                    return (ctc || stipend || travelBadge || cleanLoc) && (
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {ctc ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <IndianRupee className="w-3 h-3" />
                            {ctc}
                          </span>
                        ) : stipend ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" title="Monthly Stipend">
                            <IndianRupee className="w-3 h-3" />
                            {stipend} <span className="text-[10px] font-medium opacity-70">/mo</span>
                          </span>
                        ) : null}
                        {travelBadge && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                              travelBadge.includes('Vellore')
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold shadow-sm shadow-amber-500/5'
                                : travelBadge.includes('Chennai')
                                ? 'bg-orange-500/15 text-orange-300 border-orange-500/30 font-bold shadow-sm shadow-orange-500/5'
                                : travelBadge.includes('Bhopal')
                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                            )}
                          >
                            {travelBadge}
                          </span>
                        )}
                        {cleanLoc && !cleanLoc.includes('Vellore') && !cleanLoc.includes('Chennai') && !cleanLoc.includes('Bhopal') && (
                          <span
                            title={cleanLoc}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 max-w-[220px]"
                          >
                            <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                            <span className="truncate">{cleanLoc}</span>
                          </span>
                        )}
                      </div>
                    );
                  })()}

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
