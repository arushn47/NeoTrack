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
      .select('id, match_type, matched_value, created_at, email_id')
      .eq('user_id', session.userId),
  ]);

  if (!company) {
    notFound();
  }

  // Filter candidate matches to only those belonging to this company's emails
  const companyEmailIds = new Set((emails || []).map((e) => e.id));
  const companyCandidateMatches = (candidateMatches || []).filter((cm) =>
    companyEmailIds.has((cm as { email_id?: string }).email_id || '')
  );

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

  // 2. Extract fresh job details from emails to ensure accurate role/ctc/stipend
  if (emails && emails.length > 0) {
    const { extractJobDetails } = await import('@/lib/sync/events');
    const combinedEmailText = emails
      .map((e) => `${e.subject || ''}\n${e.body_snippet || ''}`)
      .join('\n\n');
    const extracted = extractJobDetails(combinedEmailText);

    if (extracted.role && healedRole !== extracted.role) {
      healedRole = extracted.role;
      needsDbUpdate = true;
    }
    if (extracted.ctc !== healedCtc) {
      healedCtc = extracted.ctc;
      needsDbUpdate = true;
    }
    if (extracted.stipend !== healedStipend) {
      healedStipend = extracted.stipend;
      needsDbUpdate = true;
    }
    if (extracted.location && healedLocation !== extracted.location) {
      healedLocation = extracted.location;
      needsDbUpdate = true;
    }
  }

  // 3. Status self-healing based on registration, withdrawals, events, and candidate matches
  const hasConfirmedRegistration = (emails || []).some((e) => {
    const subj = (e.subject || '').toLowerCase();
    const body = (e.body_snippet || '').toLowerCase();
    const full = subj + ' ' + body;
    return (
      e.classification === 'registration_confirmation' ||
      /confirmed:\s*your\s+registration/i.test(subj) ||
      /registration\s+(confirmed|successful|received)/i.test(full) ||
      /successfully\s+registered|thank\s+you\s+for\s+(registering|applying)/i.test(full) ||
      /confirms?\s+(that\s+)?(you(r|'re)|your)\s+(successful\s+)?(registration|application)/i.test(full)
    );
  });

  const isWithdrawn = (emails || []).some((e) => {
    const subj = (e.subject || '').toLowerCase();
    const body = (e.body_snippet || '').toLowerCase();
    const full = subj + ' ' + body;
    return (
      e.classification === 'withdrawal' ||
      e.classification === 'decline' ||
      /registration.*has been withdrawn|your registration.*withdrawn/i.test(full) ||
      (/confirmation.*drive\s+registration\s+update/i.test(subj) && /withdrawn/i.test(full))
    );
  });

  const hasExplicitShortlistSignal = (emails || []).some((e) => {
    const subj = (e.subject || '').toLowerCase();
    const full = subj + ' ' + (e.body_snippet || '').toLowerCase();
    const isExplicitShortlist = /shortlist|selection\s+list|selected\s+candidates/i.test(subj) ||
                                /shortlist|shortlisted candidates|initial shortlist|selection list/i.test(full);
    const isShortlistClass = e.classification === 'shortlist';
    return isExplicitShortlist || isShortlistClass;
  });

  const hasCandidateMatch = companyCandidateMatches.length > 0;

  if (!application?.manual_override) {
    if (isWithdrawn && healedStatus !== 'declined' && healedStatus !== 'withdrawn') {
      healedStatus = 'declined';
      needsDbUpdate = true;
    } else if (hasCandidateMatch) {
      const isSelectionList = (emails || []).some((e) =>
        /selection\s+list|selected|congratulations.*offer/i.test(e.subject || '')
      );
      const hasInterviewEvent = (events || []).some(e => ['technical_interview', 'hr_interview', 'final_interview'].includes(e.event_type));
      const hasTestEvent = (events || []).some(e => ['online_test', 'coding_test', 'assessment'].includes(e.event_type));

      let target = 'shortlisted';
      if (isSelectionList) target = 'selected';
      else if (hasInterviewEvent) target = 'interview_scheduled';
      else if (hasTestEvent) target = 'test_scheduled';

      if (healedStatus !== target) {
        healedStatus = target;
        needsDbUpdate = true;
      }
    } else if (!hasConfirmedRegistration && healedStatus !== 'not_applied') {
      // User NEVER applied to this company!
      healedStatus = 'not_applied';
      needsDbUpdate = true;
    } else if (hasConfirmedRegistration) {
      const hasInterviewEvent = (events || []).some(e => ['technical_interview', 'hr_interview', 'final_interview'].includes(e.event_type));
      const hasTestEvent = (events || []).some(e => ['online_test', 'coding_test', 'assessment'].includes(e.event_type));
      const hasPptEvent = (events || []).some(e => e.event_type === 'ppt');

      let target = 'applied';
      if (hasExplicitShortlistSignal) {
        target = 'not_shortlisted';
      } else if (hasInterviewEvent) {
        target = 'interview_scheduled';
      } else if (hasTestEvent) {
        target = 'test_scheduled';
      } else if (hasPptEvent) {
        target = 'ppt_scheduled';
      }

      if (healedStatus !== target && !['withdrawn', 'declined', 'rejected', 'selected'].includes(healedStatus)) {
        healedStatus = target;
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
    candidateMatches: companyCandidateMatches.map((cm) => ({
      id: cm.id,
      matchType: cm.match_type,
      matchedValue: cm.matched_value,
      createdAt: cm.created_at,
    })),
  };

  return <CompanyDetailClient company={detail} />;
}
