import type { ParsedEmail } from '@/lib/gmail/client';
import { extractEvents, extractJobDetails, type ExtractedEvent } from '@/lib/sync/events';
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

  // Strip recipient email addresses, mailto links, and headers to prevent matching user's own email
  const sanitizedText = text
    .replace(/[a-zA-Z0-9._%+-]+@vit(?:student|bhopal|chennai|vellore)?\.[a-zA-Z0-9.-]+/gi, ' ')
    .replace(/[a-zA-Z0-9._%+-]+@gmail\.com/gi, ' ')
    .replace(/mailto:[^\s>]+/gi, ' ')
    .replace(/to:\s*[^\n]+/gi, ' ')
    .replace(/from:\s*[^\n]+/gi, ' ')
    .toUpperCase();

  // 1. Check user's explicitly configured Neo ID (e.g. "I4W0POK8", "I4W0P0K8", "K1D6D1R7")
  if (userNeoId && userNeoId.trim().length >= 4) {
    const cleanNeoId = userNeoId.trim().toUpperCase();
    const matchesDirect = sanitizedText.includes(cleanNeoId);
    const matchesFlexible = sanitizedText
      .replace(/[0O]/g, '#0#')
      .replace(/[1I]/g, '#1#')
      .includes(cleanNeoId.replace(/[0O]/g, '#0#').replace(/[1I]/g, '#1#'));

    if (matchesDirect || matchesFlexible) {
      return { matched: true, matchedValue: cleanNeoId };
    }
  }

  // 2. Check registration number pattern (e.g. "23BCE10472")
  // VIT branch codes are exactly 3 letters (BCE, CSE, MIS, etc.)
  const regMatch = userEmail.match(/([0-9]{2}[a-z]{3}[0-9]{4,5})/i);
  if (regMatch && regMatch[1]) {
    const regNo = regMatch[1].toUpperCase();
    const regRegex = new RegExp(`(?:^|[^A-Z0-9])${regNo}(?:[^A-Z0-9]|$)`, 'i');
    if (regRegex.test(sanitizedText)) {
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

  // Compute isShortlistEmail early — needed both for attachment scanning context (below)
  // and for status computation logic further down.
  const isShortlistEmail =
    /shortlist|selection\s+list|selected\s+candidates|shortlisted\s+students|shortlist\s+for|candidates\s+shortlisted|online\s+test\s+is\s+scheduled|assessment\s+is\s+scheduled|coding\s+test\s+is\s+scheduled/i.test(
      subjLower
    ) ||
    /find\s+the\s+below\s+shortlist|below\s+is\s+the\s+shortlist|shortlisted\s+candidates|shortlisted\s+students|attached\s+list\s+of\s+shortlisted|shortlist\s+for\s+next\s+round/i.test(
      fullText
    ) ||
    (email.hasAttachments &&
      email.attachments.some((a) =>
        /shortlist|selection[_\s-]*list|test[_\s-]*shortlist|selected[_\s-]*student/i.test(a.filename)
      ));

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
      userEmail,
      isShortlistEmail  // Pass shortlist context so unnamed Excel files get correct classification
    );

    if (excelMatch && excelMatch.matched) {
      if (excelMatch.isActualShortlist) {
        // Matched in a real shortlist file → candidate is shortlisted
        isNeoMatched = true;
        matchType = 'xlsx_cell';
        matchDetail = excelMatch.details;
      } else {
        // Matched in an applied/opt-in list — confirms application/registration roster.
        // It does NOT qualify as a confirmed test/interview shortlist if an actual shortlist exists or is issued later.
        isInAppliedList = true;
        matchType = 'xlsx_applied_list';
        matchDetail = excelMatch.details;
      }
    }
  }

  // 2b. Check Google Sheets pubhtml shortlists in email text
  let gsheetEventToAdd: ExtractedEvent | null = null;
  if (!isNeoMatched) {
    const { extractGoogleSheetUrls, scanGoogleSheetForCandidate } = await import('@/lib/sync/gsheet-parser');
    const gUrls = extractGoogleSheetUrls(fullText);
    for (const gUrl of gUrls) {
      const gMatch = await scanGoogleSheetForCandidate(gUrl, userEmail, userNeoId);
      if (gMatch && gMatch.matched) {
        isNeoMatched = true;
        matchType = 'xlsx_cell';
        matchDetail = gMatch.details;
        if (gMatch.eventDate) {
          const startTime = new Date(gMatch.eventDate);
          startTime.setHours(gMatch.slot && /slot\s*2/i.test(gMatch.slot) ? 14 : 9, 0, 0, 0);
          gsheetEventToAdd = {
            eventType: 'online_test',
            title: `Online Assessment${gMatch.slot ? ` (${gMatch.slot})` : ''}`,
            startTime,
            endTime: null,
            venue: 'Campus / Offline',
            mode: 'online',
            confidence: 'high',
            hasExplicitTime: true,
          };
        }
        break;
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
    .select('status, manual_override, applied_at, location, ctc, notes')
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
  if (gsheetEventToAdd) {
    extractedEvents.push(gsheetEventToAdd);
  }

  const isBroadcastOptOutNotice =
    /who\s+(?:wish|want)\s+to\s+opt|if\s+you\s+(?:wish|want)\s+to\s+opt|opt[\s-]*out\s+(?:form|link|google|portal)|voluntary\s+withdrawal\s+only|forms\.gle/i.test(fullText);

  const isWithdrawn =
    !isNeoMatched &&
    !isBroadcastOptOutNotice && (
      existingApp?.status === 'withdrawn' ||
      existingApp?.status === 'declined' ||
      emailClass === 'withdrawal' ||
      emailClass === 'decline' ||
      // General withdrawal patterns
      /registration.*(?:has\s+been\s+)?withdrawn|declined\s+(?:the\s+)?(?:placement\s+)?drive/i.test(fullText) ||
      // NeoPAT-specific: "Confirmation: X Drive Registration Update" + body says withdrawn
      (/confirmation.*drive\s+registration\s+update/i.test(subjLower) && /withdrawn/i.test(fullText)) ||
      // NeoPAT body: "your registration for the following placement drive has been withdrawn"
      /your\s+registration\s+for\s+the\s+following\s+placement\s+drive\s+has\s+been\s+withdrawn/i.test(fullText)
    );


  if (isWithdrawn) {
    // Delete any previously inserted events for this company if user has withdrawn
    await supabase.from('events').delete().eq('user_id', userId).eq('company_id', companyId);
  } else {
    for (const event of extractedEvents) {
      // RULE: For tests, interviews, and PPTs: ONLY add to user's schedule if candidate is shortlisted or actively participating!
      const currentAppStatus = existingApp?.status || 'not_applied';
      const isEliminated = ['not_shortlisted', 'rejected', 'withdrawn', 'declined'].includes(currentAppStatus);
      const isTestOrInterview = ['online_test', 'coding_test', 'technical_interview', 'hr_interview', 'final_interview'].includes(event.eventType);

      if (isEliminated && !isNeoMatched) {
        continue; // Do not add events for companies where user is withdrawn, rejected, or eliminated
      }

      if ((isTestOrInterview || isShortlistEmail) && !isNeoMatched) {
        // User was not found in the shortlist/test email.
        // If they are 'applied' or 'ppt_scheduled', we still schedule the event so they can
        // see the round is happening (it will show as not_shortlisted after reprocess).
        // Only hard-skip if user is already in a terminal elimination state.
        const currentStatus = existingApp?.status || 'not_applied';
        const isAppliedOrPpt = ['applied', 'ppt_scheduled', 'shortlisted'].includes(currentStatus);
        if (!isAppliedOrPpt) {
          continue;
        }
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
        if (startTimeIso && event.hasExplicitTime) {
          updatePayload.start_time = startTimeIso;
        }
        if (event.endTime && event.hasExplicitTime) updatePayload.end_time = event.endTime.toISOString();
        if (event.venue && event.venue !== 'Campus / Offline') updatePayload.venue = event.venue;
        if (event.mode && event.mode !== 'unknown') updatePayload.mode = event.mode;

        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from('events')
            .update(updatePayload)
            .eq('id', existingEvents[0].id);
        }
      } else {
        // Clean up title
        const { data: compRec } = await supabase.from('companies').select('name').eq('id', companyId).single();
        const displayComp = compRec?.name || email.subject.replace(/^(?:fwd|re|fw)\s*:\s*/i, '').slice(0, 40);
        const finalTitle = `${displayComp} - ${event.title}`;

        // Insert new unique event into DB
        const { data: insertedEvt } = await supabase
          .from('events')
          .insert({
            user_id: userId,
            company_id: companyId,
            source_email_id: emailDbId,
            event_type: event.eventType,
            title: finalTitle,
            start_time: startTimeIso,
            end_time: event.endTime ? event.endTime.toISOString() : null,
            venue: event.venue,
            mode: event.mode,
            confidence: event.confidence,
          })
          .select('id')
          .single();

        // Trigger Event Scheduled Notification (Web Push + In-App) & Google Calendar Auto-Sync
        if (insertedEvt) {
          const { notifyEventScheduled } = await import('@/lib/notifications/service');
          const { data: comp } = await supabase.from('companies').select('name').eq('id', companyId).single();
          const compName = comp?.name || 'Drive';
          await notifyEventScheduled({
            userId,
            companyId,
            companyName: compName,
            eventType: event.eventType,
            startTime: event.startTime,
            venue: event.venue,
            eventId: insertedEvt.id,
          });

          if (startTimeIso) {
            const { pushEventToGoogleCalendar } = await import('@/lib/calendar/google-sync');
            pushEventToGoogleCalendar({
              userId,
              title: `${compName} - ${event.title}`,
              startTime: startTimeIso,
              endTime: event.endTime ? event.endTime.toISOString() : null,
              venue: event.venue,
              mode: event.mode,
            }).catch((err) => console.error('Google Calendar auto-sync error:', err));
          }
        }
      }
    }
  }

  // 4. Extract Job Details (Role, CTC, Stipend, Location)
  const jobDetails = extractJobDetails(fullText);

  // 4b. Tier 2 AI Fallback Gating & Reconciliation
  const { extractDriveNumber } = await import('@/lib/sync/events');
  const driveNum = extractDriveNumber(fullText);

  const { data: compRecord } = await supabase
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single();

  const tier1Summary = {
    companyName: compRecord?.name || null,
    classification: emailClass,
    ctc: jobDetails.ctc || null,
    stipend: jobDetails.stipend || null,
    eventsCount: extractedEvents.length,
    driveNumber: driveNum,
    rawMatchedFields: {
      ctc_raw: jobDetails.ctc || '',
    },
  };

  const existingDriveState = existingApp
    ? {
        companyId,
        canonicalName: compRecord?.name || '',
        ctc: existingApp.ctc || null,
        status: existingApp.status || 'unknown',
      }
    : null;

  const { shouldInvokeAiFallback, reconcileCompensation } = await import('@/lib/sync/ai-gating');
  const gating = shouldInvokeAiFallback(tier1Summary, existingDriveState);

  let isAiFlaggedForReview = false;
  let aiReviewNotes: string | null = null;

  if (gating.shouldInvoke) {
    const { executeAiPlacementExtraction } = await import('@/lib/sync/ai-fallback');
    const aiRes = await executeAiPlacementExtraction(
      email.subject,
      fullText,
      email.receivedAt ? new Date(email.receivedAt) : new Date()
    );

    if (aiRes.success && aiRes.data) {
      const ai = aiRes.data;

      // Reconcile CTC
      if (ai.ctc) {
        const recon = reconcileCompensation(existingApp?.ctc || null, jobDetails.ctc || null, ai.ctc);
        if (recon.action === 'update' || (recon.action === 'preserve' && !existingApp?.ctc)) {
          jobDetails.ctc = recon.acceptedCtc || jobDetails.ctc;
        } else if (recon.action === 'flag_for_review') {
          isAiFlaggedForReview = true;
          aiReviewNotes = `[NEEDS REVIEW] AI detected alternative CTC: ${ai.ctc} vs existing ${existingApp?.ctc}`;
        }
      }

      // Reconcile Stipend
      if (ai.stipend && !jobDetails.stipend) {
        jobDetails.stipend = ai.stipend;
      }

      // Reconcile Events if Tier 1 found 0 events but AI verified scheduled round with quote
      if (extractedEvents.length === 0 && ai.events.length > 0) {
        for (const aiEvt of ai.events) {
          if (aiEvt.isScheduled && aiEvt.startTime) {
            extractedEvents.push({
              eventType: aiEvt.eventType as any,
              title: aiEvt.title,
              startTime: new Date(aiEvt.startTime),
              endTime: null,
              venue: aiEvt.venue,
              hasExplicitTime: true,
              mode: 'unknown',
              confidence: 'high',
            });
          }
        }
      }

      if (!ai.isSanityCheckPassed) {
        isAiFlaggedForReview = true;
        aiReviewNotes = (aiReviewNotes ? `${aiReviewNotes}\n` : '') + `[NEEDS REVIEW] AI sanity failure: ${ai.sanityFailureReasons.join('; ')}`;
      }
    }
  }

  // 5. Compute updated application status
  const emailReceivedTime = email.receivedAt ? new Date(email.receivedAt).getTime() : Date.now();
  const appliedTime = existingApp?.applied_at ? new Date(existingApp.applied_at).getTime() : null;
  // If email was received before the user registered (with a 2-minute clock skew grace), it's from a previous round/cycle!
  const isEmailAfterApplication = !appliedTime || emailReceivedTime >= (appliedTime - 2 * 60 * 1000);

  const isConfirmation =
    emailClass === 'registration_confirmation' ||
    /confirmed:\s*your\s+registration/i.test(subjLower) ||
    /registration\s+(confirmed|successful|received)/i.test(fullText) ||
    /successfully\s+registered|thank\s+you\s+for\s+(registering|applying)/i.test(fullText) ||
    /confirms?\s+(that\s+)?(you(r|'re)|your)\s+(successful\s+)?(registration|application)/i.test(fullText);

  let newStatus: string | null = null;

  if (existingApp?.manual_override) {
    // User has manually set their status — preserve it
    newStatus = null;
  } else if (isNeoMatched) {
    // Candidate is confirmed in an actual shortlist / test / interview Excel, GSheet, or body match
    const isRejectionLanguage =
      emailClass === 'result' &&
      /not\s+selected|regret|unfortunately|could\s+not\s+be\s+selected/i.test(subjLower + ' ' + fullText);

    if (isRejectionLanguage) {
      newStatus = 'rejected';
    } else if (/final\s*selection|offer\s*(?:letter|release)|congratulations.*(?:final|offer)/i.test(subjLower) || (/selection\s*list/i.test(subjLower) && !/interview|ppt|test/i.test(subjLower))) {
      newStatus = 'selected';
    } else if (/interview|next\s+round|selection\s+process/i.test(subjLower)) {
      newStatus = 'interview_scheduled';
    } else if (/online\s+test|coding\s+test|assessment/i.test(subjLower) || matchDetail?.includes('Google Sheet')) {
      newStatus = 'test_scheduled';
    } else if (/ppt|pre[\s-]*placement/i.test(subjLower)) {
      newStatus = 'ppt_scheduled';
    } else {
      newStatus = 'shortlisted';
    }
  } else if (isWithdrawn) {
    // A. Withdrawal / Opt-Out (always highest priority unless candidate matched in shortlist)
    newStatus = 'withdrawn';
  } else if (existingApp?.status === 'withdrawn' || existingApp?.status === 'declined') {
  } else if (isInAppliedList) {
    // C. Found in an applied/opt-in list — confirms application but does NOT mean shortlisted
    const current = existingApp?.status || 'not_applied';
    if (current === 'not_applied' || current === 'not_shortlisted') {
      newStatus = 'applied';
    }
  } else if (isConfirmation) {
    // D. NeoPAT registration confirmation emails:
    // "Confirmed: Your Registration for EY Placement Drive"
    // When a new registration confirmation arrives, it resets status back to applied
    const current = existingApp?.status || 'not_applied';
    if (current === 'not_applied' || current === 'unknown' || current === 'not_shortlisted' || isEmailAfterApplication) {
      newStatus = 'applied';
    }
  } else if (
    // E. A shortlist was officially released but candidate was NOT in it
    isShortlistEmail &&
    isEmailAfterApplication
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
        // User was shortlisted for test/interview and was eliminated in a subsequent round
        newStatus = 'rejected';
      }
    } else if (['applied', 'ppt_scheduled'].includes(currentStatus)) {
      // User was in screening and was not shortlisted in the released shortlist
      newStatus = 'not_shortlisted';
    }
  } else if (
    // F. PPT event found in email — upgrade status for registered candidates
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
    const isTerminal = (s: string) => ['withdrawn', 'declined', 'rejected', 'not_shortlisted'].includes(s);

    // EXCEPTION: A positive Excel/body match (isNeoMatched) is concrete evidence the candidate
    // IS participating. It must be allowed to override a previous 'not_shortlisted' determination,
    // which is only an absence-of-evidence signal from an earlier email scan.
    // e.g. "Test Scheduled" email + user found in opt-in Excel → test_scheduled should win over not_shortlisted.
    const isConfirmedParticipation =
      isNeoMatched &&
      existingApp?.status === 'not_shortlisted' &&
      ['shortlisted', 'test_scheduled', 'interview_scheduled', 'ppt_scheduled'].includes(newStatus);

    if (!isTerminal(newStatus) && newPriority < existingPriority && !isConfirmedParticipation) {
      newStatus = null; // Block the downgrade
    }
  }

  // Build application update payload
  const appUpdate: Record<string, unknown> = {
    user_id: userId,
    company_id: companyId,
    last_updated: new Date().toISOString(),
  };

  const { extractTravelRequirement } = await import('@/lib/sync/events');
  const travelReq = extractTravelRequirement(fullText);
  let resolvedLocation = jobDetails.location || existingApp?.location || null;
  if (resolvedLocation && /^(?:vit\s+)?(?:vellore|chennai|bhopal)(?:\s+campus)?$/i.test(resolvedLocation.trim())) {
    resolvedLocation = null;
  }

  if (jobDetails.role) appUpdate.role = jobDetails.role;
  if (jobDetails.ctc) appUpdate.ctc = jobDetails.ctc;
  if (jobDetails.stipend) appUpdate.stipend = jobDetails.stipend;
  if (resolvedLocation) appUpdate.location = resolvedLocation;

  // Accumulate notes: travel requirement + AI review flags occupy the same column.
  // Build them separately and join so neither overwrites the other.
  const noteParts: string[] = [];
  if (travelReq) {
    noteParts.push(travelReq);
  } else if (existingApp?.notes) {
    // Preserve previously extracted travel mode so later circulars (e.g. test links) don't overwrite it
    const prevTravel = existingApp.notes.split('\n')[0]?.trim();
    if (['vellore', 'chennai', 'bhopal_lab', 'online'].includes(prevTravel)) {
      noteParts.push(prevTravel);
    }
  }
  if (isAiFlaggedForReview && aiReviewNotes) noteParts.push(aiReviewNotes);
  if (noteParts.length > 0) appUpdate.notes = noteParts.join('\n');

  if (newStatus) {
    appUpdate.status = newStatus;
    if (newStatus === 'applied' && !existingApp?.applied_at) {
      appUpdate.applied_at = email.receivedAt ? new Date(email.receivedAt).toISOString() : new Date().toISOString();
    }
    appUpdate.status_confidence = isAiFlaggedForReview ? 'low' : 'high';
    // AI review notes are already included in appUpdate.notes above (with travelReq), skip double-append

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
