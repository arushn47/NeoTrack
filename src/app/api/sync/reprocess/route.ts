import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractJobDetails } from '@/lib/sync/events';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/sync/reprocess
 * Re-evaluates ALL stored emails for the current user against current extraction & classification
 * rules to fix:
 * 1. Stale application statuses (e.g. not_applied -> applied for confirmed registrations, applied -> ppt_scheduled if PPT event exists)
 * 2. Missing or corrupted Job Details (role, category, CTC, stipend, location)
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const userId = session.userId;

  // 1. Fetch all stored emails that are linked to a company
  const { data: emails, error } = await supabase
    .from('emails')
    .select('id, company_id, subject, body_snippet, classification')
    .eq('user_id', userId)
    .not('company_id', 'is', null);

  if (error || !emails || emails.length === 0) {
    return NextResponse.json({ message: 'No emails to reprocess', fixed: 0 });
  }

  const STATUS_PRIORITY: Record<string, number> = {
    unknown: 0,
    not_applied: 1,
    applied: 2,
    shortlisted: 3,
    ppt_scheduled: 4,
    test_scheduled: 5,
    interview_scheduled: 6,
    offer_received: 7,
    selected: 8,
    not_shortlisted: 9,
    declined: 9,
    withdrawn: 10,
    rejected: 10,
  };

  let fixed = 0;
  const details: { companyId: string; subject: string; newStatus: string; role?: string | null; ctc?: string | null }[] = [];

  // 2. Group emails by company_id
  const byCompany = new Map<string, typeof emails>();
  for (const email of emails) {
    if (!email.company_id) continue;
    if (!byCompany.has(email.company_id)) byCompany.set(email.company_id, []);
    byCompany.get(email.company_id)!.push(email);
  }

  for (const [companyId, companyEmails] of byCompany.entries()) {
    // Get current application record
    const { data: app } = await supabase
      .from('applications')
      .select('status, manual_override, role, ctc, stipend, location, applied_at')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single();

    const currentStatus = app?.status || 'not_applied';
    const currentPriority = STATUS_PRIORITY[currentStatus] ?? 0;

    let bestNewStatus: string | null = null;
    let bestPriority = currentPriority;

    // Combine all email text for comprehensive job detail extraction
    const combinedEmailText = companyEmails
      .map((e) => `${e.subject || ''}\n${e.body_snippet || ''}`)
      .join('\n\n');

    // Extract updated role, CTC, stipend, location
    const extracted = extractJobDetails(combinedEmailText);

    // ─── Status Computation from Emails & Events ────────────────────────
    const hasConfirmedRegistration = companyEmails.some((e) => {
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

    const isWithdrawn = companyEmails.some((e) => {
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

    // Candidate Matches (Neo ID matched in Excel or email body)
    const { data: candidateMatches } = await supabase
      .from('candidate_matches')
      .select('id, match_type')
      .eq('user_id', userId);

    const emailIds = new Set(companyEmails.map((e) => e.id));
    const isCompanyCandidateMatched = (candidateMatches || []).some((cm) =>
      emailIds.has((cm as unknown as { email_id: string }).email_id)
    );

    // Stored Events (PPT, Test, Interview)
    const { data: storedEvents } = await supabase
      .from('events')
      .select('event_type')
      .eq('user_id', userId)
      .eq('company_id', companyId);

    const hasTestEvent = (storedEvents || []).some((e) =>
      ['online_test', 'coding_test', 'assessment'].includes(e.event_type)
    );
    const hasPptEvent = (storedEvents || []).some((e) => e.event_type === 'ppt');
    const hasInterviewEvent = (storedEvents || []).some((e) =>
      ['technical_interview', 'hr_interview', 'final_interview'].includes(e.event_type)
    );

    const hasTestOrShortlistSignal = companyEmails.some((e) => {
      const subj = (e.subject || '').toLowerCase();
      const body = (e.body_snippet || '').toLowerCase();
      const full = subj + ' ' + body;
      return (
        /test|assessment|coding|selection|shortlist|interview|round/i.test(subj) ||
        /shortlist|shortlisted candidates|initial shortlist|selection list/i.test(full)
      );
    });

    let computedStatus = 'not_applied';

    if (isWithdrawn) {
      computedStatus = 'declined';
    } else if (isCompanyCandidateMatched) {
      const isSelectionList = companyEmails.some((e) =>
        /selection\s+list|selected|congratulations.*offer/i.test(e.subject || '')
      );
      if (isSelectionList) {
        computedStatus = 'selected';
      } else if (hasInterviewEvent) {
        computedStatus = 'interview_scheduled';
      } else if (hasTestEvent) {
        computedStatus = 'test_scheduled';
      } else {
        computedStatus = 'shortlisted';
      }
    } else if (hasConfirmedRegistration) {
      if (hasTestEvent || hasInterviewEvent || hasTestOrShortlistSignal) {
        // User applied, but a test/interview/shortlist occurred and they are NOT matched
        computedStatus = 'not_shortlisted';
      } else if (hasPptEvent) {
        // PPTs are usually for all registered candidates
        computedStatus = 'ppt_scheduled';
      } else {
        computedStatus = 'applied';
      }
    } else {
      // User NEVER applied to this company — keep as not_applied
      computedStatus = 'not_applied';
    }

    // Determine final status (respect manual_override if present)
    const finalStatus = app?.manual_override ? currentStatus : computedStatus;

    // Sanitize role: fix "you are", "you have", or empty values
    let finalRole = extracted.role || app?.role || null;
    if (finalRole && /\byou\s*(?:are|have|re)\b|dear\s|greetings|eligible|registr/i.test(finalRole)) {
      finalRole = extracted.role && !/\byou\s*(?:are|have|re)\b/i.test(extracted.role) ? extracted.role : null;
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      user_id: userId,
      company_id: companyId,
      status: finalStatus,
      status_source: app?.manual_override ? 'manual_override' : 'sync_reprocess',
      status_confidence: 'high',
      last_updated: new Date().toISOString(),
    };

    if (finalRole !== undefined) updatePayload.role = finalRole;
    if (extracted.ctc) updatePayload.ctc = extracted.ctc;
    if (extracted.stipend) updatePayload.stipend = extracted.stipend;
    if (extracted.location) updatePayload.location = extracted.location;

    await supabase
      .from('applications')
      .upsert(updatePayload, { onConflict: 'user_id,company_id' });

    fixed++;
    details.push({
      companyId,
      subject: companyEmails[0].subject || '',
      newStatus: finalStatus,
      role: finalRole,
      ctc: extracted.ctc || app?.ctc,
    });
  }

  return NextResponse.json({ success: true, emailsScanned: emails.length, fixed, details });
}
