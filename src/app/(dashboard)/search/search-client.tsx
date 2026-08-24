'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search as SearchIcon,
  Building2,
  Calendar,
  Mail,
  FileText,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/shared/status-badge';

export interface SearchData {
  companies: {
    id: string;
    name: string;
    role: string | null;
    status: string;
    ctc: string | null;
    location: string | null;
  }[];
  emails: {
    id: string;
    subject: string;
    sender: string;
    receivedAt: string;
    companyId: string | null;
    companyName: string | null;
    snippet: string;
  }[];
  events: {
    id: string;
    title: string | null;
    eventType: string;
    startTime: string | null;
    venue: string | null;
    companyId: string;
    companyName: string;
  }[];
}

interface SearchClientProps {
  data: SearchData;
}

export default function SearchClient({ data }: SearchClientProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) {
      return {
        companies: [],
        emails: [],
        events: [],
      };
    }

    const q = query.toLowerCase().trim();

    const matchedCompanies = data.companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.role && c.role.toLowerCase().includes(q)) ||
        (c.ctc && c.ctc.toLowerCase().includes(q)) ||
        (c.location && c.location.toLowerCase().includes(q))
    );

    const matchedEmails = data.emails.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.sender.toLowerCase().includes(q) ||
        e.snippet.toLowerCase().includes(q) ||
        (e.companyName && e.companyName.toLowerCase().includes(q))
    );

    const matchedEvents = data.events.filter(
      (ev) =>
        (ev.title && ev.title.toLowerCase().includes(q)) ||
        ev.eventType.toLowerCase().includes(q) ||
        (ev.venue && ev.venue.toLowerCase().includes(q)) ||
        ev.companyName.toLowerCase().includes(q)
    );

    return {
      companies: matchedCompanies,
      emails: matchedEmails,
      events: matchedEvents,
    };
  }, [query, data]);

  const totalResults =
    results.companies.length + results.emails.length + results.events.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in selection:bg-indigo-500/20">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <SearchIcon className="w-6 h-6 text-indigo-400" />
          <span>Global Search</span>
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Instantly search across tracked company drives, emails, job roles, assessment schedules, and interview rounds.
        </p>
      </div>

      {/* Luxury Search Input */}
      <div className="relative">
        <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          autoFocus
          placeholder="Search by company name, role, CTC (e.g. 12 LPA), test platform, or email subject..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-12 py-3.5 bg-[#101018]/90 backdrop-blur-xl border border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl text-sm sm:text-base text-white placeholder:text-zinc-500 shadow-xl shadow-black/20 transition-all outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results summary */}
      {query.trim() && (
        <div className="text-xs font-mono text-zinc-400">
          Found <span className="text-indigo-400 font-bold">{totalResults}</span> {totalResults === 1 ? 'match' : 'matches'} for &ldquo;{query}&rdquo;
        </div>
      )}

      {/* Empty Initial State */}
      {!query.trim() && (
        <div className="p-14 text-center bg-[#101018]/90 border border-zinc-800/80 rounded-3xl">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-600">
            <Sparkles className="w-6 h-6" />
          </div>
          <p className="text-zinc-200 font-bold text-base">Search Anything in NeoTrack</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Try searching for company names (e.g., &ldquo;Microsoft&rdquo;), roles (&ldquo;SDE&rdquo;), shortlist keywords, or test venues.
          </p>
        </div>
      )}

      {/* Companies Results */}
      {results.companies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            Companies ({results.companies.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.companies.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="flex items-center justify-between p-4 bg-[#101018]/90 backdrop-blur-xl border border-zinc-800/80 hover:border-indigo-500/40 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 group shadow-sm"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 flex items-center justify-center font-extrabold text-indigo-400 text-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                      {c.name}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate max-w-[180px]">{c.role || 'Placement Drive'}</p>
                  </div>
                </div>
                <StatusBadge status={c.status} events={data.events.filter((e) => e.companyId === c.id)} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Events Results */}
      {results.events.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            Events & Schedules ({results.events.length})
          </h2>
          <div className="space-y-2">
            {results.events.map((evt) => (
              <Link
                key={evt.id}
                href={`/companies/${evt.companyId}`}
                className="flex items-center justify-between p-4 bg-[#101018]/90 border border-zinc-800/80 hover:border-indigo-500/40 rounded-2xl transition-all group"
              >
                <div>
                  <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                    {evt.companyName} · {evt.eventType.replace('_', ' ')}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-0.5">{evt.title || evt.eventType}</h4>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  {evt.startTime && (
                    <span className="font-mono">{new Date(evt.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  )}
                  {evt.venue && <p className="text-[11px] text-zinc-400 truncate max-w-[150px]">{evt.venue}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Emails Results */}
      {results.emails.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-indigo-400" />
            Synced CDC Circulars ({results.emails.length})
          </h2>
          <div className="space-y-2">
            {results.emails.map((em) => (
              <div key={em.id} className="p-4 bg-[#101018]/90 border border-zinc-800/80 rounded-2xl">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-indigo-400 truncate">{em.sender}</span>
                  <span className="text-[11px] text-zinc-500 font-mono">{timeAgo(em.receivedAt)}</span>
                </div>
                <h4 className="text-sm font-bold text-white">{em.subject}</h4>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">{em.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
