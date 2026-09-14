import React from 'react';

export const STATUS_META: Record<string, { label: string; cls: string; dot: string; isPulse?: boolean }> = {
  not_applied: { label: 'Not Applied', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/25', dot: 'bg-zinc-500' },
  applied: { label: 'Applied', cls: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30', dot: 'bg-indigo-400' },
  shortlisted: { label: 'Shortlisted', cls: 'bg-violet-500/10 text-violet-300 border-violet-500/40', dot: 'bg-violet-400' },
  test: { label: 'Test Scheduled', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/40', dot: 'bg-amber-400', isPulse: true },
  test_scheduled: { label: 'Test Scheduled', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/40', dot: 'bg-amber-400', isPulse: true },
  test_ongoing: { label: 'Test Live', cls: 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-sm shadow-amber-500/20', dot: 'bg-amber-400', isPulse: true },
  test_completed: { label: 'Test Completed', cls: 'bg-teal-500/10 text-teal-300 border-teal-500/40', dot: 'bg-teal-400' },
  ppt: { label: 'PPT Scheduled', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30', dot: 'bg-sky-400' },
  ppt_scheduled: { label: 'PPT Scheduled', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30', dot: 'bg-sky-400' },
  ppt_ongoing: { label: 'PPT Live', cls: 'bg-sky-500/20 text-sky-200 border-sky-500/50 shadow-sm shadow-sky-500/20', dot: 'bg-sky-400', isPulse: true },
  ppt_completed: { label: 'PPT Completed', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30', dot: 'bg-sky-400' },
  interview: { label: 'Interview', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40', dot: 'bg-cyan-400', isPulse: true },
  interview_scheduled: { label: 'Interview', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40', dot: 'bg-cyan-400', isPulse: true },
  interview_ongoing: { label: 'Interview Live', cls: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-sm shadow-cyan-500/20', dot: 'bg-cyan-400', isPulse: true },
  interview_completed: { label: 'Interview Completed', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40', dot: 'bg-cyan-400' },
  offer: { label: 'Offer Received', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' },
  offer_received: { label: 'Offer Received', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' },
  selected: { label: 'Selected / Offer', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' },
  rejected: { label: 'Eliminated', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30', dot: 'bg-rose-400' },
  not_shortlisted: { label: 'Not Shortlisted', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30', dot: 'bg-rose-400' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-600/25', dot: 'bg-zinc-600' },
  declined: { label: 'Declined', cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-600/25', dot: 'bg-zinc-600' },
};

export const EVENT_META: Record<string, { label: string; cls: string; dot: string }> = {
  ppt: { label: 'PPT', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30', dot: 'bg-sky-400' },
  test: { label: 'Test', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/40', dot: 'bg-amber-400' },
  interview: { label: 'Interview', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' },
  deadline: { label: 'Deadline', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30', dot: 'bg-rose-400' },
  offer: { label: 'Offer', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' },
};

interface StatusChipProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'sm', className = '' }) => {
  const normStatus = (status || 'not_applied').toLowerCase();
  const m = STATUS_META[normStatus] || STATUS_META.not_applied;

  return (
    <span
      data-testid={`status-chip-${normStatus}`}
      className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-full border font-medium ${m.cls} ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${m.dot} ${m.isPulse ? 'pulse-dot' : ''}`} />
      {m.label}
    </span>
  );
};

export const CategoryBadge: React.FC<{ category?: string | null; className?: string }> = ({ category, className = '' }) => {
  if (!category) return null;
  const isSuperDream = /super\s*dream/i.test(category);
  const isDream = /dream/i.test(category) && !isSuperDream;
  const displayCategory = isSuperDream ? 'Super Dream' : isDream ? 'Dream' : category;

  const cls = isSuperDream
    ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
    : isDream
    ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
    : 'bg-zinc-500/10 text-zinc-400 border-zinc-600/25';

  return (
    <span
      data-testid={`category-badge-${displayCategory.replace(/\s/g, '-').toLowerCase()}`}
      className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls} ${className}`}
    >
      {displayCategory}
    </span>
  );
};
