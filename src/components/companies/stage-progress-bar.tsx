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
}

const STAGES = [
  { id: 'applied', label: 'Applied', icon: FileCheck2 },
  { id: 'ppt', label: 'PPT', icon: Presentation },
  { id: 'test', label: 'Online Test', icon: Code2 },
  { id: 'interview', label: 'Interview', icon: Users2 },
  { id: 'selected', label: 'Selected', icon: Award },
];

export default function StageProgressBar({
  status,
  events = [],
  className,
}: StageProgressBarProps) {
  // 1. Handle Negative Terminal States
  if (status === 'not_shortlisted') {
    return (
      <div className={cn('p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs flex items-center justify-between', className)}>
        <span className="flex items-center gap-1.5 font-semibold text-rose-400">
          <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          Not Shortlisted
        </span>
        <span className="text-[11px] text-rose-400/80 font-medium">
          Eliminated in Test Shortlist
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

  // Helper getters for event properties
  const getEventType = (e: CompanyEventSummary) => (e.event_type || e.eventType || '').toLowerCase();
  const getStartTime = (e: CompanyEventSummary) => e.start_time || e.startTime || null;

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

  const rawTestTime = testEvent ? getStartTime(testEvent) : null;
  const testStartTime = rawTestTime ? new Date(rawTestTime) : null;
  const isTestInPast = testStartTime ? testStartTime.getTime() < now.getTime() : false;

  // Determine stage states
  let currentStageIndex = 0;
  let stageStatusText = 'Awaiting Test Shortlist';

  if (status === 'selected' || status === 'offer_received') {
    currentStageIndex = 4;
    stageStatusText = '🎉 Offer Received!';
  } else if (status === 'interview_scheduled' || interviewEvent) {
    currentStageIndex = 3;
    stageStatusText = 'Interview Stage';
  } else if (status === 'shortlisted' || status === 'test_scheduled' || testEvent) {
    if (isTestInPast) {
      // Test time has ended -> Test is Completed (wrote test), now waiting for interview shortlist!
      currentStageIndex = 3; // Active on Interview stage
      stageStatusText = 'Test Completed · Awaiting Results';
    } else {
      // Test is upcoming
      currentStageIndex = 2; // Active on Test stage
      stageStatusText = testStartTime
        ? `Test: ${testStartTime.toLocaleDateString([], { month: 'short', day: 'numeric' })} @ ${testStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Shortlisted for Test 🎉';
    }
  } else if (status === 'ppt_scheduled' || pptEvent) {
    currentStageIndex = 1;
    stageStatusText = 'PPT Scheduled';
  } else {
    currentStageIndex = 0;
    stageStatusText = 'Applied · Awaiting Shortlist';
  }

  return (
    <div className={cn('space-y-2 py-1', className)}>
      {/* Visual Stepper Bar */}
      <div className="relative flex items-center justify-between px-1">
        {/* Background track */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1 bg-border-default rounded-full z-0" />

        {/* Active filled track */}
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-accent to-cyan-400 rounded-full transition-all duration-300 z-0"
          style={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
        />

        {/* Steps */}
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          const isPending = idx > currentStageIndex;

          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center group">
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                  isCurrent && 'bg-accent text-white ring-4 ring-accent/20 scale-110 shadow-sm shadow-accent/50 animate-pulse',
                  isCompleted && 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
                  isPending && 'bg-bg-elevated text-text-tertiary border border-border-default'
                )}
                title={stage.label}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span
                className={cn(
                  'text-[9px] font-semibold mt-1 whitespace-nowrap transition-colors',
                  isCurrent
                    ? 'text-accent font-bold'
                    : isCompleted
                    ? 'text-emerald-400 font-medium'
                    : 'text-text-tertiary'
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stage Context Text Helper */}
      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border-default/40">
        <span className="text-text-secondary font-medium">
          Stage {currentStageIndex + 1} of 5:{' '}
          <strong className="text-text-primary">{STAGES[currentStageIndex].label}</strong>
        </span>
        <span
          className={cn(
            'font-semibold text-[11px]',
            isTestInPast && currentStageIndex === 3
              ? 'text-cyan-400'
              : status === 'shortlisted'
              ? 'text-accent'
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
