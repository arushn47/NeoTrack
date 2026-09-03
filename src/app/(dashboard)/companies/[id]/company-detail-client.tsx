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
import { parseAssignedLocations } from '@/lib/sync/locations';

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
    category?: string | null;
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
    if (
      !r ||
      /\byou\s*(?:are|have|re)\b|dear\s|greetings|eligible|registr|for the candidate|reserve a position|expect them/i.test(r) ||
      /^(?:super\s+dream|dream|regular)(?:\s+(?:internship|offer|placement|drive))?$/i.test(r.trim())
    ) {
      return company.application?.category ? 'Campus Placement Drive' : 'Software Engineering Profile';
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
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{company.name}</h1>
                {company.application?.category && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm">
                    {company.application.category}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-zinc-300 mt-1.5 font-medium flex items-center gap-2 flex-wrap">
                {company.application?.role ? (
                  <span>Role: <span className="text-white font-semibold">{company.application.role}</span></span>
                ) : (
                  <span className="text-zinc-400">Campus Placement Drive</span>
                )}
                {company.legalName && <span className="text-zinc-500">· {company.legalName}</span>}
              </p>
            </div>
          </div>

          {/* Actions on the right: Status Override + Delete */}
          <div className="flex items-center gap-2.5 self-start sm:self-center">
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
              className="p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 text-zinc-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all shadow-md active:scale-95"
              title="Delete company"
              aria-label="Delete company"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Metadata Bar */}
        {(() => {
          const travelReq = company.application?.notes;
          const driveModeDisplay =
            travelReq === 'vellore'
              ? '✈️ VIT Vellore'
              : travelReq === 'chennai'
              ? '✈️ VIT Chennai'
              : travelReq === 'bhopal_lab'
              ? '🏫 Bhopal Labs'
              : travelReq === 'online'
              ? '💻 Online'
              : 'To be announced';

          // Helper to sanitize location string to pure city/state/country
          const rawLocation = company.application?.location;
          let cleanedLoc = rawLocation ? rawLocation.replace(/<[^>]+>/g, ' ').replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim() : null;
          if (cleanedLoc) {
            cleanedLoc = cleanedLoc.replace(/\s*(?:All\s+the|All\s+interested|Placement\s+Office|On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)|Students\s+with|Registered\s+students|Registration|Note|Eligibility|Skills|Service|Work\s+Mode|Joining|Economy|Round\s+Trip|Depending\s+on|Below\s+attachment|Job\s+Description|JD).*$/i, '');
            cleanedLoc = cleanedLoc.replace(/\b(?:internship|placement|drive|hiring|offer|job|role|any\s+honeywell\s+site)\b/gi, '');
            cleanedLoc = cleanedLoc.replace(/^\s*(?:\(Core\):?|Core\):?)\s*/i, '');
            cleanedLoc = cleanedLoc.replace(/[\.\,\:\-\(\)\–—]+$/, '').replace(/^[\.\,\:\-\(\)\–—]+/, '').replace(/\s+/g, ' ').trim();
            cleanedLoc = cleanedLoc.replace(/\s*,\s*/g, ', ').replace(/\s+and\s+/gi, ', ').replace(/,([^\s])/g, ', $1');
            if (
              !cleanedLoc ||
              cleanedLoc.length < 2 ||
              /please find|mail with|nonsense|come at|assistance|applicable|candidate|round\s+\d+|results|service agreement|forwarded message|candidates list|as per business|interested students|shortlisted stu|economy class|round\s+trip|placement office|online|^[>,\.\*\s]+$/i.test(cleanedLoc) ||
              /^(?:vit\s+)?(?:vellore|chennai|bhopal(?:\s+labs)?)$/i.test(cleanedLoc.trim())
            ) {
              cleanedLoc = null;
            }
          }

          const workLocationDisplay = cleanedLoc || 'Pan India / Remote';
          const locationItems = parseAssignedLocations(workLocationDisplay);
          const isMultiLocation = locationItems.length > 1;

          return (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
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
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Drive Mode / Travel</span>
                <span
                  className={cn(
                    'text-sm font-bold mt-1 block truncate',
                    driveModeDisplay.includes('Vellore')
                      ? 'text-amber-300 font-extrabold'
                      : driveModeDisplay.includes('Chennai')
                      ? 'text-orange-300 font-extrabold'
                      : driveModeDisplay.includes('Bhopal')
                      ? 'text-indigo-300'
                      : driveModeDisplay.includes('Online')
                      ? 'text-emerald-300'
                      : 'text-zinc-400'
                  )}
                >
                  {driveModeDisplay}
                </span>
              </div>

              <div
                className={cn(
                  'p-3.5 bg-zinc-950/60 rounded-2xl border border-zinc-800/80 relative transition-all',
                  isMultiLocation || workLocationDisplay.length > 18
                    ? 'group hover:border-indigo-500/40 hover:bg-zinc-900/60 cursor-pointer'
                    : ''
                )}
                title={workLocationDisplay}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                    Work Location
                  </span>
                  {isMultiLocation && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                      +{locationItems.length - 1}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-zinc-200 mt-1 block truncate">
                  {workLocationDisplay}
                </span>

                {/* Floating Tooltip with full locations pill list on hover */}
                {(isMultiLocation || workLocationDisplay.length > 18) && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[280px] p-3 rounded-2xl bg-[#12121e]/95 backdrop-blur-2xl border border-indigo-500/30 shadow-2xl shadow-black/90 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 translate-y-1 group-hover:translate-y-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300 mb-2">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Assigned Locations ({locationItems.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {locationItems.map((loc, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-zinc-200 text-xs font-semibold"
                        >
                          {loc}
                        </span>
                      ))}
                    </div>
                    {/* Tooltip caret */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-indigo-500/30 w-0 h-0" />
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-zinc-950/60 rounded-2xl border border-zinc-800/80 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Synced Circulars</span>
                <span className="text-sm font-bold text-indigo-400 mt-1 block font-mono">
                  {company.emails.length} emails linked
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Hiring Process Pipeline Stepper */}
      <div className="p-6 bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl shadow-xl shadow-black/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/60 pb-3">
          <div>
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Hiring Pipeline Progression
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Click on any stage circle or use the quick buttons below to freely adjust your pipeline stage.
            </p>
          </div>

          {company.application?.manualOverride && (
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl">
                Manual Override Active
              </span>
            </div>
          )}
        </div>

        {/* Clickable Stepper Bar */}
        <StageProgressBar
          status={status}
          events={company.events}
          interactive
          onStageClick={(_idx, _id, suggestedStatus) => handleStatusChange(suggestedStatus)}
          className="py-1"
        />

        {/* Interactive Quick Stage Override Selector */}
        <div className="pt-2 border-t border-zinc-800/60 space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Quick Stage Switcher:
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { value: 'applied', label: '1. Applied', activeBg: 'bg-zinc-800 text-white border-zinc-600' },
              { value: 'ppt_scheduled', label: '2. PPT', activeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
              { value: 'test_scheduled', label: '3. Online Test', activeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
              { value: 'interview_scheduled', label: '4. Interview', activeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
              { value: 'selected', label: '5. Selected 🎉', activeBg: 'bg-green-500/20 text-green-300 border-green-500/40' },
              { value: 'not_shortlisted', label: 'Not Shortlisted', activeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
              { value: 'rejected', label: 'Eliminated in Test', activeBg: 'bg-red-500/20 text-red-300 border-red-500/40' },
              { value: 'declined', label: 'Declined / Opted Out', activeBg: 'bg-zinc-800 text-zinc-300 border-zinc-600' },
            ].map((btn) => {
              const isCurrent = status === btn.value;
              return (
                <button
                  key={btn.value}
                  disabled={isUpdating}
                  onClick={() => handleStatusChange(btn.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 flex items-center gap-1.5',
                    isCurrent
                      ? `${btn.activeBg} ring-2 ring-indigo-500/40 shadow-sm font-bold`
                      : 'bg-zinc-950/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                  )}
                >
                  {isCurrent && <CheckCircle2 className="w-3 h-3 text-indigo-400" />}
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>
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
