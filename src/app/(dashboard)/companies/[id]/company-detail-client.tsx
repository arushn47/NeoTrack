'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Calendar,
  IndianRupee,
  MapPin,
  Mail,
  Sparkles,
  Edit3,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/shared/status-badge';
import StageProgressBar from '@/components/companies/stage-progress-bar';

export interface CompanyDetail {
  id: string;
  name: string;
  legalName: string | null;
  aliases: string[] | null;
  application: {
    id: string;
    status: string;
    statusSource: string | null;
    statusConfidence: string | null;
    role: string | null;
    ctc: string | null;
    stipend: string | null;
    location: string | null;
    eligibility: string | null;
    manualOverride: boolean;
    notes: string | null;
    appliedAt: string | null;
    lastUpdated: string;
  } | null;
  events: {
    id: string;
    eventType: string;
    title: string | null;
    startTime: string | null;
    venue: string | null;
    mode: string | null;
  }[];
  emails: {
    id: string;
    subject: string;
    sender: string;
    receivedAt: string;
    snippet: string;
    classification: string;
  }[];
  candidateMatches: {
    id: string;
    matchType: string;
    matchedValue: string | null;
    createdAt: string;
  }[];
}

interface CompanyDetailClientProps {
  company: CompanyDetail;
}

const ALL_STATUSES = [
  { value: 'applied', label: 'Applied' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'ppt_scheduled', label: 'PPT Scheduled' },
  { value: 'test_scheduled', label: 'Test Scheduled' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'selected', label: 'Selected 🎉' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'declined', label: 'Declined / Opted Out' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'not_shortlisted', label: 'Not Shortlisted' },
  { value: 'not_applied', label: 'Not Applied' },
];

export default function CompanyDetailClient({ company }: CompanyDetailClientProps) {
  const [status, setStatus] = useState(company.application?.status || 'applied');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'emails'>('timeline');

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    setShowStatusMenu(false);
    try {
      const res = await fetch(`/api/companies/${company.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const isNeoMatched = company.candidateMatches.length > 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Back Button */}
      <Link
        href="/companies"
        className="inline-flex items-center gap-2 text-sm text-text-tertiary hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Companies
      </Link>

      {/* Header Card */}
      <div className="p-6 bg-bg-surface border border-border-default rounded-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center font-bold text-accent text-2xl">
              {company.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-text-primary">{company.name}</h1>
                {isNeoMatched && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/15 text-accent border border-accent/30">
                    <Sparkles className="w-3 h-3" />
                    Shortlisted
                  </span>
                )}
              </div>
              <p className="text-sm text-text-secondary mt-0.5">
                {company.application?.role || 'Campus Placement Drive'}
                {company.legalName && ` · ${company.legalName}`}
              </p>
            </div>
          </div>

          {/* Status Override Selector */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={isUpdating}
              className="flex items-center gap-2.5 px-4 py-2 bg-bg-elevated border border-border-default hover:border-accent/40 rounded-xl text-sm font-medium transition-all"
            >
              <StatusBadge status={status} />
              <ChevronDown className="w-4 h-4 text-text-tertiary" />
            </button>

            {showStatusMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowStatusMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 bg-bg-elevated border border-border-default rounded-xl shadow-xl z-50 py-1 max-h-64 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                    Override Status
                  </div>
                  {ALL_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => handleStatusChange(s.value)}
                      className={cn(
                        'flex items-center justify-between w-full px-3 py-2 text-xs font-medium hover:bg-bg-surface-hover transition-colors text-left',
                        status === s.value ? 'text-accent font-semibold' : 'text-text-secondary'
                      )}
                    >
                      <span>{s.label}</span>
                      {status === s.value && <CheckCircle2 className="w-3.5 h-3.5 text-accent" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick Metadata Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-border-default/60">
          <div className="p-3 bg-bg-elevated/50 rounded-xl border border-border-default/40">
            <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-wider block">CTC / Package</span>
            <span className="text-sm font-semibold text-emerald-400 mt-0.5 block truncate">
              {company.application?.ctc ? company.application.ctc.replace(/\*/g, '').trim() : 'Not specified'}
            </span>
          </div>

          <div className="p-3 bg-bg-elevated/50 rounded-xl border border-border-default/40">
            <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-wider block">Stipend</span>
            <span className="text-sm font-semibold text-text-primary mt-0.5 block truncate">
              {company.application?.stipend ? company.application.stipend.replace(/\*/g, '').trim() : 'Not specified'}
            </span>
          </div>

          <div className="p-3 bg-bg-elevated/50 rounded-xl border border-border-default/40">
            <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-wider block">Location</span>
            <span className="text-sm font-semibold text-text-primary mt-0.5 block truncate">
              {company.application?.location ? company.application.location.replace(/\*/g, '').trim() : 'Pan India / Remote'}
            </span>
          </div>

          <div className="p-3 bg-bg-elevated/50 rounded-xl border border-border-default/40">
            <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-wider block">Synced Emails</span>
            <span className="text-sm font-semibold text-accent mt-0.5 block">
              {company.emails.length} emails
            </span>
          </div>
        </div>
      </div>

      {/* Hiring Process Pipeline Stepper */}
      <div className="p-5 bg-bg-surface border border-border-default rounded-2xl">
        <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          Hiring Pipeline Progression
        </h3>
        <StageProgressBar status={status} className="py-2" />
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-4 border-b border-border-default">
        <button
          onClick={() => setActiveTab('timeline')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'timeline'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          Placement Timeline & Events ({company.events.length})
        </button>

        <button
          onClick={() => setActiveTab('emails')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'emails'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          Synced Emails ({company.emails.length})
        </button>
      </div>

      {/* Tab Content: Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          {company.events.length === 0 && company.emails.length === 0 ? (
            <div className="p-8 text-center bg-bg-surface border border-border-default rounded-2xl">
              <Calendar className="w-10 h-10 text-text-tertiary opacity-40 mx-auto mb-2" />
              <p className="text-sm text-text-secondary font-medium">No events recorded yet</p>
              <p className="text-xs text-text-tertiary mt-1">Sync your email inbox to discover test schedules, interview dates, and PPTs.</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-border-default space-y-6 ml-3 py-2">
              {company.events.map((evt) => (
                <div key={evt.id} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-accent border-4 border-bg-surface ring-2 ring-accent/30" />

                  <div className="p-4 bg-bg-surface border border-border-default rounded-xl hover:border-accent/30 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                        {evt.eventType.replace('_', ' ')}
                      </span>
                      {evt.startTime && (
                        <span className="text-xs text-text-tertiary">
                          {new Date(evt.startTime).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    <h4 className="font-semibold text-text-primary text-sm mt-1">
                      {evt.title || evt.eventType}
                    </h4>

                    {evt.venue && (
                      <p className="text-xs text-text-secondary mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-text-tertiary" />
                        {evt.venue}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Show Emails as Timeline fallback if no events */}
              {company.events.length === 0 &&
                company.emails.map((em) => (
                  <div key={em.id} className="relative group">
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-border-default border-4 border-bg-surface" />
                    <div className="p-4 bg-bg-surface border border-border-default rounded-xl">
                      <span className="text-xs font-medium text-text-tertiary">
                        {new Date(em.receivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                      <h4 className="font-medium text-text-primary text-sm mt-0.5">{em.subject}</h4>
                      <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{em.snippet}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Emails */}
      {activeTab === 'emails' && (
        <div className="space-y-3">
          {company.emails.length === 0 ? (
            <div className="p-8 text-center bg-bg-surface border border-border-default rounded-2xl">
              <Mail className="w-10 h-10 text-text-tertiary opacity-40 mx-auto mb-2" />
              <p className="text-sm text-text-secondary font-medium">No emails linked to this company</p>
            </div>
          ) : (
            company.emails.map((em) => (
              <div key={em.id} className="p-4 bg-bg-surface border border-border-default rounded-xl hover:border-accent/30 transition-all">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-accent">{em.sender}</span>
                  <span className="text-xs text-text-tertiary">{timeAgo(em.receivedAt)}</span>
                </div>
                <h4 className="text-sm font-semibold text-text-primary">{em.subject}</h4>
                <p className="text-xs text-text-tertiary mt-1 line-clamp-3">{em.snippet}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
