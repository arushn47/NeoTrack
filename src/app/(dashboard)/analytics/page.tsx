import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectCampus, detectBranch } from '@/lib/utils';
import AnalyticsClient from './analytics-client';

export const metadata: Metadata = {
  title: 'Placement Radar Analytics',
  description: 'Visualize your placement conversion funnel, shortlist ratios, interview progression, and CTC offer trends.',
  alternates: {
    canonical: '/analytics',
  },
};

export default async function AnalyticsPage() {
  const session = await requireSession();
  const supabase = createAdminClient();

  // Fetch applications, events, companies, emails, candidate matches, accounts
  const [
    { data: applications },
    { data: events },
    { data: companies },
    { data: emails },
    { data: candidateMatches },
    { data: userProfile },
    { data: accounts },
  ] = await Promise.all([
    supabase
      .from('applications')
      .select('id, company_id, status, notes, ctc, stipend, category, applied_at, last_updated')
      .eq('user_id', session.userId),
    supabase
      .from('events')
      .select('id, company_id, event_type, start_time')
      .eq('user_id', session.userId)
      .order('start_time', { ascending: true }),
    supabase
      .from('companies')
      .select('id, name')
      .eq('user_id', session.userId),
    supabase
      .from('emails')
      .select('id, classification')
      .eq('user_id', session.userId),
    supabase
      .from('candidate_matches')
      .select('id')
      .eq('user_id', session.userId),
    supabase
      .from('users')
      .select('name, neo_id')
      .eq('id', session.userId)
      .maybeSingle(),
    supabase
      .from('gmail_accounts')
      .select('email, account_type')
      .eq('user_id', session.userId),
  ]);

  const collegeEmail = accounts?.find((a) => a.account_type === 'college')?.email;
  const personalEmail = accounts?.find((a) => a.account_type === 'personal')?.email || session.email;
  const campus = detectCampus(collegeEmail || personalEmail);
  const branch = detectBranch(collegeEmail);

  return (
    <div className="mx-auto max-w-6xl w-full">
      <AnalyticsClient
        applications={applications || []}
        events={events || []}
        companiesCount={companies?.length || 0}
        emailsCount={emails?.length || 0}
        matchesCount={candidateMatches?.length || 0}
        neoId={userProfile?.neo_id || null}
        campus={campus}
        branch={branch}
      />
    </div>
  );
}
