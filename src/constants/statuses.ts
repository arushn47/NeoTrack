/** Application status values used throughout the system */
export const APPLICATION_STATUSES = {
  NOT_APPLIED: 'not_applied',
  APPLIED: 'applied',
  SHORTLISTED: 'shortlisted',
  PPT_SCHEDULED: 'ppt_scheduled',
  TEST_SCHEDULED: 'test_scheduled',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  SELECTED: 'selected',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  DECLINED: 'declined',
  NOT_SHORTLISTED: 'not_shortlisted',
  OFFER_RECEIVED: 'offer_received',
  UNKNOWN: 'unknown',
} as const;

export type ApplicationStatus = typeof APPLICATION_STATUSES[keyof typeof APPLICATION_STATUSES];

/** Human-readable labels for each status */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  not_applied: 'Not Applied',
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  ppt_scheduled: 'PPT Scheduled',
  test_scheduled: 'Test Scheduled',
  interview_scheduled: 'Interview Scheduled',
  selected: 'Selected',
  rejected: 'Rejected',
  not_shortlisted: 'Not Shortlisted',
  withdrawn: 'Opted Out',
  declined: 'Opted Out',
  offer_received: 'Offer Received',
  unknown: 'Unknown',
};

/** Color tokens for each status (Tailwind classes) */
export const STATUS_COLORS: Record<ApplicationStatus, { bg: string; text: string; dot: string; border: string }> = {
  not_applied:          { bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-400',   border: 'border-slate-500/30' },
  applied:              { bg: 'bg-blue-500/15',    text: 'text-blue-400',    dot: 'bg-blue-400',    border: 'border-blue-500/30' },
  shortlisted:          { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    dot: 'bg-cyan-400',    border: 'border-cyan-500/30' },
  ppt_scheduled:        { bg: 'bg-violet-500/15',  text: 'text-violet-400',  dot: 'bg-violet-400',  border: 'border-violet-500/30' },
  test_scheduled:       { bg: 'bg-amber-500/15',   text: 'text-amber-400',   dot: 'bg-amber-400',   border: 'border-amber-500/30' },
  interview_scheduled:  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-500/30' },
  selected:             { bg: 'bg-green-500/15',   text: 'text-green-400',   dot: 'bg-green-400',   border: 'border-green-500/30' },
  rejected:             { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400',     border: 'border-red-500/30' },
  not_shortlisted:      { bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-400',    border: 'border-rose-500/30' },
  withdrawn:            { bg: 'bg-gray-500/10',    text: 'text-gray-400',    dot: 'bg-gray-400',    border: 'border-gray-500/30' },
  declined:             { bg: 'bg-orange-500/10',  text: 'text-orange-400',  dot: 'bg-orange-400',  border: 'border-orange-500/30' },
  offer_received:       { bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  dot: 'bg-yellow-400',  border: 'border-yellow-500/30' },
  unknown:              { bg: 'bg-zinc-500/10',    text: 'text-zinc-400',    dot: 'bg-zinc-400',    border: 'border-zinc-500/30' },
};

/**
 * Status priority for the status engine.
 * Higher number = stronger evidence, overrides lower.
 */
export const STATUS_PRIORITY: Record<ApplicationStatus, number> = {
  unknown: 0,
  not_applied: 1,
  applied: 2,
  shortlisted: 3,
  ppt_scheduled: 4,
  test_scheduled: 5,
  interview_scheduled: 6,
  offer_received: 7,
  selected: 8,
  // Terminal states (always override)
  not_shortlisted: 9,
  declined: 9,
  withdrawn: 9,
  rejected: 9,
};
