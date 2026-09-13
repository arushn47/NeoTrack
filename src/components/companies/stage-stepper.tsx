'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface StageDefinition {
  id: string;
  label: string;
  shortLabel: string;
}

export const STAGES: StageDefinition[] = [
  { id: 'applied', label: 'Applied', shortLabel: 'Applied' },
  { id: 'ppt', label: 'PPT Scheduled', shortLabel: 'PPT' },
  { id: 'test', label: 'Shortlisted for Test', shortLabel: 'Test' },
  { id: 'interview', label: 'Shortlisted for Interview', shortLabel: 'Interview' },
  { id: 'offer', label: 'Selected / Offer', shortLabel: 'Offer' },
];

export function getStageIndex(status: string): number {
  const s = (status || '').toLowerCase();
  if (['selected', 'offer', 'offer_received'].includes(s)) return 4;
  if (['interview_scheduled', 'interview', 'interview_completed'].includes(s)) return 3;
  if (['test_scheduled', 'shortlisted', 'test_completed'].includes(s)) return 2;
  if (['ppt_scheduled', 'ppt', 'ppt_completed'].includes(s)) return 1;
  return 0;
}

export interface EventLike {
  event_type?: string;
  eventType?: string;
  title?: string | null;
  start_time?: string | Date | null;
  startTime?: string | Date | null;
  end_time?: string | Date | null;
  endTime?: string | Date | null;
}

export interface EffectiveStageResult {
  stageIndex: number;
  effectiveStatus: string;
  eliminatedStage: number; // -1 if not eliminated, 0 = screening, 1 = PPT, 2 = test, 3 = interview
  furthestPassedStage: number; // index of furthest passed stage (-1 if screened out at start)
  statusSubtitle: string;
  hasPpt: boolean;
  hasTest: boolean;
  hasInterview: boolean;
  isTestCompleted: boolean;
  isPptCompleted: boolean;
  isInterviewCompleted: boolean;
}

/**
 * Derives the exact recruitment stage and elimination point by taking into account
 * application status and the company's real event timeline (PPT, Test, Interview),
 * including smart past-event awareness (Test Completed, PPT Completed).
 */
export function getEffectiveStage(
  status: string,
  latestEvent?: EventLike | null,
  events?: EventLike[] | null
): EffectiveStageResult {
  const s = (status || '').toLowerCase();

  const allEvents: EventLike[] = [
    ...(latestEvent ? [latestEvent] : []),
    ...(events || []),
  ];

  const getEvtType = (e: EventLike) =>
    `${e.event_type || e.eventType || ''} ${e.title || ''}`.toLowerCase();

  const now = new Date();
  const getEventTime = (e: EventLike) => {
    const t = e.start_time || e.startTime;
    return t ? new Date(t).getTime() : null;
  };

  const isEventPast = (e: EventLike) => {
    const endT = e.end_time || e.endTime;
    if (endT) {
      const t = new Date(endT).getTime();
      if (!isNaN(t)) return t < now.getTime();
    }
    const startT = getEventTime(e);
    return startT !== null && startT < now.getTime();
  };

  const pptEvents = allEvents.filter((e) => /ppt|pre[\s-]*placement/i.test(getEvtType(e)));
  const testEvents = allEvents.filter((e) =>
    /online_test|coding_test|assessment|test_scheduled|coding|hackerearth|mettl|shl/i.test(getEvtType(e))
  );
  const intEvents = allEvents.filter((e) => /interview/i.test(getEvtType(e)));

  const hasPpt = pptEvents.length > 0;
  const hasTest = testEvents.length > 0;
  const hasInterview = intEvents.length > 0;

  // Past event awareness: true if scheduled events have already passed in time
  const isPptCompleted = hasPpt && pptEvents.every(isEventPast);
  const isTestCompleted = hasTest && testEvents.every(isEventPast);
  const isInterviewCompleted = hasInterview && intEvents.every(isEventPast);

  // 1. Not Shortlisted: differentiate screening rejection vs post-PPT test rejection
  if (s === 'not_shortlisted') {
    if (hasPpt) {
      // PPT took place for the candidate, then candidate was not shortlisted for the test
      return {
        stageIndex: 2,
        effectiveStatus: 'not_shortlisted',
        eliminatedStage: 2,
        furthestPassedStage: 1, // Passed Applied (0) and PPT (1)
        statusSubtitle: 'Not Shortlisted for Test',
        hasPpt,
        hasTest,
        hasInterview,
        isTestCompleted,
        isPptCompleted,
        isInterviewCompleted,
      };
    } else {
      // Screened out in initial resume/CGPA screening (no PPT attended)
      return {
        stageIndex: 0,
        effectiveStatus: 'not_shortlisted',
        eliminatedStage: 0,
        furthestPassedStage: -1, // Did not pass screening
        statusSubtitle: 'Screened Out in Initial Round',
        hasPpt,
        hasTest,
        hasInterview,
        isTestCompleted,
        isPptCompleted,
        isInterviewCompleted,
      };
    }
  }

  // 2. Rejected: candidate wrote test or interviewed and was eliminated in that round
  if (s === 'rejected') {
    if (hasInterview) {
      return {
        stageIndex: 3,
        effectiveStatus: 'rejected',
        eliminatedStage: 3,
        furthestPassedStage: 2, // Passed Applied, PPT, and Test
        statusSubtitle: 'Interviewed · Not Selected',
        hasPpt,
        hasTest,
        hasInterview,
        isTestCompleted,
        isPptCompleted,
        isInterviewCompleted,
      };
    } else {
      // Wrote the test and failed
      return {
        stageIndex: 2,
        effectiveStatus: 'rejected',
        eliminatedStage: 2,
        furthestPassedStage: hasPpt ? 1 : 0,
        statusSubtitle: 'Eliminated in Test Round',
        hasPpt,
        hasTest,
        hasInterview,
        isTestCompleted,
        isPptCompleted,
        isInterviewCompleted,
      };
    }
  }

  // 3. Withdrawn / Declined
  if (s === 'withdrawn' || s === 'declined') {
    return {
      stageIndex: 0,
      effectiveStatus: s,
      eliminatedStage: 0,
      furthestPassedStage: -1,
      statusSubtitle: 'Withdrawn',
      hasPpt,
      hasTest,
      hasInterview,
      isTestCompleted,
      isPptCompleted,
      isInterviewCompleted,
    };
  }

  // 4. Not applied
  if (s === 'not_applied') {
    return {
      stageIndex: 0,
      effectiveStatus: 'not_applied',
      eliminatedStage: -1,
      furthestPassedStage: -1,
      statusSubtitle: 'Not Registered',
      hasPpt,
      hasTest,
      hasInterview,
      isTestCompleted,
      isPptCompleted,
      isInterviewCompleted,
    };
  }

  // 5. Selected / Offer
  if (['selected', 'offer', 'offer_received'].includes(s)) {
    return {
      stageIndex: 4,
      effectiveStatus: 'selected',
      eliminatedStage: -1,
      furthestPassedStage: 4,
      statusSubtitle: 'Selected · Offer Received 🎉',
      hasPpt,
      hasTest,
      hasInterview,
      isTestCompleted,
      isPptCompleted,
      isInterviewCompleted,
    };
  }

  // 6. Interview scheduled / Interview completed
  if (['interview_scheduled', 'interview', 'interview_completed'].includes(s) || hasInterview) {
    if (isInterviewCompleted || s === 'interview_completed') {
      return {
        stageIndex: 3,
        effectiveStatus: 'interview_completed',
        eliminatedStage: -1,
        furthestPassedStage: 3,
        statusSubtitle: 'Interview Completed · Results Awaited',
        hasPpt,
        hasTest,
        hasInterview,
        isTestCompleted,
        isPptCompleted,
        isInterviewCompleted: true,
      };
    }

    return {
      stageIndex: 3,
      effectiveStatus: 'interview_scheduled',
      eliminatedStage: -1,
      furthestPassedStage: 2,
      statusSubtitle: 'Shortlisted for Interview',
      hasPpt,
      hasTest,
      hasInterview,
      isTestCompleted,
      isPptCompleted,
      isInterviewCompleted,
    };
  }

  // 7. Test scheduled / Shortlisted for test / Test completed
  if (['test_scheduled', 'shortlisted', 'test_completed'].includes(s) || hasTest) {
    if (isTestCompleted || s === 'test_completed') {
      return {
        stageIndex: 2,
        effectiveStatus: 'test_completed',
        eliminatedStage: -1,
        furthestPassedStage: 2, // Test was completed! Circle 2 is marked with green tick ✓
        statusSubtitle: 'Test Completed · Awaiting Results',
        hasPpt,
        hasTest,
        hasInterview,
        isTestCompleted: true,
        isPptCompleted,
        isInterviewCompleted,
      };
    }

    return {
      stageIndex: 2,
      effectiveStatus: 'test_scheduled',
      eliminatedStage: -1,
      furthestPassedStage: hasPpt ? 1 : 0,
      statusSubtitle: 'Shortlisted for Test',
      hasPpt,
      hasTest,
      hasInterview,
      isTestCompleted,
      isPptCompleted,
      isInterviewCompleted,
    };
  }

  // 8. PPT scheduled / PPT completed
  if (['ppt_scheduled', 'ppt', 'ppt_completed'].includes(s) || hasPpt) {
    if (isPptCompleted || s === 'ppt_completed') {
      return {
        stageIndex: 1,
        effectiveStatus: 'ppt_completed',
        eliminatedStage: -1,
        furthestPassedStage: 1, // PPT was completed! Circle 1 is marked with green tick ✓
        statusSubtitle: 'PPT Completed · Test Shortlist Awaited',
        hasPpt,
        hasTest,
        hasInterview,
        isTestCompleted,
        isPptCompleted: true,
        isInterviewCompleted,
      };
    }

    return {
      stageIndex: 1,
      effectiveStatus: 'ppt_scheduled',
      eliminatedStage: -1,
      furthestPassedStage: 0,
      statusSubtitle: 'Stage 2 of 5 · PPT Scheduled',
      hasPpt,
      hasTest,
      hasInterview,
      isTestCompleted,
      isPptCompleted,
      isInterviewCompleted,
    };
  }

  // 9. Default Applied
  return {
    stageIndex: 0,
    effectiveStatus: 'applied',
    eliminatedStage: -1,
    furthestPassedStage: 0,
    statusSubtitle: 'Stage 1 of 5 · Applied',
    hasPpt,
    hasTest,
    hasInterview,
    isTestCompleted,
    isPptCompleted,
    isInterviewCompleted,
  };
}

export function getStageStatusLabel(status: string, stageIndex: number): string {
  const s = (status || '').toLowerCase();
  if (s === 'rejected') return 'Eliminated in Round';
  if (s === 'not_shortlisted') return 'Not Shortlisted';
  if (s === 'withdrawn' || s === 'declined') return 'Withdrawn';
  if (s === 'not_applied') return 'Not Registered';
  if (s === 'test_completed') return 'Test Completed';
  if (s === 'ppt_completed') return 'PPT Completed';
  if (s === 'interview_completed') return 'Interview Completed';

  switch (stageIndex) {
    case 4:
      return 'Selected · Offer Received 🎉';
    case 3:
      return 'Shortlisted for Interview';
    case 2:
      return 'Shortlisted for Test';
    case 1:
      return 'PPT Scheduled';
    case 0:
    default:
      return 'Applied · In Screening';
  }
}

export interface StageStepperProps {
  status: string;
  stage?: number;
  latestEvent?: EventLike | null;
  events?: EventLike[] | null;
  compact?: boolean;
  className?: string;
}

export function StageStepper({
  status,
  stage: stageProp,
  latestEvent,
  events,
  compact = false,
  className,
}: StageStepperProps) {
  const effective = getEffectiveStage(status, latestEvent, events);
  const currentStage = stageProp ?? effective.stageIndex;
  const eliminatedStage = effective.eliminatedStage;
  const furthestPassed = effective.furthestPassedStage;

  const isWithdrawn = (effective.effectiveStatus === 'withdrawn' || effective.effectiveStatus === 'declined');

  return (
    <div
      data-testid="stage-stepper"
      className={cn('flex items-center w-full min-w-0 select-none', className)}
    >
      {STAGES.map((s, i) => {
        const isEliminated = i === eliminatedStage;
        const isWithdrawnNode = isWithdrawn && i === 0;

        // Has this stage been passed / completed?
        const isPassed = !isEliminated && !isWithdrawn && i <= furthestPassed;

        // Is this the currently active (upcoming / in-progress) stage?
        const isCurrent =
          !isEliminated &&
          !isWithdrawn &&
          eliminatedStage === -1 &&
          i === currentStage &&
          !isPassed &&
          effective.effectiveStatus !== 'selected' &&
          effective.effectiveStatus !== 'offer';

        let displayLabel = compact ? s.shortLabel : s.label;
        if (isEliminated && i === 0) {
          displayLabel = compact ? 'Screening' : 'Screened Out';
        }

        return (
          <div key={s.id} className="flex flex-1 items-center last:flex-none min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border font-mono font-bold transition-colors shrink-0',
                  compact ? 'h-6 w-6 text-[9px]' : 'h-7 w-7 text-[10px]',
                  isPassed
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                    : isEliminated
                    ? 'border-rose-500/60 bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/30'
                    : isWithdrawnNode
                    ? 'border-zinc-700 bg-zinc-800 text-zinc-400'
                    : isCurrent
                    ? 'border-violet-500/60 bg-violet-500/15 text-violet-300 pulse-dot'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-600'
                )}
              >
                {isPassed ? '✓' : isEliminated ? '✕' : isWithdrawnNode ? '⊘' : i + 1}
              </div>
              <span
                title={s.label}
                className={cn(
                  'font-medium truncate max-w-full text-center transition-colors',
                  compact ? 'text-[9px] mt-1' : 'text-[10px] mt-1.5 hidden sm:block',
                  isPassed
                    ? 'text-emerald-300'
                    : isEliminated
                    ? 'text-rose-400 font-bold'
                    : isWithdrawnNode
                    ? 'text-zinc-500'
                    : isCurrent
                    ? 'text-violet-300 font-bold'
                    : 'text-zinc-600'
                )}
              >
                {displayLabel}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={cn(
                  'mx-1 sm:mx-1.5 h-px flex-1 transition-colors',
                  compact ? 'mb-3.5' : 'mb-0 sm:mb-4',
                  i < furthestPassed
                    ? 'bg-emerald-500/50'
                    : i === furthestPassed && eliminatedStage === i + 1
                    ? 'bg-rose-500/70'
                    : 'bg-zinc-800'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default StageStepper;
