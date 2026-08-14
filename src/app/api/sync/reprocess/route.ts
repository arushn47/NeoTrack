import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/sync/reprocess
 * Re-evaluates ALL stored emails for the current user against the current classification
 * rules to fix stale application statuses (e.g. not_applied when confirmed registration exists).
 *
 * Only upgrades statuses — never downgrades a status that is already higher.
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

  // 2. Get user's Neo ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('neo_id')
    .eq('user_id', userId)
    .single();
  const userNeoId = profile?.neo_id || null;

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
  const details: { companyId: string; subject: string; newStatus: string }[] = [];

  // 3. Group emails by company_id and determine correct status
  const byCompany = new Map<string, typeof emails>();
  for (const email of emails) {
    if (!email.company_id) continue;
    if (!byCompany.has(email.company_id)) byCompany.set(email.company_id, []);
    byCompany.get(email.company_id)!.push(email);
  }

  for (const [companyId, companyEmails] of byCompany.entries()) {
    // Get current application status
    const { data: app } = await supabase
      .from('applications')
      .select('status, manual_override')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single();

    // Never touch manually-overridden statuses
    if (app?.manual_override) continue;

    const currentStatus = app?.status || 'not_applied';
    const currentPriority = STATUS_PRIORITY[currentStatus] ?? 0;

    let bestNewStatus: string | null = null;
    let bestPriority = currentPriority;

    for (const email of companyEmails) {
      const subj = (email.subject || '').toLowerCase();
      const body = (email.body_snippet || '').toLowerCase();
      const full = subj + ' ' + body;
      const cls = email.classification;

      let candidate: string | null = null;

      // ─── Withdrawal / Decline (terminal — always apply) ────────────────
      if (
        cls === 'withdrawal' || cls === 'decline' ||
        /registration.*has been withdrawn|your registration.*withdrawn/i.test(full) ||
        (/confirmation.*drive\s+registration\s+update/i.test(subj) && /withdrawn/i.test(full))
      ) {
        candidate = 'withdrawn';
      }

      // ─── Confirmed Registration / Eligible ─────────────────────────────
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

    // 4. Apply if we found a better status
    if (bestNewStatus && bestNewStatus !== currentStatus) {
      await supabase
        .from('applications')
        .upsert(
          {
            user_id: userId,
            company_id: companyId,
            status: bestNewStatus,
            status_source: 'sync_reprocess',
            status_confidence: 'high',
            last_updated: new Date().toISOString(),
          },
          { onConflict: 'user_id,company_id' }
        );
      fixed++;
      details.push({
        companyId,
        subject: companyEmails[0].subject || '',
        newStatus: bestNewStatus,
      });
    }
  }

  return NextResponse.json({ success: true, emailsScanned: emails.length, fixed, details });
}
