'use client';

import { useState, useMemo } from 'react';
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
  { id: 'active', label: 'Active' },
  { id: 'applied', label: 'Applied' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'not_shortlisted', label: 'Not Shortlisted' },
  { id: 'selected', label: 'Selected 🎉' },
  { id: 'withdrawn', label: 'Opted Out / Withdrawn' },
  { id: 'all', label: 'All Companies' },
];

export default function CompaniesClient({ companies }: CompaniesClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('active');

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      // Search filter
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.application?.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.application?.ctc?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Status filter
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'active') {
        const s = c.application?.status || 'applied';
        return !['withdrawn', 'declined', 'not_shortlisted', 'rejected'].includes(s);
      }
      if (selectedFilter === 'withdrawn') {
        const s = c.application?.status || 'applied';
        return s === 'withdrawn' || s === 'declined';
      }
      return (c.application?.status || 'applied') === selectedFilter;
    });
  }, [companies, searchQuery, selectedFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Companies ({companies.length})
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Tracked placement drives from your NeoPAT personal emails and college announcements.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search company or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-default rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-all"
          />
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
              (c) => !['withdrawn', 'declined', 'not_shortlisted', 'rejected'].includes(c.application?.status || 'applied')
            ).length;
          } else if (filter.id === 'withdrawn') {
            count = companies.filter((c) => ['withdrawn', 'declined'].includes(c.application?.status || '')).length;
          } else {
            count = companies.filter((c) => (c.application?.status || 'applied') === filter.id).length;
          }

          const isActive = selectedFilter === filter.id;

          return (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
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
            const role = c.application?.role || 'Software Engineer / Graduate Trainee';
            const ctc = c.application?.ctc;
            const location = c.application?.location;
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
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center font-bold text-accent text-base group-hover:scale-105 transition-transform">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-primary text-base group-hover:text-accent transition-colors flex items-center gap-1.5">
                          {c.name}
                          {c.neoIdMatched && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent border border-accent/30" title="Neo ID Matched in Shortlist">
                              <Sparkles className="w-2.5 h-2.5" />
                              Shortlisted
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-text-tertiary truncate max-w-[180px]">
                          {role}
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={status} />
                  </div>

                  {/* CTC & Location Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {ctc && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <IndianRupee className="w-3 h-3" />
                        {ctc.replace(/\*/g, '').trim()}
                      </span>
                    )}
                    {location && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-secondary bg-bg-surface-hover border border-border-default">
                        <MapPin className="w-3 h-3 text-text-tertiary" />
                        {location.replace(/\*/g, '').trim()}
                      </span>
                    )}
                  </div>

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
