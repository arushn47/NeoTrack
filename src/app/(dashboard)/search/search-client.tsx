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
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Global Search</h1>
        <p className="text-sm text-text-secondary mt-1">
          Instantly search across tracked companies, emails, job roles, tests, and interview schedules.
        </p>
      </div>

      {/* Big Search Input */}
      <div className="relative">
        <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          autoFocus
          placeholder="Search by company name, role, CTC, test platform, or email subject..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-bg-surface border border-border-default rounded-2xl text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent shadow-sm transition-all"
        />
      </div>

      {/* Results summary */}
      {query.trim() && (
        <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
          Found {totalResults} {totalResults === 1 ? 'result' : 'results'} for &ldquo;{query}&rdquo;
        </div>
      )}

      {/* Empty Initial State */}
      {!query.trim() && (
        <div className="p-12 text-center bg-bg-surface border border-border-default rounded-2xl">
          <SearchIcon className="w-12 h-12 text-text-tertiary opacity-30 mx-auto mb-3" />
          <p className="text-base font-semibold text-text-primary">Type anything to search</p>
          <p className="text-xs text-text-tertiary mt-1 max-w-md mx-auto">
            Try searching for &ldquo;MUFG&rdquo;, &ldquo;Infosys&rdquo;, &ldquo;Shortlist&rdquo;, &ldquo;Coding Test&rdquo;, or &ldquo;Software Engineer&rdquo;.
          </p>
        </div>
      )}

      {/* Companies Results */}
      {results.companies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent" />
            Companies ({results.companies.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.companies.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="flex items-center justify-between p-4 bg-bg-surface border border-border-default hover:border-accent/40 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center font-bold text-accent text-sm">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                      {c.name}
                    </h3>
                    <p className="text-xs text-text-tertiary truncate max-w-[180px]">{c.role || 'Placement Drive'}</p>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Events Results */}
      {results.events.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            Events & Schedules ({results.events.length})
          </h2>
          <div className="space-y-2">
            {results.events.map((evt) => (
              <Link
                key={evt.id}
                href={`/companies/${evt.companyId}`}
                className="flex items-center justify-between p-3.5 bg-bg-surface border border-border-default hover:border-accent/40 rounded-xl transition-all group"
              >
                <div>
                  <span className="text-[11px] font-bold text-accent uppercase tracking-wider">
                    {evt.companyName} · {evt.eventType.replace('_', ' ')}
                  </span>
                  <h4 className="text-sm font-semibold text-text-primary mt-0.5">{evt.title || evt.eventType}</h4>
                </div>
                <div className="text-right text-xs text-text-tertiary">
                  {evt.startTime && (
                    <span>{new Date(evt.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  )}
                  {evt.venue && <p className="text-[11px] truncate max-w-[150px]">{evt.venue}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Emails Results */}
      {results.emails.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Mail className="w-4 h-4 text-accent" />
            Synced Emails ({results.emails.length})
          </h2>
          <div className="space-y-2">
            {results.emails.map((em) => (
              <div key={em.id} className="p-4 bg-bg-surface border border-border-default rounded-xl">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-accent">{em.sender}</span>
                  <span className="text-xs text-text-tertiary">{timeAgo(em.receivedAt)}</span>
                </div>
                <h4 className="text-sm font-semibold text-text-primary">{em.subject}</h4>
                <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{em.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
