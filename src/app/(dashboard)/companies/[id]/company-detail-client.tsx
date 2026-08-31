'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Briefcase,
  Layers,
  Trash2,
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
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (company.application?.status) {
      setStatus(company.application.status);
    }
  }, [company.application?.status]);

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

  const displayRole = (() => {
    const r = company.application?.role;
    if (!r || /\byou\s*(?:are|have|re)\b|dear\s|greetings|eligible|registr/i.test(r)) {
      return 'Campus Placement Drive';
    }
    return r;
  })();

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto selection:bg-indigo-500/20">
      {/* Back Button */}
      <Link
        href="/companies"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4 text-zinc-500" />
        Back to Placement Drives
      </Link>

      {/* Header Card */}
      <div className="p-6 sm:p-7 bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl relative z-20 shadow-2xl shadow-black/30 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600/20 to-violet-600/20 border border-indigo-500/30 flex items-center justify-center font-extrabold text-indigo-400 text-2xl shadow-lg shadow-indigo-500/10">
              {company.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{company.name}</h1>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-medium">
                {displayRole}
                {company.legalName && ` · ${company.legalName}`}
              </p>
            </div>
          </div>

          {/* Status Override Selector */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={isUpdating}
              className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900/90 border border-zinc-800 hover:border-indigo-500/40 rounded-2xl text-xs font-semibold transition-all shadow-md active:scale-95"
            >
              <StatusBadge status={status} events={company.events} />
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            {showStatusMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowStatusMenu(false)}
                />
                <div
                  className="absolute right-0 top-full mt-2 w-60 p-1.5 bg-[#12121c]/95 backdrop-blur-2xl border border-zinc-800 rounded-2xl shadow-2xl z-50 animate-fade-in max-h-[min(24rem,80vh)] overflow-y-auto divide-y divide-zinc-800/60"
                >
                  <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Manual Status Override
                  </div>
                  <div className="space-y-0.5 pt-1">
                    {ALL_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => handleStatusChange(s.value)}
                        className={cn(
                          'flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left',
                          status === s.value
                            ? 'bg-indigo-500/15 text-indigo-300 font-bold'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                        )}
                      >
                        <span>{s.label}</span>
                        {status === s.value && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Delete Company */}
          <button
            onClick={async () => {
              if (!confirm(`Delete "${company.name}" and all its events, status, and linked data? This cannot be undone.`)) return;
              setIsDeleting(true);
              try {
                const res = await fetch(`/api/companies/${company.id}`, { method: 'DELETE' });
                if (res.ok) {
                  router.push('/companies');
                } else {
                  alert('Failed to delete company');
                }
              } catch { alert('Failed to delete company'); }
              finally { setIsDeleting(false); }
            }}
            disabled={isDeleting}
            className="p-2.5 rounded-xl border border-zinc-800 hover:border-red-500/40 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all active:scale-95 disabled:opacity-50"
            title="Delete this company"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Metadata Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 bg-zinc-950/60 rounded-2xl border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">CTC / Package</span>
            <span className="text-sm font-extrabold text-emerald-400 mt-1 block truncate">
              {company.application?.ctc ? company.application.ctc.replace(/\*/g, '').trim() : 'Not specified'}
            </span>
          </div>

          <div className="p-3.5 bg-zinc-950/60 rounded-2xl border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Stipend</span>
            <span className="text-sm font-bold text-zinc-200 mt-1 block truncate">
              {company.application?.stipend ? company.application.stipend.replace(/\*/g, '').trim() : 'Not specified'}
            </span>
          </div>

          <div className="p-3.5 bg-zinc-950/60 rounded-2xl border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Job Location</span>
            <span className="text-sm font-bold text-zinc-200 mt-1 block truncate">
              {company.application?.location ? company.application.location.replace(/\*/g, '').trim() : 'Pan India / Remote'}
            </span>
          </div>

          <div className="p-3.5 bg-zinc-950/60 rounded-2xl border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Synced Circulars</span>
            <span className="text-sm font-bold text-indigo-400 mt-1 block font-mono">
              {company.emails.length} emails linked
            </span>
          </div>
        </div>
      </div>

      {/* Hiring Process Pipeline Stepper */}
      <div className="p-6 bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl shadow-xl shadow-black/20">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Hiring Pipeline Progression
        </h3>
        <StageProgressBar status={status} events={company.events} className="py-2" />
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-6 border-b border-zinc-800/80 px-2">
        <button
          onClick={() => setActiveTab('timeline')}
          className={cn(
            'pb-3 text-xs sm:text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2',
            activeTab === 'timeline'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Calendar className="w-4 h-4" />
          Placement Timeline & Events ({company.events.length})
        </button>

        <button
          onClick={() => setActiveTab('emails')}
          className={cn(
            'pb-3 text-xs sm:text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2',
            activeTab === 'emails'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Mail className="w-4 h-4" />
          Synced CDC Emails ({company.emails.length})
        </button>
      </div>

      {/* Tab Content: Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          {company.events.length === 0 && company.emails.length === 0 ? (
            <div className="p-12 text-center bg-[#101018]/90 border border-zinc-800/80 rounded-3xl">
              <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-300 font-semibold">No timeline events detected yet</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Any upcoming test links, PPT schedules, and interview invitations will be extracted automatically.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-zinc-800 space-y-6 ml-3 py-2">
              {company.events.map((evt) => (
                <div key={evt.id} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-indigo-500 border-4 border-[#0a0a10] ring-2 ring-indigo-500/30" />

                  <div className="p-4 bg-[#101018]/90 border border-zinc-800/80 rounded-2xl hover:border-indigo-500/30 transition-all shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                        {evt.eventType.replace('_', ' ')}
                      </span>
                      {evt.startTime && (
                        <span className="text-xs text-zinc-500 font-mono">
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

                    <h4 className="font-bold text-white text-sm mt-1">
                      {evt.title || evt.eventType}
                    </h4>

                    {evt.venue && (
                      <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
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
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-zinc-700 border-4 border-[#0a0a10]" />
                    <div className="p-4 bg-[#101018]/90 border border-zinc-800/80 rounded-2xl">
                      <span className="text-[11px] font-mono text-zinc-500">
                        {new Date(em.receivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                      <h4 className="font-semibold text-white text-sm mt-0.5">{em.subject}</h4>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{em.snippet}</p>
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
            <div className="p-12 text-center bg-[#101018]/90 border border-zinc-800/80 rounded-3xl">
              <Mail className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-300 font-semibold">No emails linked to this company</p>
            </div>
          ) : (
            company.emails.map((em) => (
              <div key={em.id} className="p-4 bg-[#101018]/90 border border-zinc-800/80 rounded-2xl hover:border-indigo-500/30 transition-all">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-indigo-400 truncate">{em.sender}</span>
                  <span className="text-[11px] text-zinc-500 font-mono flex-shrink-0">{timeAgo(em.receivedAt)}</span>
                </div>
                <h4 className="text-sm font-bold text-white">{em.subject}</h4>
                <p className="text-xs text-zinc-400 mt-1.5 line-clamp-3 leading-relaxed">{em.snippet}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
