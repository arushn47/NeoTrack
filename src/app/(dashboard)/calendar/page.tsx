import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import CalendarClient, { type CalendarEvent } from './calendar-client';

export const metadata: Metadata = {
  title: 'Placement Calendar & Assessment Schedule',
  description: 'View upcoming PPT sessions, online assessment (OA) test dates, coding challenges, and interview schedules in an interactive calendar.',
  alternates: {
    canonical: '/calendar',
  },
};

export default async function CalendarPage() {
  const session = await requireSession();
  const supabase = createAdminClient();

  // Fetch all user events, companies, and applications
  const [
    { data: events },
    { data: companies },
    { data: applications },
  ] = await Promise.all([
    supabase
      .from('events')
      .select('id, company_id, event_type, title, start_time, end_time, venue, mode, manual_override')
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

  // Define what event types belong to which pipeline stage (in order)
  const EVENT_STAGE: Record<string, number> = {
    ppt: 1,
    online_test: 2,
    coding_test: 2,
    aptitude_test: 2,
    group_discussion: 2,
    technical_interview: 3,
    hr_interview: 3,
    interview: 3,
    final_interview: 4,
    offer: 5,
  };

  // Map application status to the highest pipeline stage the user is allowed to see events for
  const STATUS_MAX_STAGE: Record<string, number> = {
    applied: 1,            // only PPT/intro events
    ppt_scheduled: 1,      // only PPT
    shortlisted: 2,        // shortlisted for test
    test_scheduled: 2,     // can see test events, not interviews
    interview_scheduled: 3, // can see interview events
    selected: 5,
    offer_received: 5,
    rejected: 0,           // nothing (entire company excluded above)
    not_shortlisted: 0,
    not_applied: 0,
    declined: 0,
    withdrawn: 0,
  };

  const companyMap = new Map((companies || []).map((c) => [c.id, c.name]));
  const appStatusMap = new Map((applications || []).map((a) => [a.company_id, a.status]));

  const seenCalendarKeys = new Set<string>();
  const calendarEvents: CalendarEvent[] = [];

  if (events) {
    for (const evt of events) {
      const status = appStatusMap.get(evt.company_id) || 'not_applied';
      const isManual = (evt as any).manual_override;

      // Exclude eliminated, opted-out, or not-applied companies unless manually added
      if (['not_shortlisted', 'rejected', 'not_applied', 'withdrawn', 'declined'].includes(status) && !isManual) {
        continue;
      }

      // Only show events up to the user's current pipeline stage
      if (!isManual) {
        const maxStage = STATUS_MAX_STAGE[status] ?? 2;
        const evtStage = EVENT_STAGE[evt.event_type] ?? 2;
        if (evtStage > maxStage) {
          continue;
        }
      }

      // Deduplicate: 1 single timing per company stage (e.g. 1 PPT, 1 Assessment)
      const key = `${evt.company_id}:${evt.event_type}`;
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
