import type { ParsedEmail } from '@/lib/gmail/client';
import { extractEvents, extractJobDetails } from '@/lib/sync/events';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Converts HTML email content to clean plain text so table cells, divs, and paragraphs
 * containing Neo IDs or text are fully searchable.
 */
function htmlToPlainText(html: string | undefined | null): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(tr|p|div|li)>/gi, '\n')
    .replace(/<(td|th)[^>]*>/gi, ' | ')
    .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/**
 * Checks if the user's Neo ID or identity is mentioned in an email (subject, plain body, or HTML table).
 */
export function checkNeoIdMatch(
  text: string,
  userNeoId: string | null,
  userEmail: string
): { matched: boolean; matchedValue: string | null } {
  if (!text) return { matched: false, matchedValue: null };

  const upperText = text.toUpperCase();

  // 1. Check user's explicitly set Neo ID (e.g. "I4W0POK8", "I4W0P0K8", "K1D6D1R7")
  if (userNeoId && userNeoId.trim().length >= 4) {
    const cleanNeoId = userNeoId.trim().toUpperCase();
    const matchesDirect = upperText.includes(cleanNeoId);
    const matchesFlexible = upperText
      .replace(/[0O]/g, '#0#')
      .replace(/[1I]/g, '#1#')
      .includes(cleanNeoId.replace(/[0O]/g, '#0#').replace(/[1I]/g, '#1#'));

    if (matchesDirect || matchesFlexible) {
      return { matched: true, matchedValue: cleanNeoId };
    }
  }

  // 2. Check registration number pattern (e.g. "23BCE10472")
  const regMatch = userEmail.match(/([0-9]{2}[a-z]{3}[0-9]{4,5})/i);
  if (regMatch && regMatch[1]) {
    const regNo = regMatch[1].toUpperCase();
    if (upperText.includes(regNo)) {
      return { matched: true, matchedValue: regNo };
    }
  }

  return { matched: false, matchedValue: null };
}

/**
 * Processes an email to extract events, job details, and update application status.
 *
 * @param supabase Admin client
 * @param userId User UUID
 * @param companyId Company UUID
 * @param email Parsed email
 * @param emailDbId DB UUID of the inserted email
 * @param userNeoId User's configured Neo ID
 * @param userEmail User's email
 */
export async function processEmailForEventsAndStatus(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  companyId: string,
  email: ParsedEmail,
  emailDbId: string,
  userNeoId: string | null,
  userEmail: string,
  gmail?: import('googleapis').gmail_v1.Gmail
) {
  const subjLower = email.subject.toLowerCase();
  const htmlText = htmlToPlainText(email.bodyHtml);
  const fullText = `${email.subject}\n${email.bodyPlain || ''}\n${htmlText}\n${email.bodySnippet || ''}`;

  // 1. Check for Neo ID match in email body / HTML tables / subject
  const bodyMatch = checkNeoIdMatch(fullText, userNeoId, userEmail);
  let isNeoMatched = bodyMatch.matched;
  let isInAppliedList = false; // Matched in an applied/opt-in list (NOT a shortlist)
  let matchDetail: string | null = bodyMatch.matchedValue
    ? `Found ${bodyMatch.matchedValue} in email body selection list`
    : null;
  let matchType = 'email_body';

  // 2. If attachments exist and gmail client is available, scan Excel attachments ONLY if relevant!
  const isAttachmentRelevant =
    /shortlist|selection|eligible|candidate|student|list|test|assessment|interview|ppt|schedule|result|round|score/i.test(
      subjLower
    ) ||
    /shortlist|selection list|eligible candidates|attendance/i.test(fullText) ||
    email.attachments.some((a) =>
      /shortlist|selection|eligible|candidate|student|list|test|assessment|interview|schedule|result/i.test(
        a.filename
      )
    );

  if (
    !isNeoMatched &&
    gmail &&
    email.hasAttachments &&
    email.attachments.length > 0 &&
    isAttachmentRelevant
  ) {
    const { scanExcelAttachmentsForNeoId } = await import('@/lib/sync/excel-parser');
    const excelMatch = await scanExcelAttachmentsForNeoId(
      gmail,
      email.gmailMessageId,
      email.attachments,
      userNeoId,
      userEmail
    );

    if (excelMatch && excelMatch.matched) {
      if (excelMatch.isActualShortlist) {
        // Matched in a real shortlist file → candidate is shortlisted
        isNeoMatched = true;
        matchType = 'xlsx_cell';
        matchDetail = excelMatch.details;
      } else {
        // Matched in an applied/opt-in/eligible list → just confirms application
        isInAppliedList = true;
        matchDetail = excelMatch.details;
      }
    }
  }

  const { classifyEmail } = await import('@/lib/sync/classifier');
  const emailClass = classifyEmail(email).classification;

  // Downgrade body-text Neo ID matches inside elimination/rejection emails.
  // A Neo ID match inside a rejection-list body means "you were in the applicant
  // pool that got eliminated," not "you're confirmed for the next stage."
  const isEliminationEmail =
    emailClass === 'result' &&
    /not\s+selected|regret\s+to\s+inform|unfortunately|could\s+not\s+be\s+selected|not\s+shortlisted/i.test(fullText);

  if (isEliminationEmail && matchType === 'email_body') {
    isNeoMatched = false;
  }

  // Check existing application status from DB
  const { data: existingApp } = await supabase
    .from('applications')
    .select('status, manual_override')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .single();

  if (isNeoMatched) {
    // Record candidate match in DB
    await supabase.from('candidate_matches').insert({
      user_id: userId,
      email_id: emailDbId,
      neo_id: userNeoId || userEmail,
      match_type: matchType,
      matched_value: matchDetail || email.subject.slice(0, 100),
      confidence: 'high',
    });
  }

  // 3. Extract Events (PPT, Test, Interview) with Deduplication
  // Hoist extractedEvents so the status computation block can reference it
  const extractedEvents = extractEvents(email);

  const isShortlistEmail =
    /shortlist|selection\s+list|selected\s+candidates|students\s+list|shortlisted\s+students|next\s+round\s+of\s+selection|selection\s+process\s+is\s+scheduled/i.test(
      subjLower
    ) ||
    /shortlist|shortlisted candidates|initial shortlist|selection list|students list|shortlisted students|attached list of students|find the below shortlist|below is the shortlist/i.test(
      fullText
    ) ||
    (email.hasAttachments &&
      email.attachments.some((a) =>
        /shortlist|selection|students|eligible/i.test(a.filename)
      ));

  // Check if candidate is withdrawn or opted out
  const isWithdrawn =
    existingApp?.status === 'withdrawn' ||
    existingApp?.status === 'declined' ||
    emailClass === 'withdrawal' ||
    emailClass === 'decline' ||
    // General withdrawal patterns
    /registration.*(?:has\s+been\s+)?withdrawn|opted\s+out|declined\s+drive/i.test(fullText) ||
    // NeoPAT-specific: "Confirmation: X Drive Registration Update" + body says withdrawn
    (/confirmation.*drive\s+registration\s+update/i.test(subjLower) && /withdrawn/i.test(fullText)) ||
    // NeoPAT body: "your registration for the following placement drive has been withdrawn"
    /your\s+registration\s+for\s+the\s+following\s+placement\s+drive\s+has\s+been\s+withdrawn/i.test(fullText);


  if (isWithdrawn) {
    // Delete any previously inserted events for this company if user has withdrawn
    await supabase.from('events').delete().eq('user_id', userId).eq('company_id', companyId);
  } else {
    for (const event of extractedEvents) {
      // RULE: For tests, interviews, and PPTs: ONLY add to user's schedule if candidate is shortlisted or actively participating!
      const currentAppStatus = existingApp?.status || 'not_applied';
      const isEliminated = ['not_shortlisted', 'rejected', 'withdrawn', 'declined', 'not_applied'].includes(currentAppStatus);
      const isTestOrInterview = ['online_test', 'coding_test', 'technical_interview', 'hr_interview', 'final_interview'].includes(event.eventType);

      if (isEliminated && !isNeoMatched) {
        continue; // Do not add events for companies where user is not registered or not shortlisted
      }

      if ((isTestOrInterview || isShortlistEmail) && !isNeoMatched) {
        // User was not shortlisted for this test/event/PPT — do not add to personal schedule
        continue;
      }

      // Check if duplicate event exists for this company + event_type on the same calendar day
      const startTimeIso = event.startTime ? event.startTime.toISOString() : null;
      const startOfDay = event.startTime
        ? new Date(
            event.startTime.getFullYear(),
            event.startTime.getMonth(),
            event.startTime.getDate()
          ).toISOString()
        : null;
      const endOfDay = event.startTime
        ? new Date(
            event.startTime.getFullYear(),
            event.startTime.getMonth(),
            event.startTime.getDate(),
            23,
            59,
            59,
            999
          ).toISOString()
        : null;

      let eventQuery = supabase
        .from('events')
        .select('id, start_time, venue, mode')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .eq('event_type', event.eventType);

      if (startOfDay && endOfDay) {
        eventQuery = eventQuery.gte('start_time', startOfDay).lte('start_time', endOfDay);
      } else if (startTimeIso) {
        eventQuery = eventQuery.eq('start_time', startTimeIso);
      }

      const { data: existingEvents } = await eventQuery.limit(1);

      if (existingEvents && existingEvents.length > 0) {
        // Event for this day/test already exists — refine details
        const updatePayload: Record<string, unknown> = {};
        if (startTimeIso) updatePayload.start_time = startTimeIso;
        if (event.endTime) updatePayload.end_time = event.endTime.toISOString();
        if (event.venue) updatePayload.venue = event.venue;
        if (event.mode) updatePayload.mode = event.mode;

        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from('events')
            .update(updatePayload)
            .eq('id', existingEvents[0].id);
        }
      } else {
        // Clean up title (remove "Re: ", "Fwd: ")
        const cleanTitle = email.subject.replace(/^(?:fwd|re|fw)\s*:\s*/i, '').slice(0, 60);

        // Insert new unique event into DB
        const { data: insertedEvt } = await supabase
          .from('events')
          .insert({
            user_id: userId,
            company_id: companyId,
            source_email_id: emailDbId,
            event_type: event.eventType,
            title: `${cleanTitle} - ${event.title}`,
            start_time: startTimeIso,
            end_time: event.endTime ? event.endTime.toISOString() : null,
            venue: event.venue,
            mode: event.mode,
            confidence: event.confidence,
          })
          .select('id')
          .single();

        // Trigger Event Scheduled Notification (Web Push + In-App)
        if (insertedEvt) {
          const { notifyEventScheduled } = await import('@/lib/notifications/service');
          const { data: comp } = await supabase.from('companies').select('name').eq('id', companyId).single();
          await notifyEventScheduled({
            userId,
            companyId,
            companyName: comp?.name || 'Drive',
            eventType: event.eventType,
            startTime: event.startTime,
            venue: event.venue,
            eventId: insertedEvt.id,
          });
        }
      }
    }
  }

  // 4. Extract Job Details (Role, CTC, Stipend, Location)
  const jobDetails = extractJobDetails(fullText);

  // 5. Compute updated application status
  let newStatus: string | null = null;

  if (existingApp?.manual_override) {
    // User has manually set their status — preserve it
    newStatus = null;
  } else if (isWithdrawn) {
    // A. Withdrawal / Opt-Out (always highest priority)
    newStatus = 'withdrawn';
  } else if (existingApp?.status === 'withdrawn' || existingApp?.status === 'declined') {
    // Already withdrawn — nothing can override it
    newStatus = existingApp.status;
  } else if (isNeoMatched) {
    // B. Candidate is confirmed in an actual shortlist / test / interview Excel or body match
    // Check for rejection language BEFORE checking for "selected" — order matters
    const isRejectionLanguage =
      emailClass === 'result' &&
      /not\s+selected|regret|unfortunately|could\s+not\s+be\s+selected/i.test(subjLower + ' ' + fullText);

    if (isRejectionLanguage) {
      newStatus = 'rejected';
    } else if (/interview|next\s+round|selection\s+process/i.test(subjLower)) {
      newStatus = 'interview_scheduled';
    } else if (/ppt|pre[\s-]*placement/i.test(subjLower)) {
      newStatus = 'ppt_scheduled';
    } else if (/not\s+selected/i.test(subjLower)) {
      newStatus = 'rejected';
    } else if (/(?:selected|congratulations.*offer)/i.test(subjLower)) {
      newStatus = 'selected';
    } else {
      newStatus = 'shortlisted';
    }
  } else if (isInAppliedList) {
    // C. Found in an applied/opt-in list — confirms application but does NOT mean shortlisted
    // Only upgrade from not_applied to applied; never downgrade from higher states
    const current = existingApp?.status || 'not_applied';
    if (current === 'not_applied') {
      newStatus = 'applied';
    }
  } else if (
    // D. NeoPAT registration confirmation emails:
    // "Confirmed: Your Registration for EY Placement Drive"
    // (Note: "Congratulations! You're Eligible..." is just an invitation to apply, not an application confirmation!)
    emailClass === 'registration_confirmation' ||
    /confirmed:\s*your\s+registration/i.test(subjLower) ||
    /registration\s+(confirmed|successful|received)/i.test(fullText) ||
    /successfully\s+registered|thank\s+you\s+for\s+(registering|applying)/i.test(fullText) ||
    /confirms?\s+(that\s+)?(you(r|'re)|your)\s+(successful\s+)?(registration|application)/i.test(fullText)
  ) {
    // Only set applied if user isn't already at a higher status
    const current = existingApp?.status || 'not_applied';
    if (current === 'not_applied' || current === 'unknown') {
      newStatus = 'applied';
    }
  } else if (
    // E. A shortlist was officially released but candidate was NOT in it
    isShortlistEmail
  ) {
    // RULE: Only downgrade if candidate actually APPLIED or was in the process!
    const currentStatus = existingApp?.status || 'not_applied';
    
    // Check if this is a post-test round announcement (interview, next round, selection list)
    const isPostTestRound =
      emailClass === 'interview' ||
      /interview\s+(?:is\s+)?scheduled|technical\s+interview|hr\s+interview|final\s+interview/i.test(subjLower) ||
      /next\s+round\s+of\s+selection|next\s+round\s+is\s+scheduled/i.test(subjLower) ||
      /selection\s+list|final\s+shortlist|congratulations.*(?:selection\s+list|selects)/i.test(subjLower) ||
      /interview\s+shortlist|shortlist\s+for\s+interview|next\s+round\s+shortlist|shortlisted\s+for\s+next\s+round/i.test(fullText);

    if (['test_scheduled', 'interview_scheduled', 'shortlisted'].includes(currentStatus)) {
      if (isPostTestRound) {
        // User cleared initial screening but failed a subsequent round (e.g. Test -> Interview)
        newStatus = 'rejected';
      }
      // If it's just a test schedule announcement, test results are still pending -> do not reject!
    } else if (['applied', 'ppt_scheduled'].includes(currentStatus)) {
      // User never cleared the initial screening for test
      newStatus = 'not_shortlisted';
    }
  } else if (
    // F. PPT event found in email — upgrade status even without Neo match
    // (PPT announcements are sent to ALL registered/eligible candidates)
    extractedEvents.length > 0
  ) {
    const current = existingApp?.status || 'not_applied';
    const hasPpt = extractedEvents.some((e) => e.eventType === 'ppt');
    if (hasPpt && ['applied', 'not_applied', 'unknown'].includes(current)) {
      newStatus = 'ppt_scheduled';
    }
  }


  // ─── STATUS PRIORITY GUARD ──────────────────────────────────────────────────
  // Never allow a weaker status signal to overwrite a stronger existing status.
  // e.g. a "registration" broadcast email must not flip "shortlisted" → "applied"
  if (newStatus && existingApp?.status && newStatus !== existingApp.status) {
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
      // Terminal states — always allowed to be set (withdrawal, rejection, etc.)
      not_shortlisted: 9,
      declined: 9,
      withdrawn: 10,
      rejected: 10,
    };
    const existingPriority = STATUS_PRIORITY[existingApp.status] ?? 0;
    const newPriority = STATUS_PRIORITY[newStatus] ?? 0;

    // If the new status has lower priority than existing AND existing is NOT terminal,
    // block the downgrade. Terminal states (withdrawn, rejected, not_shortlisted) are
    // always allowed to be applied.
    const isTerminal = (s: string) => ['withdrawn', 'declined', 'rejected', 'not_shortlisted', 'selected'].includes(s);
    if (!isTerminal(newStatus) && newPriority < existingPriority) {
      newStatus = null; // Block the downgrade
    }
  }

  // Build application update payload
  const appUpdate: Record<string, unknown> = {
    user_id: userId,
    company_id: companyId,
    last_updated: new Date().toISOString(),
  };

  if (jobDetails.role) appUpdate.role = jobDetails.role;
  if (jobDetails.ctc) appUpdate.ctc = jobDetails.ctc;
  if (jobDetails.stipend) appUpdate.stipend = jobDetails.stipend;
  if (jobDetails.location) appUpdate.location = jobDetails.location;

  if (newStatus) {
    appUpdate.status = newStatus;
    appUpdate.status_source = matchType === 'xlsx_cell' ? 'excel_shortlist_match' : 'sync_engine';
    appUpdate.status_confidence = 'high';

    // If candidate withdrew, declined, or was not shortlisted/rejected, purge scheduled events
    if (['withdrawn', 'declined', 'rejected', 'not_shortlisted'].includes(newStatus)) {
      await supabase.from('events').delete().eq('user_id', userId).eq('company_id', companyId);
    }

    // Only notify if canonical status actually changed!
    if (newStatus !== existingApp?.status) {
      const { notifyStatusChange, notifyShortlistMatch } = await import('@/lib/notifications/service');
      const { data: comp } = await supabase.from('companies').select('name').eq('id', companyId).single();
      const companyName = comp?.name || 'Company';

      if (isNeoMatched && (matchType === 'excel_attachment' || newStatus === 'shortlisted')) {
        await notifyShortlistMatch({
          userId,
          companyId,
          companyName,
          neoId: userNeoId || userEmail,
          emailSubject: email.subject,
          sourceEmailId: emailDbId,
        });
      }

      await notifyStatusChange({
        userId,
        companyId,
        companyName,
        oldStatus: existingApp?.status || null,
        newStatus,
        sourceEmailId: emailDbId,
      });
    }
  }

  // Upsert application
  await supabase
    .from('applications')
    .upsert(appUpdate, { onConflict: 'user_id,company_id' });
}
