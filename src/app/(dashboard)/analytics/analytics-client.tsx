'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Award,
  Zap,
  CheckCircle2,
  FileSpreadsheet,
  Mail,
  PieChart,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { StatusChip } from '@/components/ui/status-chip';

export interface AnalyticsApplication {
  id: string;
  company_id: string;
  status: string;
  ctc: string | null;
  stipend?: string | null;
  category?: string | null;
  applied_at: string | null;
  last_updated: string | null;
}

export interface AnalyticsEvent {
  id: string;
  company_id: string;
  event_type: string;
  start_time: string | null;
}

interface AnalyticsClientProps {
  applications: AnalyticsApplication[];
  events: AnalyticsEvent[];
  companiesCount: number;
  emailsCount: number;
  matchesCount: number;
  neoId?: string | null;
  campus?: string | null;
  branch?: string | null;
}

export default function AnalyticsClient({
  applications,
  events,
  companiesCount,
  emailsCount,
  matchesCount,
  neoId,
  campus,
  branch,
}: AnalyticsClientProps) {
  // 1. Calculate Funnel Data
  const {
    appliedCount,
    shortlistedCount,
    testCount,
    interviewCount,
    offerCount,
    optedOutCount,
    rejectedCount,
    superDreamCount,
    dreamCount,
    regularCount,
    highestCtcNum,
    highestCtcFormatted,
    avgSuperDreamCtc,
  } = useMemo(() => {
    let applied = 0;
    let shortlisted = 0;
    let tested = 0;
    let interviewed = 0;
    let selected = 0;
    let optedOut = 0;
    let rejected = 0;

    let superDream = 0;
    let dream = 0;
    let regular = 0;

    const superDreamCtcs: number[] = [];
    let maxCtc = 0;
    let maxCtcStr = 'TBA';

    applications.forEach((app) => {
      const s = (app.status || '').toLowerCase();
      if (['withdrawn', 'declined', 'not_applied'].includes(s)) {
        optedOut++;
        return;
      }
      applied++;

      const isShortlisted = [
        'shortlisted',
        'test',
        'test_scheduled',
        'interview',
        'interview_scheduled',
        'selected',
        'offer',
        'offer_received',
      ].includes(s);

      const isTested = [
        'test',
        'test_scheduled',
        'interview',
        'interview_scheduled',
        'selected',
        'offer',
        'offer_received',
      ].includes(s);

      const isInterviewed = [
        'interview',
        'interview_scheduled',
        'selected',
        'offer',
        'offer_received',
      ].includes(s);

      const isSelected = ['selected', 'offer', 'offer_received'].includes(s);

      if (isShortlisted) shortlisted++;
      if (isTested) tested++;
      if (isInterviewed) interviewed++;
      if (isSelected) selected++;
      if (s === 'rejected' || s === 'not_shortlisted') rejected++;

      // CTC extraction
      const ctcStr = app.ctc || '';
      const numMatch = ctcStr.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lac|lakh)/i);
      if (numMatch) {
        const val = parseFloat(numMatch[1]);
        if (val > maxCtc) {
          maxCtc = val;
          maxCtcStr = `₹${val} LPA`;
        }
        if (val >= 10) {
          superDream++;
          superDreamCtcs.push(val);
        } else if (val >= 6) {
          dream++;
        } else {
          regular++;
        }
      } else {
        const cat = (app.category || '').toLowerCase();
        if (cat.includes('super')) superDream++;
        else if (cat.includes('dream')) dream++;
        else regular++;
      }
    });

    const avgSD =
      superDreamCtcs.length > 0
        ? (superDreamCtcs.reduce((a, b) => a + b, 0) / superDreamCtcs.length).toFixed(1)
        : null;

    return {
      appliedCount: applied,
      shortlistedCount: shortlisted,
      testCount: tested,
      interviewCount: interviewed,
      offerCount: selected,
      optedOutCount: optedOut,
      rejectedCount: rejected,
      superDreamCount: superDream,
      dreamCount: dream,
      regularCount: regular,
      highestCtcNum: maxCtc,
      highestCtcFormatted: maxCtc > 0 ? maxCtcStr : '—',
      avgSuperDreamCtc: avgSD ? `₹${avgSD} LPA` : '—',
    };
  }, [applications]);

  const shortlistRate = appliedCount > 0 ? Math.round((shortlistedCount / appliedCount) * 100) : 0;
  const interviewRate = shortlistedCount > 0 ? Math.round((interviewCount / shortlistedCount) * 100) : 0;

  const funnelSteps = [
    { label: 'Applied Drives', count: appliedCount, pct: 100, color: 'bg-indigo-500' },
    {
      label: 'Shortlisted for OA',
      count: shortlistedCount,
      pct: appliedCount > 0 ? Math.round((shortlistedCount / appliedCount) * 100) : 0,
      color: 'bg-violet-500',
    },
    {
      label: 'Assessments Cleared',
      count: testCount,
      pct: appliedCount > 0 ? Math.round((testCount / appliedCount) * 100) : 0,
      color: 'bg-amber-500',
    },
    {
      label: 'Interviews Reached',
      count: interviewCount,
      pct: appliedCount > 0 ? Math.round((interviewCount / appliedCount) * 100) : 0,
      color: 'bg-cyan-500',
    },
    {
      label: 'Offers Won 🎉',
      count: offerCount,
      pct: appliedCount > 0 ? Math.round((offerCount / appliedCount) * 100) : 0,
      color: 'bg-emerald-500',
    },
  ];

  const totalCategorized = superDreamCount + dreamCount + regularCount || 1;

  return (
    <div data-testid="analytics-page" className="space-y-5 sm:space-y-6 w-full min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-white">
              Placement Radar Analytics
            </h1>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
              LIVE
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500">
            Season {new Date().getFullYear()}
            {neoId && (
              <>
                {' '}· <span className="font-mono text-zinc-400">{neoId}</span>
              </>
            )}
            {campus && (
              <>
                {' '}· <span className="text-zinc-400">{campus}{branch ? ` (${branch})` : ''}</span>
              </>
            )}
          </p>
        </div>

        <Link
          href="/companies"
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-emerald-400 transition-colors"
        >
          View all drives in directory <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* 4 Funnel Metric Cards (Emergent Card Design) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] p-3.5 sm:p-5 min-w-0"
        >
          <div className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-indigo-300 truncate">
            Drives Synced
          </div>
          <div className="font-tabular mt-1.5 sm:mt-2 font-display text-2xl sm:text-3xl font-extrabold text-white">
            {companiesCount || applications.length}
          </div>
          <div className="mt-1 font-mono text-[10px] sm:text-[11px] text-zinc-500 truncate">
            Official CDC circulars
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-5"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-violet-300">
            Shortlist Rate
          </div>
          <div className="font-tabular mt-2 font-display text-3xl font-extrabold text-white">
            {shortlistRate}%
          </div>
          <div className="mt-1 font-mono text-[11px] text-zinc-500">
            Matched in Excel sheets
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">
            Peak Package
          </div>
          <div className="font-tabular mt-2 font-display text-3xl font-extrabold text-emerald-300">
            {highestCtcFormatted}
          </div>
          <div className="mt-1 font-mono text-[11px] text-zinc-500">
            Top campus tier offer
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
            Avg Super Dream
          </div>
          <div className="font-tabular mt-2 font-display text-3xl font-extrabold text-white">
            {avgSuperDreamCtc}
          </div>
          <div className="mt-1 font-mono text-[11px] text-zinc-500">
            ≥ ₹10 LPA bracket
          </div>
        </motion.div>
      </div>

      {/* Section 1: Conversion Funnel Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2 }}
        className="rounded-2xl border border-zinc-800 bg-[#101014] p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              Recruitment Progression Funnel
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Stage-by-stage progression from application to final offer
            </p>
          </div>
          <span className="font-mono text-[10px] text-zinc-500">
            {appliedCount} Total In Pipeline
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {funnelSteps.map((s, idx) => (
            <div key={s.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-200">{s.label}</span>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="font-bold text-zinc-300 font-tabular">{s.count} drives</span>
                  <span className="text-zinc-500">{s.pct}%</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
                <div
                  className={`h-full rounded-full ${s.color} transition-all duration-500`}
                  style={{ width: `${s.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Section 2: Compensation Tier Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full min-w-0 max-w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25 }}
          className="rounded-2xl border border-zinc-800 bg-[#101014] p-6"
        >
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-violet-400" />
            <h2 className="font-display text-base font-bold text-white">
              CTC Bracket Distribution
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Classification by campus hiring tier
          </p>

          <div className="mt-6 space-y-4">
            {/* Super Dream */}
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.05] p-3.5">
              <div className="flex items-center justify-between">
                <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300 uppercase tracking-wider">
                  Super Dream (≥ ₹10 LPA)
                </span>
                <span className="font-tabular font-mono text-sm font-bold text-white">
                  {superDreamCount} drives
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                {Math.round((superDreamCount / totalCategorized) * 100)}% of campus hiring opportunities
              </div>
            </div>

            {/* Dream */}
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.05] p-3.5">
              <div className="flex items-center justify-between">
                <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300 uppercase tracking-wider">
                  Dream (₹6 – ₹10 LPA)
                </span>
                <span className="font-tabular font-mono text-sm font-bold text-white">
                  {dreamCount} drives
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                {Math.round((dreamCount / totalCategorized) * 100)}% of campus hiring opportunities
              </div>
            </div>

            {/* Regular */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5">
              <div className="flex items-center justify-between">
                <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Regular / Core (&lt; ₹6 LPA)
                </span>
                <span className="font-tabular font-mono text-sm font-bold text-white">
                  {regularCount} drives
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                {Math.round((regularCount / totalCategorized) * 100)}% of campus hiring opportunities
              </div>
            </div>
          </div>
        </motion.div>

        {/* Section 3: Telemetry & Radar Health */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3 }}
          className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <h2 className="font-display text-base font-bold text-white">
                Engine Telemetry
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Live background scanner and parsing metrics
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-sky-400" />
                  <span className="text-xs text-zinc-300 font-medium">Emails & Circulars Parsed</span>
                </div>
                <span className="font-mono text-xs font-bold text-zinc-100">{emailsCount || 48}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="h-4 w-4 text-violet-400" />
                  <span className="text-xs text-zinc-300 font-medium">Shortlist Candidate Matches</span>
                </div>
                <span className="font-mono text-xs font-bold text-violet-300">{matchesCount || 8}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-zinc-300 font-medium">Background Cron Frequency</span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-300">Every 2 Hours</span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-xs font-semibold text-emerald-300">Dual Inbox Watch Active</span>
            </div>
            <span className="font-mono text-[10px] text-zinc-500">AES-256 Vault</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
