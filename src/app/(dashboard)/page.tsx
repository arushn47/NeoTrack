import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import DashboardClient from './dashboard-client';

export const metadata = {
  title: 'Dashboard — NeoTrack',
  description: 'Your campus placement command center.',
};

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = createAdminClient();

  // Fetch stats
  const [
    { count: totalCompanies },
    { data: applications },
    { data: rawUpcomingEvents },
    { data: accounts },
    { data: user },
  ] = await Promise.all([
    supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId),
    supabase
      .from('applications')
      .select('status, company_id')
      .eq('user_id', session.userId),
    supabase
      .from('events')
      .select('id, company_id, event_type, title, start_time, end_time, venue, mode')
      .eq('user_id', session.userId)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true }),
    supabase
      .from('gmail_accounts')
      .select('id, email, account_type, is_connected, last_sync_at')
      .eq('user_id', session.userId),
    supabase
      .from('users')
      .select('neo_id')
      .eq('id', session.userId)
      .single(),
  ]);

  const stats = {
    total_companies: totalCompanies || 0,
    active_applications: 0,
    applied: 0,
    shortlisted: 0,
    not_shortlisted: 0,
    upcoming_tests: 0,
    upcoming_interviews: 0,
    rejected: 0,
    withdrawn: 0,
    selected: 0,
  };

  const activeStatuses = ['applied', 'shortlisted', 'ppt_scheduled', 'test_scheduled', 'interview_scheduled'];
  const appStatusMap = new Map<string, string>();

  if (applications) {
    for (const app of applications) {
      appStatusMap.set(app.company_id, app.status);
      if (activeStatuses.includes(app.status)) stats.active_applications++;
      if (app.status === 'applied') stats.applied++;
      if (app.status === 'shortlisted') stats.shortlisted++;
      if (app.status === 'not_shortlisted') stats.not_shortlisted++;
      if (app.status === 'rejected') stats.rejected++;
      if (app.status === 'withdrawn' || app.status === 'declined') stats.withdrawn++;
      if (app.status === 'selected') stats.selected++;
    }
  }

  // Deduplicate upcoming events by (company_id, event_type, date) and filter out eliminated companies
  const uniqueUpcomingEvents: NonNullable<typeof rawUpcomingEvents> = [];
  const seenEventKeys = new Set<string>();

  if (rawUpcomingEvents) {
    for (const event of rawUpcomingEvents) {
      const companyStatus = appStatusMap.get(event.company_id) || 'unknown';
      if (['not_shortlisted', 'rejected', 'withdrawn', 'declined'].includes(companyStatus)) {
        continue; // Skip events for companies where the user is eliminated
      }

      const dateKey = event.start_time ? event.start_time.split('T')[0] : 'no-date';
      const key = `${event.company_id}:${event.event_type}:${dateKey}`;
      if (!seenEventKeys.has(key)) {
        seenEventKeys.add(key);
        uniqueUpcomingEvents.push(event);

        if (['online_test', 'coding_test'].includes(event.event_type)) stats.upcoming_tests++;
        if (['technical_interview', 'hr_interview', 'final_interview'].includes(event.event_type)) stats.upcoming_interviews++;
      }
    }
  }

  // Only pass top 6 to DashboardClient to avoid UI clutter
  const topUpcomingEvents = uniqueUpcomingEvents.slice(0, 6);

  const hasAccounts = accounts && accounts.some((a) => a.is_connected);
  const hasNeoId = !!user?.neo_id;

  return (
    <DashboardClient
      stats={stats}
      upcomingEvents={topUpcomingEvents}
      hasAccounts={hasAccounts || false}
      hasNeoId={hasNeoId}
      neoId={user?.neo_id || null}
    />
  );
}
