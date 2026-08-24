import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import CalendarClient, { type CalendarEvent } from './calendar-client';

export const metadata = {
  title: 'Calendar — NeoTrack',
  description: 'View upcoming placement talks, online assessments, and interview schedules.',
};

export default async function CalendarPage() {
  const session = await requireSession();
  const supabase = createAdminClient();

  // Fetch all user events, companies, and applications
  const [{ data: events }, { data: companies }, { data: applications }] = await Promise.all([
    supabase
      .from('events')
      .select('id, company_id, event_type, title, start_time, end_time, venue, mode')
      .eq('user_id', session.userId)
      .order('start_time', { ascending: true }),

    supabase
      .from('companies')
      .select('id, name')
      .eq('user_id', session.userId),

    supabase
      .from('applications')
      .select('company_id, status')
      .eq('user_id', session.userId),
  ]);

  const companyMap = new Map((companies || []).map((c) => [c.id, c.name]));
  const appStatusMap = new Map((applications || []).map((a) => [a.company_id, a.status]));
  const seenCalendarKeys = new Set<string>();
  const calendarEvents: CalendarEvent[] = [];

  if (events) {
    for (const evt of events) {
      const status = appStatusMap.get(evt.company_id) || 'not_applied';

      // Only show events for companies where user is actively participating/shortlisted
      // Exclude eliminated (not_shortlisted, rejected), opted out (withdrawn, declined), or not applied
      if (['not_shortlisted', 'rejected', 'withdrawn', 'declined', 'not_applied'].includes(status)) {
        continue;
      }

      const dateKey = evt.start_time ? evt.start_time.split('T')[0] : 'no-date';
      const key = `${evt.company_id}:${evt.event_type}:${dateKey}`;
      if (!seenCalendarKeys.has(key)) {
        seenCalendarKeys.add(key);
        calendarEvents.push({
          id: evt.id,
          companyId: evt.company_id,
          companyName: companyMap.get(evt.company_id) || 'Placement Drive',
          eventType: evt.event_type,
          title: evt.title,
          startTime: evt.start_time,
          endTime: evt.end_time,
          venue: evt.venue,
          mode: evt.mode,
        });
      }
    }
  }

  return <CalendarClient events={calendarEvents} />;
}
