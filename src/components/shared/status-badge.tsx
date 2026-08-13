import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_COLORS } from '@/constants/statuses';
import type { ApplicationStatus } from '@/constants/statuses';

interface StatusBadgeProps {
  status: ApplicationStatus | string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
  const normalizedStatus = (status as ApplicationStatus) || 'unknown';
  const colors = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.unknown;
  const label = STATUS_LABELS[normalizedStatus] || 'Unknown';

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
