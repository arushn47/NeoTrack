/** Application status values used throughout the system */
export const APPLICATION_STATUSES = {
  NOT_APPLIED: 'not_applied',
  APPLIED: 'applied',
  SHORTLISTED: 'shortlisted',
  PPT_SCHEDULED: 'ppt_scheduled',
  TEST_SCHEDULED: 'test_scheduled',
  TEST_COMPLETED: 'test_completed',
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
  test_completed: 'Test Completed',
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
  not_applied:          { bg: 'bg-zinc-800/40',    text: 'text-zinc-400',    dot: 'bg-zinc-500',    border: 'border-zinc-700/40' },
  applied:              { bg: 'bg-emerald-500/10', text: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border-emerald-500/25' },
  shortlisted:          { bg: 'bg-emerald-500/10', text: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border-emerald-500/25' },
  ppt_scheduled:        { bg: 'bg-emerald-500/10', text: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border-emerald-500/25' },
  test_scheduled:       { bg: 'bg-emerald-500/10', text: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border-emerald-500/25' },
  test_completed:       { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    dot: 'bg-cyan-400',    border: 'border-cyan-500/30' },
  interview_scheduled:  { bg: 'bg-emerald-500/10', text: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border-emerald-500/25' },
  selected:             { bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border-emerald-500/35' },
  rejected:             { bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-400',    border: 'border-rose-500/25' },
  not_shortlisted:      { bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-400',    border: 'border-rose-500/25' },
  withdrawn:            { bg: 'bg-zinc-800/40',    text: 'text-zinc-400',    dot: 'bg-zinc-500',    border: 'border-zinc-700/40' },
  declined:             { bg: 'bg-zinc-800/40',    text: 'text-zinc-400',    dot: 'bg-zinc-500',    border: 'border-zinc-700/40' },
  offer_received:       { bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border-emerald-500/35' },
  unknown:              { bg: 'bg-zinc-800/40',    text: 'text-zinc-400',    dot: 'bg-zinc-500',    border: 'border-zinc-700/40' },
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
  test_completed: 5,
  interview_scheduled: 6,
  offer_received: 7,
  selected: 8,
  // Terminal states (always override)
  not_shortlisted: 9,
  declined: 9,
  withdrawn: 9,
  rejected: 9,
};
