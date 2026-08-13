import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import AnalyticsClient from './analytics-client';

export const metadata = {
  title: 'Analytics — NeoTrack',
  description: 'Visualize your placement journey, conversion rates, and CTC trends.',
};

export default async function AnalyticsPage() {
  const session = await requireSession();
  const supabase = createAdminClient();

  // Fetch applications and events for analytics
  const [{ data: applications }, { data: events }] = await Promise.all([
    supabase
      .from('applications')
      .select('id, company_id, status, ctc, applied_at, last_updated')
      .eq('user_id', session.userId),
    supabase
      .from('events')
      .select('id, company_id, event_type, start_time')
      .eq('user_id', session.userId)
      .order('start_time', { ascending: true }),
  ]);

  return (
    <div className="max-w-6xl mx-auto w-full p-4 md:p-6 pb-24 md:pb-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          Analytics & Insights
        </h1>
        <p className="text-sm text-zinc-400">
          Visualize your placement application funnel and trends over time.
        </p>
      </div>

      <AnalyticsClient
        applications={applications || []}
        events={events || []}
      />
    </div>
  );
}
