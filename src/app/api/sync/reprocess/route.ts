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

    // Fetch user's configured Neo ID
    const { data: userData } = await supabase
      .from('users')
      .select('neo_id')
      .eq('id', userId)
      .single();
    const userNeoId = userData?.neo_id || null;

    // Candidate Matches (Neo ID matched in Excel or email body)
    const { data: candidateMatches } = await supabase
      .from('candidate_matches')
      .select('id, match_type, email_id')
      .eq('user_id', userId);

    const emailIds = new Set(companyEmails.map((e) => e.id));
    let isCompanyCandidateMatched = (candidateMatches || []).some((cm) =>
      emailIds.has((cm as unknown as { email_id: string }).email_id)
    );

    // Also check if userNeoId appears directly in any email subject or body_snippet
    if (!isCompanyCandidateMatched && userNeoId && userNeoId.length >= 4) {
      const cleanNeo = userNeoId.toUpperCase().trim();
      for (const e of companyEmails) {
        const text = `${e.subject || ''} ${e.body_snippet || ''}`.toUpperCase();
        if (text.includes(cleanNeo)) {
          isCompanyCandidateMatched = true;
          // Persist candidate match
          await supabase.from('candidate_matches').insert({
            user_id: userId,
            email_id: e.id,
            neo_id: userNeoId,
            match_type: 'email_body',
            matched_value: `Found ${userNeoId} in email body`,
            confidence: 'high',
          });
          break;
        }
      }
    }

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

    // Post-test progression signals (interviews, next rounds, selection lists)
    const hasPostTestProgressionSignal = companyEmails.some((e) => {
      const subj = (e.subject || '').toLowerCase();
      const full = subj + ' ' + (e.body_snippet || '').toLowerCase();
      return (
        e.classification === 'interview' ||
        /interview\s+(?:is\s+)?scheduled|technical\s+interview|hr\s+interview|final\s+interview/i.test(subj) ||
        /next\s+round\s+of\s+selection|next\s+round\s+is\s+scheduled/i.test(subj) ||
        /selection\s+list|final\s+shortlist|congratulations.*(?:selection\s+list|selects)/i.test(subj) ||
        /interview\s+shortlist|shortlist\s+for\s+interview/i.test(full) ||
        /next\s+round\s+shortlist|shortlisted\s+for\s+next\s+round|shortlisted\s+for\s+(?:the\s+)?interview/i.test(full)
      );
    });

    // General shortlist / screening signal (including initial screening lists)
    const hasExplicitShortlistSignal = companyEmails.some((e) => {
      const subj = (e.subject || '').toLowerCase();
      const full = subj + ' ' + (e.body_snippet || '').toLowerCase();
      return (
        /shortlist|selection\s+list|selected\s+candidates|students\s+list|shortlisted\s+students/i.test(subj) ||
        /shortlist|shortlisted candidates|initial shortlist|selection list|students list|shortlisted students|attached list of students/i.test(full) ||
        e.classification === 'shortlist'
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
      if (hasTestEvent || hasInterviewEvent) {
        // Candidate had a test or interview scheduled:
        if (hasPostTestProgressionSignal) {
          // A subsequent round (interview, next round, or final selection list) was released,
          // and candidate was not matched -> rejected
          computedStatus = 'rejected';
        } else {
          // Test/Interview results are not out yet -> Keep waiting in test_scheduled / interview_scheduled!
          computedStatus = hasInterviewEvent ? 'interview_scheduled' : 'test_scheduled';
        }
      } else if (hasExplicitShortlistSignal || hasPostTestProgressionSignal) {
        // Candidate never had a test scheduled and a shortlist was released -> not shortlisted
        computedStatus = 'not_shortlisted';
      } else if (hasPptEvent) {
        computedStatus = 'ppt_scheduled';
      } else {
        computedStatus = 'applied';
      }
    } else {
      // User NEVER applied to this company — keep as not_applied
      computedStatus = 'not_applied';
    }

    // ── Priority guard: never let reprocess overwrite a terminal state with a weaker one ──
    const isTerminal = (s: string) =>
      ['withdrawn', 'declined', 'rejected', 'not_shortlisted', 'selected'].includes(s);
    if (!app?.manual_override && currentStatus && computedStatus !== currentStatus) {
      const existingPriority = STATUS_PRIORITY[currentStatus] ?? 0;
      const newPriority = STATUS_PRIORITY[computedStatus] ?? 0;
      if (isTerminal(currentStatus) && !isTerminal(computedStatus)) {
        // Never downgrade from a terminal state during reprocess
        computedStatus = currentStatus;
      } else if (!isTerminal(computedStatus) && newPriority < existingPriority) {
        computedStatus = currentStatus;
      }
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
    updatePayload.ctc = extracted.ctc;
    updatePayload.stipend = extracted.stipend;
    updatePayload.location = extracted.location;

    await supabase
      .from('applications')
      .upsert(updatePayload, { onConflict: 'user_id,company_id' });

    // Purge events if user is not shortlisted, rejected, withdrawn, or not applied
    if (['withdrawn', 'declined', 'rejected', 'not_shortlisted', 'not_applied'].includes(finalStatus)) {
      await supabase.from('events').delete().eq('user_id', userId).eq('company_id', companyId);
    }

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
