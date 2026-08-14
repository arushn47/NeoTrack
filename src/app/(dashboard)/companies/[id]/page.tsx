import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import CompanyDetailClient, { type CompanyDetail } from './company-detail-client';

export const metadata = {
  title: 'Company Details — NeoTrack',
};

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id: companyId } = await params;
  const supabase = createAdminClient();

  // Fetch company, application, events, emails, candidate matches
  const [
    { data: company },
    { data: application },
    { data: events },
    { data: emails },
    { data: candidateMatches },
  ] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, legal_name, aliases')
      .eq('id', companyId)
      .eq('user_id', session.userId)
      .single(),

    supabase
      .from('applications')
      .select('*')
      .eq('company_id', companyId)
      .eq('user_id', session.userId)
      .single(),

    supabase
      .from('events')
      .select('id, event_type, title, start_time, venue, mode')
      .eq('company_id', companyId)
      .eq('user_id', session.userId)
      .order('start_time', { ascending: false }),

    supabase
      .from('emails')
      .select('id, subject, sender, received_at, body_snippet, classification')
      .eq('company_id', companyId)
      .eq('user_id', session.userId)
      .order('received_at', { ascending: false }),

    supabase
      .from('candidate_matches')
      .select('id, match_type, matched_value, created_at')
      .eq('user_id', session.userId),
  ]);

  if (!company) {
    notFound();
  }

  // Self-heal: Check if application status, role, or CTC/stipend need upgrading
  let healedStatus = application?.status || 'not_applied';
  let healedRole = application?.role || null;
  let healedCtc = application?.ctc || null;
  let healedStipend = application?.stipend || null;
  let healedLocation = application?.location || null;
  let needsDbUpdate = false;

  // 1. Sanitize bad role string e.g. "you are"
  if (healedRole && /\byou\s*(?:are|have|re)\b|dear\s|greetings|eligible|registr/i.test(healedRole)) {
    healedRole = null;
    needsDbUpdate = true;
  }

  // 2. Extract fresh job details from emails if role/ctc/stipend are missing
  if (emails && emails.length > 0 && (!healedRole || !healedCtc || !healedStipend)) {
    const { extractJobDetails } = await import('@/lib/sync/events');
    const combinedEmailText = emails
      .map((e) => `${e.subject || ''}\n${e.body_snippet || ''}`)
      .join('\n\n');
    const extracted = extractJobDetails(combinedEmailText);

    if (!healedRole && extracted.role) {
      healedRole = extracted.role;
      needsDbUpdate = true;
    }
    if (!healedCtc && extracted.ctc) {
      healedCtc = extracted.ctc;
      needsDbUpdate = true;
    }
    if (!healedStipend && extracted.stipend) {
      healedStipend = extracted.stipend;
      needsDbUpdate = true;
    }
    if (!healedLocation && extracted.location) {
      healedLocation = extracted.location;
      needsDbUpdate = true;
    }
  }

  // 3. Upgrade status if events exist and user didn't manually override
  if (!application?.manual_override && events && events.length > 0) {
    const EVENT_STATUS_MAP: Record<string, string> = {
      ppt: 'ppt_scheduled',
      online_test: 'test_scheduled',
      coding_test: 'test_scheduled',
      technical_interview: 'interview_scheduled',
      hr_interview: 'interview_scheduled',
      final_interview: 'interview_scheduled',
    };
    const EVENT_PRIORITY: Record<string, number> = {
      ppt: 4, online_test: 5, coding_test: 5,
      technical_interview: 6, hr_interview: 6, final_interview: 6,
    };
    const STATUS_PRIORITY: Record<string, number> = {
      unknown: 0, not_applied: 1, applied: 2, shortlisted: 3,
      ppt_scheduled: 4, test_scheduled: 5, interview_scheduled: 6,
      offer_received: 7, selected: 8, not_shortlisted: 9,
      declined: 9, withdrawn: 10, rejected: 10,
    };

    let currentPri = STATUS_PRIORITY[healedStatus] ?? 0;
    for (const e of events) {
      const target = EVENT_STATUS_MAP[e.event_type];
      const pri = EVENT_PRIORITY[e.event_type] ?? 0;
      if (target && pri > currentPri && !['withdrawn', 'declined', 'rejected', 'selected'].includes(healedStatus)) {
        healedStatus = target;
        currentPri = pri;
        needsDbUpdate = true;
      }
    }
  }

  // Write healing update back to DB asynchronously if changes were made
  if (needsDbUpdate && application) {
    await supabase
      .from('applications')
      .update({
        status: healedStatus,
        role: healedRole,
        ctc: healedCtc,
        stipend: healedStipend,
        location: healedLocation,
        last_updated: new Date().toISOString(),
      })
      .eq('id', application.id);
  }

  const detail: CompanyDetail = {
    id: company.id,
    name: company.name,
    legalName: company.legal_name,
    aliases: company.aliases,
    application: application
      ? {
          id: application.id,
          status: healedStatus,
          statusSource: application.status_source,
          statusConfidence: application.status_confidence,
          role: healedRole,
          ctc: healedCtc,
          stipend: healedStipend,
          location: healedLocation,
          eligibility: application.eligibility,
          manualOverride: application.manual_override,
          notes: application.notes,
          appliedAt: application.applied_at,
          lastUpdated: application.last_updated,
        }
      : null,
    events: (events || []).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      title: e.title,
      startTime: e.start_time,
      venue: e.venue,
      mode: e.mode,
    })),
    emails: (emails || []).map((em) => ({
      id: em.id,
      subject: em.subject,
      sender: em.sender,
      receivedAt: em.received_at,
      snippet: em.body_snippet,
      classification: em.classification,
    })),
    candidateMatches: (candidateMatches || []).map((cm) => ({
      id: cm.id,
      matchType: cm.match_type,
      matchedValue: cm.matched_value,
      createdAt: cm.created_at,
    })),
  };

  return <CompanyDetailClient company={detail} />;
}
