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

export const STAGE_ACTIVE_STYLES: Record<
  number,
  {
    circle: string;
    ripple: string;
    text: string;
  }
> = {
  0: { // Applied
    circle: 'border-indigo-400 bg-indigo-500/25 text-indigo-100 ring-2 ring-indigo-400/50 shadow-[0_0_14px_rgba(99,102,241,0.5)]',
    ripple: 'bg-indigo-400/40',
    text: 'text-indigo-300 font-bold',
  },
  1: { // PPT
    circle: 'border-sky-400 bg-sky-500/25 text-sky-100 ring-2 ring-sky-400/50 shadow-[0_0_14px_rgba(56,189,248,0.5)]',
    ripple: 'bg-sky-400/40',
    text: 'text-sky-300 font-bold',
  },
  2: { // Test
    circle: 'border-amber-400 bg-amber-500/25 text-amber-100 ring-2 ring-amber-400/50 shadow-[0_0_14px_rgba(245,158,11,0.5)]',
    ripple: 'bg-amber-400/40',
    text: 'text-amber-300 font-bold',
  },
  3: { // Interview
    circle: 'border-cyan-400 bg-cyan-500/25 text-cyan-100 ring-2 ring-cyan-400/50 shadow-[0_0_14px_rgba(6,182,212,0.5)]',
    ripple: 'bg-cyan-400/40',
    text: 'text-cyan-300 font-bold',
  },
  4: { // Offer
    circle: 'border-emerald-400 bg-emerald-500/30 text-emerald-100 ring-2 ring-emerald-400/60 shadow-[0_0_16px_rgba(16,185,129,0.55)]',
    ripple: 'bg-emerald-400/45',
    text: 'text-emerald-300 font-bold',
  },
};

export function getStageIndex(status: string): number {
  const s = (status || '').toLowerCase();
  if (['selected', 'offer', 'offer_received'].includes(s)) return 4;
  if (['interview_scheduled', 'interview', 'interview_completed', 'interview_ongoing'].includes(s)) return 3;
  if (['test_scheduled', 'shortlisted', 'test_completed', 'test_ongoing'].includes(s)) return 2;
  if (['ppt_scheduled', 'ppt', 'ppt_completed', 'ppt_ongoing'].includes(s)) return 1;
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
  isTestOngoing?: boolean;
  isPptOngoing?: boolean;
  isInterviewOngoing?: boolean;
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

  // Realistic placement event durations:
  // Tests / OAs typically run 120 min (2 hours).
  // Pre-Placement Talks (PPT) run ~90 min (1.5 hours).
  // Interviews run ~60 min (1 hour).
  const getEventDurationMs = (e: EventLike) => {
    const typeStr = getEvtType(e);
    if (/ppt|pre[\s-]*placement/i.test(typeStr)) return 90 * 60 * 1000;
    if (/interview/i.test(typeStr)) return 60 * 60 * 1000;
    return 120 * 60 * 1000;
  };

  const getEventEndTime = (e: EventLike) => {
    const endT = e.end_time || e.endTime;
    if (endT) {
      const t = new Date(endT).getTime();
      if (!isNaN(t)) return t;
    }
    const startT = getEventTime(e);
    if (startT !== null) {
      return startT + getEventDurationMs(e);
    }
    return null;
  };

  const isEventOngoing = (e: EventLike) => {
    const startT = getEventTime(e);
    const endT = getEventEndTime(e);
    if (startT === null || endT === null) return false;
    const nowMs = now.getTime();
    return nowMs >= startT && nowMs < endT;
  };

  const isEventPast = (e: EventLike) => {
    const endT = getEventEndTime(e);
    if (endT !== null) {
      return now.getTime() >= endT;
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

  // Ongoing event awareness: true if the event window is happening right now
  const isPptOngoing = hasPpt && pptEvents.some(isEventOngoing);
  const isTestOngoing = hasTest && testEvents.some(isEventOngoing);
  const isInterviewOngoing = hasInterview && intEvents.some(isEventOngoing);

  // Past event awareness: true only if scheduled events have completely elapsed
  const isPptCompleted = hasPpt && pptEvents.every(isEventPast);
  const isTestCompleted = hasTest && testEvents.every(isEventPast);
  const isInterviewCompleted = hasInterview && intEvents.every(isEventPast);

  // 1. Not Shortlisted: candidate applied but was not shortlisted for the test round
  if (s === 'not_shortlisted') {
    return {
      stageIndex: 2,
      effectiveStatus: 'not_shortlisted',
      eliminatedStage: 2,
      furthestPassedStage: hasPpt ? 1 : 0, // Passed Applied (0) and PPT (1 if attended)
      statusSubtitle: 'Not Shortlisted for Test',
      hasPpt,
      hasTest,
      hasInterview,
      isTestCompleted,
      isPptCompleted,
      isInterviewCompleted,
    };
  }

  // 2. Rejected / Eliminated: candidate wrote test or interviewed and was eliminated in that round
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
    } else if (hasTest || isTestCompleted) {
      // Actually wrote/participated in test and failed to qualify for next round
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
    } else {
      // No test participation or test event — candidate was screened out / not shortlisted
      return {
        stageIndex: 2,
        effectiveStatus: 'not_shortlisted',
        eliminatedStage: 2,
        furthestPassedStage: hasPpt ? 1 : 0,
        statusSubtitle: 'Not Shortlisted for Test',
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
    const passed = hasInterview ? 2 : hasTest ? 1 : 0;
    return {
      stageIndex: 0,
      effectiveStatus: s,
      eliminatedStage: -1,
      furthestPassedStage: passed,
      statusSubtitle: 'Withdrawn by Candidate',
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

  // 6. Interview scheduled / Interview ongoing / Interview completed
  if (['interview_scheduled', 'interview', 'interview_completed', 'interview_ongoing'].includes(s) || hasInterview) {
    if (isInterviewOngoing) {
      return {
        stageIndex: 3,
        effectiveStatus: 'interview_ongoing',
        eliminatedStage: -1,
        furthestPassedStage: 2,
        statusSubtitle: 'Interview in Progress · Live Now',
        hasPpt,
        hasTest,
        hasInterview,
        isTestCompleted,
        isPptCompleted,
        isInterviewCompleted: false,
        isInterviewOngoing: true,
      };
    }

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

  // 7. Test scheduled / Shortlisted for test / Test ongoing / Test completed
  if (['test_scheduled', 'shortlisted', 'test_completed', 'test_ongoing'].includes(s) || hasTest) {
    if (isTestOngoing) {
      return {
        stageIndex: 2,
        effectiveStatus: 'test_ongoing',
        eliminatedStage: -1,
        furthestPassedStage: hasPpt ? 1 : 0,
        statusSubtitle: 'Assessment in Progress · Live Now',
        hasPpt,
        hasTest,
        hasInterview,
        isTestCompleted: false,
        isPptCompleted,
        isInterviewCompleted,
        isTestOngoing: true,
      };
    }

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

  // 8. PPT scheduled / PPT ongoing / PPT completed
  if (['ppt_scheduled', 'ppt', 'ppt_completed', 'ppt_ongoing'].includes(s) || hasPpt) {
    if (isPptOngoing) {
      return {
        stageIndex: 1,
        effectiveStatus: 'ppt_ongoing',
        eliminatedStage: -1,
        furthestPassedStage: 0,
        statusSubtitle: 'Pre-Placement Talk Live Now',
        hasPpt,
        hasTest,
        hasInterview,
        isTestCompleted,
        isPptCompleted: false,
        isInterviewCompleted,
        isPptOngoing: true,
      };
    }

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
  if (s === 'interview_ongoing') return 'Interview Live Now';
  if (s === 'test_ongoing') return 'Test Live Now';
  if (s === 'ppt_ongoing') return 'PPT Live Now';
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
