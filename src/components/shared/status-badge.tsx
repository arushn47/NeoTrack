import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_COLORS } from '@/constants/statuses';
import type { ApplicationStatus } from '@/constants/statuses';

export interface StatusBadgeProps {
  status: ApplicationStatus | string;
  size?: 'sm' | 'md';
  className?: string;
  events?: Array<{
    eventType?: string;
    event_type?: string;
    startTime?: string | Date | null;
    start_time?: string | Date | null;
  }>;
}

export default function StatusBadge({ status, size = 'sm', className, events }: StatusBadgeProps) {
  const normalizedStatus = (status as ApplicationStatus) || 'unknown';
  let colors = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.unknown;
  let label = STATUS_LABELS[normalizedStatus] || 'Unknown';

  // Smart past-event awareness: If test/PPT/interview already occurred, show 'Completed'
  if (events && events.length > 0) {
    const now = new Date();
    const getEvtType = (e: { eventType?: string; event_type?: string }) =>
      (e.eventType || e.event_type || '').toLowerCase();
    const getEvtTime = (e: { startTime?: string | Date | null; start_time?: string | Date | null }) =>
      e.startTime || e.start_time;

    if (normalizedStatus === 'test_scheduled') {
      const testEvt = events.find((e) =>
        ['online_test', 'coding_test', 'assessment', 'test_scheduled'].includes(getEvtType(e))
      );
      const time = testEvt ? getEvtTime(testEvt) : null;
      if (time && new Date(time).getTime() < now.getTime()) {
        label = 'Test Completed';
        colors = {
          bg: 'bg-cyan-500/15',
          text: 'text-cyan-400',
          dot: 'bg-cyan-400',
          border: 'border-cyan-500/30',
        };
      }
    } else if (normalizedStatus === 'ppt_scheduled') {
      const pptEvt = events.find((e) => ['ppt', 'ppt_scheduled'].includes(getEvtType(e)));
      const time = pptEvt ? getEvtTime(pptEvt) : null;
      if (time && new Date(time).getTime() < now.getTime()) {
        label = 'PPT Completed';
        colors = {
          bg: 'bg-violet-500/15',
          text: 'text-violet-400',
          dot: 'bg-violet-400',
          border: 'border-violet-500/30',
        };
      }
    } else if (normalizedStatus === 'interview_scheduled') {
      const intEvt = events.find((e) =>
        ['interview', 'technical_interview', 'hr_interview', 'final_interview', 'interview_scheduled'].includes(
          getEvtType(e)
        )
      );
      const time = intEvt ? getEvtTime(intEvt) : null;
      if (time && new Date(time).getTime() < now.getTime()) {
        label = 'Interview Completed';
        colors = {
          bg: 'bg-teal-500/15',
          text: 'text-teal-400',
          dot: 'bg-teal-400',
          border: 'border-teal-500/30',
        };
      }
    }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap flex-shrink-0',
        colors.bg,
        colors.text,
        colors.border,
        'border',
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
      {label}
    </span>
  );
}
