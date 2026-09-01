'use client';

import { cn } from '@/lib/utils';
import {
  FileCheck2,
  Presentation,
  Code2,
  Users2,
  Award,
  XCircle,
  LogOut,
} from 'lucide-react';

export interface CompanyEventSummary {
  id: string;
  event_type?: string;
  eventType?: string;
  title: string | null;
  start_time?: string | null;
  startTime?: string | null;
  venue?: string | null;
}

export interface StageProgressBarProps {
  status: string;
  events?: CompanyEventSummary[];
  className?: string;
  interactive?: boolean;
  onStageClick?: (stageIndex: number, stageId: string, suggestedStatus: string) => void;
}

const STAGES = [
  { id: 'applied', label: 'Applied', icon: FileCheck2, suggestedStatus: 'applied' },
  { id: 'ppt', label: 'PPT', icon: Presentation, suggestedStatus: 'ppt_scheduled' },
  { id: 'test', label: 'Online Test', icon: Code2, suggestedStatus: 'test_scheduled' },
  { id: 'interview', label: 'Interview', icon: Users2, suggestedStatus: 'interview_scheduled' },
  { id: 'selected', label: 'Selected', icon: Award, suggestedStatus: 'selected' },
];

export default function StageProgressBar({
  status,
  events = [],
  className,
  interactive = false,
  onStageClick,
}: StageProgressBarProps) {
  // Helper getters for event properties
  const getEventType = (e: CompanyEventSummary) => (e.event_type || e.eventType || '').toLowerCase();
  const getStartTime = (e: CompanyEventSummary) => e.start_time || e.startTime || null;

  const handleNodeClick = (idx: number, stage: typeof STAGES[0]) => {
    if (interactive && onStageClick) {
      onStageClick(idx, stage.id, stage.suggestedStatus);
    }
  };

  // 1. Handle Negative Terminal States
  if (status === 'withdrawn' || status === 'declined') {
    return (
      <div className={cn('p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs flex items-center justify-between', className)}>
        <span className="flex items-center gap-2 font-semibold text-zinc-400">
          <LogOut className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          Opted Out / Declined
        </span>
        {interactive && (
          <span className="text-[11px] text-indigo-400 font-medium cursor-pointer hover:underline" onClick={() => onStageClick?.(0, 'applied', 'applied')}>
            Click to re-activate stage ›
          </span>
        )}
        {!interactive && (
          <span className="text-[11px] text-zinc-500 font-medium">
            Drive Inactive
          </span>
        )}
      </div>
    );
  }

  // 2. Event Analysis (Checking if PPT or Test already occurred)
  const now = new Date();
  const testEvent = events.find((e) =>
    ['online_test', 'coding_test', 'assessment', 'test_scheduled'].includes(getEventType(e))
  );
  const pptEvent = events.find((e) => ['ppt', 'ppt_scheduled'].includes(getEventType(e)));
  const interviewEvent = events.find((e) =>
    ['interview', 'technical_interview', 'hr_interview', 'final_interview', 'interview_scheduled'].includes(
      getEventType(e)
    )
  );

  if (status === 'rejected' || status === 'not_shortlisted') {
    let furthestIdx = 0;
    let eliminatedIdx = 1;
    let eliminatedText = '';

    if (status === 'rejected') {
      if (interviewEvent) {
        furthestIdx = 2; // Passed applied, ppt, test
        eliminatedIdx = 3; // Failed interview
        eliminatedText = 'Interviewed · Not Selected';
      } else {
        furthestIdx = 1; // Passed applied & ppt
        eliminatedIdx = 2; // Failed online test
        eliminatedText = 'Wrote Test · Did Not Qualify';
      }
    } else {
      furthestIdx = 0; // Passed applied only
      eliminatedIdx = 1; // Screened out at shortlist / PPT round
      eliminatedText = 'Out at Shortlist Round';
    }

    return (
      <div className={cn('space-y-2.5 py-1', className)}>
        {/* Visual Stepper Bar with Red X at Elimination Stage */}
        <div className="relative flex items-center justify-between px-1">
          <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1 bg-zinc-800 rounded-full z-0" />
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 h-1 bg-rose-500/80 rounded-full z-0 transition-all duration-300"
            style={{ width: `${eliminatedIdx * 25}%` }}
          />

          {STAGES.map((stage, idx) => {
            const isEliminated = idx === eliminatedIdx;
            const isPassed = idx <= furthestIdx && !isEliminated;

            return (
              <div
                key={stage.id}
                onClick={() => handleNodeClick(idx, stage)}
                className={cn(
                  'relative z-10 flex flex-col items-center group',
                  interactive && 'cursor-pointer select-none'
                )}
                title={interactive ? `Click to set stage to ${stage.label}` : stage.label}
              >
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200',
                    isPassed && 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
                    isEliminated
                      ? 'bg-rose-500 text-white ring-4 ring-rose-500/20 scale-110 shadow-sm shadow-rose-500/50'
                      : !isPassed && 'bg-bg-elevated text-text-tertiary border border-border-default',
                    interactive && 'group-hover:scale-125 group-hover:ring-4 group-hover:ring-indigo-500/40'
                  )}
                >
                  {isPassed ? '✓' : isEliminated ? '✕' : idx + 1}
                </div>
                <span
                  className={cn(
                    'text-[9px] font-semibold mt-1 whitespace-nowrap transition-colors',
                    isPassed ? 'text-emerald-400 font-medium' : isEliminated ? 'text-rose-400 font-bold' : 'text-text-tertiary',
                    interactive && 'group-hover:text-white'
                  )}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border-default/40">
          <span className="text-rose-400 font-semibold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            {status === 'rejected' ? 'Eliminated in Test' : 'Not Shortlisted'}
          </span>
          <span className="text-[11px] text-text-secondary font-medium">
            {eliminatedText}
          </span>
        </div>
      </div>
    );
  }

  if (status === 'not_applied') {
    return (
      <div className={cn('p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs flex items-center justify-between', className)}>
        <span className="flex items-center gap-2 font-semibold text-zinc-400">
          <Presentation className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          Drive Announced
        </span>
        {interactive ? (
          <span className="text-[11px] text-indigo-400 font-medium cursor-pointer hover:underline" onClick={() => onStageClick?.(0, 'applied', 'applied')}>
            Click to mark Applied ›
          </span>
        ) : (
          <span className="text-[11px] text-zinc-500 font-medium">
            Not Applied
          </span>
        )}
      </div>
    );
  }

  const rawTestTime = testEvent ? getStartTime(testEvent) : null;
  const testStartTime = rawTestTime ? new Date(rawTestTime) : null;
  const isTestInPast = testStartTime ? testStartTime.getTime() < now.getTime() : false;

  // Determine stage states based on application status directly
  let currentStageIndex = 0;
  let stageStatusText = 'Applied · In Screening';

  switch (status) {
    case 'selected':
    case 'offer_received':
      currentStageIndex = 4;
      stageStatusText = '🎉 Offer Received!';
      break;
    case 'interview_scheduled':
      currentStageIndex = 3;
      stageStatusText = 'Interview Stage';
      break;
    case 'shortlisted':
    case 'test_scheduled':
      currentStageIndex = 2;
      if (isTestInPast) {
        stageStatusText = 'Test Completed · Awaiting Results';
      } else if (testStartTime) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = months[testStartTime.getMonth()];
        const day = testStartTime.getDate();
        let hours = testStartTime.getHours();
        const minutes = String(testStartTime.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hourStr = String(hours).padStart(2, '0');
        stageStatusText = `Test: ${monthName} ${day} @ ${hourStr}:${minutes} ${ampm}`;
      } else {
        stageStatusText = 'Shortlisted for Test 🎉';
      }
      break;
    case 'ppt_scheduled':
      currentStageIndex = 1;
      stageStatusText = 'PPT Scheduled';
      break;
    case 'applied':
      currentStageIndex = 0;
      stageStatusText = 'Applied · In Screening';
      break;
    default:
      // Fallback: infer from detected events if status is generic
      if (interviewEvent) {
        currentStageIndex = 3;
        stageStatusText = 'Interview Stage';
      } else if (testEvent) {
        currentStageIndex = 2;
        stageStatusText = isTestInPast ? 'Test Completed' : 'Test Scheduled';
      } else if (pptEvent) {
        currentStageIndex = 1;
        stageStatusText = 'PPT Scheduled';
      } else {
        currentStageIndex = 0;
        stageStatusText = 'Applied · In Screening';
      }
      break;
  }

  return (
    <div className={cn('space-y-2.5 py-1', className)}>
      {/* Visual Stepper Bar */}
      <div className="relative flex items-center justify-between px-1">
        {/* Background track */}
        <div className="absolute top-1/2 left-3 right-3 h-1 -translate-y-1/2 bg-zinc-800 rounded-full z-0" />

        {/* Active progress track */}
        <div
          className="absolute top-1/2 left-3 h-1 -translate-y-1/2 bg-indigo-500 rounded-full transition-all duration-500 z-0"
          style={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
        />

        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          const isPending = idx > currentStageIndex;

          return (
            <div
              key={stage.id}
              onClick={() => handleNodeClick(idx, stage)}
              className={cn(
                'relative z-10 flex flex-col items-center group',
                interactive && 'cursor-pointer select-none'
              )}
              title={interactive ? `Click to set stage to ${stage.label}` : stage.label}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200',
                  isCurrent && 'bg-indigo-600 text-white ring-4 ring-indigo-500/25 scale-110 shadow-md shadow-indigo-600/40',
                  isCompleted && 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
                  isPending && 'bg-[#181824] text-zinc-400 border border-zinc-700 hover:border-zinc-500',
                  interactive && 'group-hover:scale-125 group-hover:ring-4 group-hover:ring-indigo-500/40'
                )}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span
                className={cn(
                  'text-[9px] font-semibold mt-1 whitespace-nowrap transition-colors',
                  isCurrent
                    ? 'text-indigo-400 font-bold'
                    : isCompleted
                    ? 'text-emerald-400 font-medium'
                    : 'text-zinc-500',
                  interactive && 'group-hover:text-white'
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stage Context Text Helper */}
      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-800/80">
        <span className="text-zinc-400 font-medium">
          Stage {currentStageIndex + 1} of 5:{' '}
          <strong className="text-white">{STAGES[currentStageIndex].label}</strong>
        </span>
        <span
          suppressHydrationWarning
          className={cn(
            'font-semibold text-[11px]',
            isTestInPast && currentStageIndex === 2
              ? 'text-cyan-400'
              : status === 'shortlisted'
              ? 'text-indigo-400'
              : status === 'selected'
              ? 'text-green-400'
              : 'text-amber-400'
          )}
        >
          {stageStatusText}
        </span>
      </div>
    </div>
  );
}
