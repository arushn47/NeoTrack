'use client';

import { cn } from '@/lib/utils';
import {
  FileCheck2,
  Presentation,
  CheckCircle2,
  Code2,
  Users2,
  Award,
  XCircle,
  LogOut,
} from 'lucide-react';

export interface StageProgressBarProps {
  status: string;
  hasEvent?: boolean;
  nextEventTitle?: string | null;
  className?: string;
}

const STAGES = [
  { id: 'applied', label: 'Applied', icon: FileCheck2 },
  { id: 'ppt_scheduled', label: 'PPT', icon: Presentation },
  { id: 'shortlisted', label: 'Shortlist', icon: CheckCircle2 },
  { id: 'test_scheduled', label: 'Test', icon: Code2 },
  { id: 'interview_scheduled', label: 'Interview', icon: Users2 },
  { id: 'selected', label: 'Selected', icon: Award },
];

function getStageIndex(status: string): number {
  switch (status) {
    case 'applied':
      return 0;
    case 'ppt_scheduled':
      return 1;
    case 'shortlisted':
      return 2;
    case 'test_scheduled':
      return 3;
    case 'interview_scheduled':
      return 4;
    case 'selected':
    case 'offer_received':
      return 5;
    default:
      return 0;
  }
}

export default function StageProgressBar({
  status,
  hasEvent,
  nextEventTitle,
  className,
}: StageProgressBarProps) {
  const isTerminal = ['not_shortlisted', 'withdrawn', 'declined', 'rejected'].includes(status);
  const currentIndex = getStageIndex(status);

  if (status === 'not_shortlisted') {
    return (
      <div className={cn('p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs flex items-center justify-between', className)}>
        <span className="flex items-center gap-1.5 font-semibold text-rose-400">
          <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          Not Shortlisted
        </span>
        <span className="text-[11px] text-rose-400/80 font-medium">
          Eliminated in Shortlist Round
        </span>
      </div>
    );
  }

  if (status === 'withdrawn' || status === 'declined') {
    return (
      <div className={cn('p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-xs flex items-center justify-between', className)}>
        <span className="flex items-center gap-1.5 font-semibold text-zinc-400">
          <LogOut className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          Opted Out / Withdrawn
        </span>
        <span className="text-[11px] text-zinc-500 font-medium">
          Drive Inactive
        </span>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className={cn('p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs flex items-center justify-between', className)}>
        <span className="flex items-center gap-1.5 font-semibold text-red-400">
          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          Not Selected
        </span>
        <span className="text-[11px] text-red-400/80 font-medium">
          Process Concluded
        </span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2 py-1', className)}>
      {/* Visual Stepper Bar */}
      <div className="relative flex items-center justify-between">
        {/* Background track */}
        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-1 bg-border-default rounded-full z-0" />
        
        {/* Active filled track */}
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 h-1 bg-accent rounded-full transition-all duration-300 z-0"
          style={{ width: `${(currentIndex / (STAGES.length - 1)) * 100}%` }}
        />

        {/* Steps */}
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isPending = idx > currentIndex;

          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center group">
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                  isCurrent && 'bg-accent text-white ring-4 ring-accent/20 scale-110 shadow-sm shadow-accent/50',
                  isCompleted && 'bg-emerald-500 text-white',
                  isPending && 'bg-bg-elevated text-text-tertiary border border-border-default'
                )}
                title={stage.label}
              >
                {isCompleted ? (
                  '✓'
                ) : (
                  <span className="text-[9px]">{idx + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-[9px] font-semibold mt-1 whitespace-nowrap transition-colors',
                  isCurrent ? 'text-accent font-bold' : isCompleted ? 'text-emerald-400' : 'text-text-tertiary'
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stage Status Text Helper */}
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border-default/40">
        <span className="text-text-secondary font-medium">
          Stage {currentIndex + 1} of 6: <strong className="text-text-primary">{STAGES[currentIndex].label}</strong>
        </span>
        {status === 'applied' && (
          <span className="text-amber-400 font-medium">Awaiting Shortlist</span>
        )}
        {status === 'shortlisted' && (
          <span className="text-cyan-400 font-medium">Shortlisted 🎉</span>
        )}
        {status === 'test_scheduled' && (
          <span className="text-amber-400 font-medium">Test Scheduled</span>
        )}
        {status === 'interview_scheduled' && (
          <span className="text-emerald-400 font-medium">Interview Stage</span>
        )}
        {status === 'selected' && (
          <span className="text-green-400 font-bold">Offer Released!</span>
        )}
      </div>
    </div>
  );
}
