import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { reconcileUserGoogleCalendar } from '@/lib/calendar/google-sync';

/**
 * POST /api/calendar/push-all
 * Triggers full reconciliation between user's NeoTrack schedule and Google Calendar:
 * - Deletes stale, withdrawn, rejected, and deadline events from Google Calendar.
 * - Updates active matching events in-place.
 * - Inserts missing eligible placement events (PPTs, Tests, Interviews).
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await reconcileUserGoogleCalendar(session.userId);

    if (!result.success && result.error === 'no_calendar_auth') {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Calendar push-all reconciliation error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to reconcile Google Calendar' },
      { status: 500 }
    );
  }
}
