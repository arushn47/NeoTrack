import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import DashboardClient from './dashboard-client';

export const metadata = {
  title: 'Dashboard — NeoPAT Placement Tracker',
  description: 'Your campus placement command center.',
};

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = createAdminClient();

  // Fetch stats
  const [
    { count: totalCompanies },
    { count: activeApplications },
    { count: shortlisted },
    { count: rejected },
    { count: withdrawn },
    { count: selected },
    { data: upcomingEvents },
    { data: accounts },
    { data: user },
  ] = await Promise.all([
    supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId),
    supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .in('status', ['applied', 'shortlisted', 'ppt_scheduled', 'test_scheduled', 'interview_scheduled', 'selected']),
    supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .eq('status', 'shortlisted'),
    supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .in('status', ['rejected', 'not_shortlisted']),
    supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .in('status', ['withdrawn', 'declined']),
    supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .eq('status', 'selected'),
    supabase
      .from('events')
      .select('id, company_id, event_type, title, start_time, end_time, venue, mode')
      .eq('user_id', session.userId)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(6),
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
    active_applications: activeApplications || 0,
    shortlisted: shortlisted || 0,
    upcoming_tests: 0,
    upcoming_interviews: 0,
    rejected: rejected || 0,
    withdrawn: withdrawn || 0,
    selected: selected || 0,
  };

  // Deduplicate upcoming events by (company_id, event_type, date)
  const uniqueUpcomingEvents: NonNullable<typeof upcomingEvents> = [];
  const seenEventKeys = new Set<string>();

  if (upcomingEvents) {
    for (const event of upcomingEvents) {
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

  const hasAccounts = accounts && accounts.some((a) => a.is_connected);
  const hasNeoId = !!user?.neo_id;

  return (
    <DashboardClient
      stats={stats}
      upcomingEvents={uniqueUpcomingEvents}
      hasAccounts={hasAccounts || false}
      hasNeoId={hasNeoId}
      neoId={user?.neo_id || null}
    />
  );
}
