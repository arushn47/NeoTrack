import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { pushEventToGoogleCalendar } from '@/lib/calendar/google-sync';

/**
 * POST /api/calendar/push-all
 * Pushes all scheduled placement events to the user's primary Google Calendar.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [{ data: events }, { data: companies }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('user_id', session.userId)
      .order('start_time', { ascending: true }),
    supabase
      .from('companies')
      .select('id, name')
      .eq('user_id', session.userId),
  ]);

  if (!events || events.length === 0) {
    return NextResponse.json({ message: 'No events found to sync', count: 0 });
  }

  const companyMap = new Map((companies || []).map((c) => [c.id, c.name]));
  let syncedCount = 0;

  for (const evt of events) {
    if (!evt.start_time) continue;
    const compName = companyMap.get(evt.company_id) || 'Placement Event';
    const gEventId = await pushEventToGoogleCalendar({
      userId: session.userId,
      title: evt.title || `${compName} - Placement Event`,
      startTime: evt.start_time,
      endTime: evt.end_time,
      venue: evt.venue,
      mode: evt.mode,
    });

    if (gEventId) syncedCount++;
  }

  return NextResponse.json({
    success: true,
    message: `Successfully synced ${syncedCount} events directly to your Google Calendar!`,
    syncedCount,
  });
}
