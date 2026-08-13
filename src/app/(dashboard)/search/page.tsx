import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SearchClient, { type SearchData } from './search-client';

export const metadata = {
  title: 'Search — NeoTrack',
  description: 'Search across companies, emails, job roles, tests, and interview schedules.',
};

export default async function SearchPage() {
  const session = await requireSession();
  const supabase = createAdminClient();

  // Fetch all companies, applications, emails, and events
  const [
    { data: companies },
    { data: applications },
    { data: emails },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name')
      .eq('user_id', session.userId),

    supabase
      .from('applications')
      .select('company_id, role, status, ctc, location')
      .eq('user_id', session.userId),

    supabase
      .from('emails')
      .select('id, subject, sender, received_at, body_snippet, company_id')
      .eq('user_id', session.userId)
      .order('received_at', { ascending: false })
      .limit(100),

    supabase
      .from('events')
      .select('id, title, event_type, start_time, venue, company_id')
      .eq('user_id', session.userId)
      .order('start_time', { ascending: false })
      .limit(50),
  ]);

  const companyMap = new Map((companies || []).map((c) => [c.id, c.name]));
  const appMap = new Map((applications || []).map((a) => [a.company_id, a]));

  const searchData: SearchData = {
    companies: (companies || []).map((c) => {
      const app = appMap.get(c.id);
      return {
        id: c.id,
        name: c.name,
        role: app?.role || null,
        status: app?.status || 'applied',
        ctc: app?.ctc || null,
        location: app?.location || null,
      };
    }),
    emails: (emails || []).map((em) => ({
      id: em.id,
      subject: em.subject,
      sender: em.sender,
      receivedAt: em.received_at,
      companyId: em.company_id,
      companyName: em.company_id ? companyMap.get(em.company_id) || null : null,
      snippet: em.body_snippet,
    })),
    events: (events || []).map((ev) => ({
      id: ev.id,
      title: ev.title,
      eventType: ev.event_type,
      startTime: ev.start_time,
      venue: ev.venue,
      companyId: ev.company_id,
      companyName: companyMap.get(ev.company_id) || 'Placement Drive',
    })),
  };

  return <SearchClient data={searchData} />;
}
