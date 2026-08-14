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

    // ─── Status Computation from Emails ──────────────────────────────────
    for (const email of companyEmails) {
      const subj = (email.subject || '').toLowerCase();
      const body = (email.body_snippet || '').toLowerCase();
      const full = subj + ' ' + body;
      const cls = email.classification;

      let candidate: string | null = null;

      // Withdrawal / Decline
      if (
        cls === 'withdrawal' || cls === 'decline' ||
        /registration.*has been withdrawn|your registration.*withdrawn/i.test(full) ||
        (/confirmation.*drive\s+registration\s+update/i.test(subj) && /withdrawn/i.test(full))
      ) {
        candidate = 'withdrawn';
      }
      // Confirmed Registration / Eligible
      else if (
        cls === 'registration_confirmation' || cls === 'registration' ||
        /confirmed:\s*your\s+registration/i.test(subj) ||
        /congratulations[!]*\s*(you'?re|you\s+are)\s+eligible/i.test(subj) ||
        /registration\s+(confirmed|successful|received)/i.test(full) ||
        /successfully\s+registered|thank\s+you\s+for\s+(registering|applying)/i.test(full) ||
        /confirms?\s+(that\s+)?(you(r|'re)|your)\s+(successful\s+)?(registration|application)/i.test(full)
      ) {
        candidate = 'applied';
      }

      if (!candidate) continue;

      const candidatePriority = STATUS_PRIORITY[candidate] ?? 0;
      if (candidatePriority > bestPriority) {
        bestPriority = candidatePriority;
        bestNewStatus = candidate;
      }
    }

    // ─── Event-based Status Upgrade ──────────────────────────────────────
    const { data: storedEvents } = await supabase
      .from('events')
      .select('event_type')
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (storedEvents && storedEvents.length > 0) {
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
      for (const evt of storedEvents) {
        const candidate = EVENT_STATUS_MAP[evt.event_type];
        if (!candidate) continue;
        const candidatePriority = EVENT_PRIORITY[evt.event_type] ?? 0;
        if (candidatePriority > bestPriority) {
          bestPriority = candidatePriority;
          bestNewStatus = candidate;
        }
      }
    }

    // Determine final status (respect manual_override if present)
    const finalStatus = app?.manual_override ? currentStatus : (bestNewStatus || currentStatus);

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
