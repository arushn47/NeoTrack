import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import DashboardClient from './dashboard-client';

export const metadata: Metadata = {
  title: 'Placement Command Center Dashboard',
  description: 'Your central hub for campus placement drives, shortlist notifications, active stages, and upcoming test schedules.',
  alternates: {
    canonical: '/',
  },
};

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = createAdminClient();

  // Fetch stats and active applications
  const [
    { count: totalCompanies },
    { data: applications },
    { data: rawUpcomingEvents },
    { data: accounts },
    { data: user },
    { data: candidateMatches },
  ] = await Promise.all([
    supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId),
    supabase
      .from('applications')
      .select('id, status, role, ctc, stipend, last_updated, company_id, companies(id, name)')
      .eq('user_id', session.userId)
      .order('last_updated', { ascending: false }),
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
    supabase
      .from('candidate_matches')
      .select('email_id, emails(company_id)')
      .eq('user_id', session.userId),
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

  const shortlistedCompanyIds = new Set(
    (candidateMatches || [])
      .map((cm: any) => cm.emails?.company_id)
      .filter(Boolean)
  );

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

  const STATUS_MAX_STAGE: Record<string, number> = {
    applied: 1,            // only PPT/intro events (cannot see tests until shortlisted!)
    ppt_scheduled: 1,      // only PPT
    shortlisted: 2,        // shortlisted for test
    test_scheduled: 2,     // can see test events, not interviews
    interview_scheduled: 3, // can see interview events
    selected: 5,
    offer_received: 5,
    rejected: 0,
    not_shortlisted: 0,
    not_applied: 0,
    declined: 0,
    withdrawn: 0,
  };

  // Deduplicate upcoming events by (company_id, event_type, date) and filter out eliminated companies
  const uniqueUpcomingEvents: NonNullable<typeof rawUpcomingEvents> = [];
  const seenEventKeys = new Set<string>();
  const nowIso = new Date().toISOString();

  if (rawUpcomingEvents) {
    for (const event of rawUpcomingEvents) {
      if (event.start_time && event.start_time < nowIso) continue;

      const companyStatus = appStatusMap.get(event.company_id) || 'unknown';

      // Registration Deadline rule:
      // Keep it in upcoming events only if user hasn't applied yet
      if (event.event_type === 'registration_deadline') {
        const hasApplied = companyStatus !== 'not_applied' && companyStatus !== 'unknown';
        if (hasApplied) continue;
      } else {
        // Skip eliminated or opted-out companies
        if (['not_shortlisted', 'rejected', 'not_applied', 'withdrawn', 'declined'].includes(companyStatus)) {
          continue;
        }

        // Only show events up to the user's current pipeline stage unless manually overridden
        if (!(event as any).manual_override) {
          const maxStage = STATUS_MAX_STAGE[companyStatus] ?? 2;
          const evtStage = EVENT_STAGE[event.event_type] ?? 2;
          if (evtStage > maxStage) {
            continue;
          }
        }
      }

      // Deduplicate: 1 single timing per event stage
      const key = `${event.company_id}:${event.event_type}`;
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

  const activeAppsList = (applications || [])
    .filter((a) => ['applied', 'shortlisted', 'test_scheduled', 'interview_scheduled', 'ppt_scheduled'].includes(a.status))
    .map((a: any) => ({
      id: a.id,
      companyId: a.company_id,
      companyName: a.companies?.name || 'Company',
      companyLogo: null,
      status: a.status,
      role: a.role,
      ctc: a.ctc,
      stipend: a.stipend,
      lastUpdated: a.last_updated,
    }));

  const connectedAccounts = (accounts || []).filter((a) => a.is_connected);
  const hasPersonalAccount = connectedAccounts.some((a) => a.account_type === 'personal');
  const hasCollegeAccount = connectedAccounts.some((a) => a.account_type === 'college');
  const disconnectedAccounts = (accounts || []).filter((a) => !a.is_connected);
  const hasNeoId = !!user?.neo_id;

  return (
    <DashboardClient
      stats={stats}
      upcomingEvents={topUpcomingEvents}
      activeApplications={activeAppsList}
      hasAccounts={hasPersonalAccount && hasCollegeAccount}
      hasPersonalAccount={hasPersonalAccount}
      hasCollegeAccount={hasCollegeAccount}
      disconnectedAccounts={disconnectedAccounts}
      hasNeoId={hasNeoId}
      neoId={user?.neo_id || null}
    />
  );
}
