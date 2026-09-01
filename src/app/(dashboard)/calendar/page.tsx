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

  // Fetch all user events, companies, applications, and candidate matches
  const [
    { data: events },
    { data: companies },
    { data: applications },
    { data: candidateMatches },
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

    supabase
      .from('candidate_matches')
      .select('email_id, emails(company_id)')
      .eq('user_id', session.userId),
  ]);

  const companyMap = new Map((companies || []).map((c) => [c.id, c.name]));
  const appStatusMap = new Map((applications || []).map((a) => [a.company_id, a.status]));
  const shortlistedCompanyIds = new Set(
    (candidateMatches || [])
      .map((cm: any) => cm.emails?.company_id)
      .filter(Boolean)
  );

  const seenCalendarKeys = new Set<string>();
  const calendarEvents: CalendarEvent[] = [];
  const now = new Date();

  if (events) {
    for (const evt of events) {
      const status = appStatusMap.get(evt.company_id) || 'not_applied';
      const isShortlistedForDrive = shortlistedCompanyIds.has(evt.company_id);
      const isManual = (evt as any).manual_override;
      const isUpcoming = evt.start_time ? new Date(evt.start_time) >= now : false;

      // Only exclude eliminated/opted-out companies if candidate was NEVER shortlisted for test AND it's not a manual/upcoming event
      if (['not_shortlisted', 'rejected', 'not_applied'].includes(status) && !isShortlistedForDrive && !isManual) {
        continue;
      }
      if (['withdrawn', 'declined'].includes(status) && !isShortlistedForDrive && !isManual && !isUpcoming) {
        continue;
      }

      const dateKey = evt.start_time ? evt.start_time.split('T')[0] : 'no-date';
      const key = `${evt.company_id}:${evt.event_type}:${dateKey}:${evt.title}`;
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
