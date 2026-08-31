import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyEmail, extractCompanyName, normalizeCompanyName } from '@/lib/sync/classifier';
import { extractEvents, extractJobDetails } from '@/lib/sync/events';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Re-indexes all stored emails using the strict 2-tier architecture:
 *
 * Tier 1: ONLY emails from noreply.cdcinfo@vitstudent.ac.in (the official NeoPAT notification sender)
 *         define the company drives in NeoTrack.
 * Tier 2: College circulars (@vitbhopal.ac.in) ONLY enrich existing NeoPAT drives with CTC, JDs,
 *         test dates, and shortlist verification. Non-NeoPAT drives (e.g. Datagrokr) are discarded.
 */
async function performReprocess(userId: string) {
  const supabase = createAdminClient();

  // Fetch user details
  const { data: userData } = await supabase
    .from('users')
    .select('neo_id, email')
    .eq('id', userId)
    .single();

  const userNeoId = userData?.neo_id || null;
  const userEmail = userData?.email || '';

  // 1. Clean dirty candidate matches (false positives on recipient email headers)
  if (userEmail) {
    const regMatch = userEmail.match(/([0-9]{2}[a-z]{3}[0-9]{4,5})/i);
    const regNo = regMatch ? regMatch[1].toUpperCase() : '';

    const { data: allMatches } = await supabase
      .from('candidate_matches')
      .select('id, match_type, matched_value')
      .eq('user_id', userId);

    const matchesToDelete = (allMatches || []).filter((m) => {
      if (m.match_type === 'xlsx_cell') return false; // Keep verified Excel matches
      const val = (m.matched_value || '').toUpperCase();
      if (regNo && val.includes(regNo) && !val.includes(userNeoId || '___NO_NEO___')) {
        return true;
      }
      return false;
    });

    if (matchesToDelete.length > 0) {
      await supabase
        .from('candidate_matches')
        .delete()
        .in('id', matchesToDelete.map((m) => m.id));
    }
  }

  // 2. Fetch ALL stored emails for this user
  const { data: emails, error: emailsError } = await supabase
    .from('emails')
    .select('id, subject, sender, body_snippet, classification, company_id, received_at')
    .eq('user_id', userId);

  if (emailsError || !emails || emails.length === 0) {
    return { success: true, message: 'No emails found to reprocess', fixed: 0 };
  }

  // Separate emails into NeoPAT emails (noreply.cdcinfo@vitstudent.ac.in) and College circulars
  const isNeoPatSender = (sender: string) => /noreply\.cdcinfo@vitstudent\.ac\.in/i.test(sender);

  const neoPatEmails = emails.filter((e) => isNeoPatSender(e.sender || ''));
  const collegeEmails = emails.filter((e) => !isNeoPatSender(e.sender || ''));

  // 3. Phase 1: Establish Official NeoPAT Companies
  // ONLY NeoPAT emails define the drives in NeoTrack!
  const validCompanyMap = new Map<string, { id: string; canonicalName: string }>(); // name -> { id, canonicalName }
  const validCompanyIdSet = new Set<string>();

  for (const email of neoPatEmails) {
    const subject = email.subject || '';
    const sender = email.sender || '';
    const bodySnippet = email.body_snippet || '';

    const classification = classifyEmail({
      gmailMessageId: email.id,
      threadId: null,
      sender,
      senderEmail: sender.match(/<([^>]+)>/)?.[1] || sender,
      subject,
      receivedAt: email.received_at ? new Date(email.received_at) : new Date(),
      bodySnippet,
      bodyPlain: bodySnippet,
      bodyHtml: '',
      hasAttachments: false,
      attachments: [],
      labels: [],
    });

    const companyName = classification.companyName;
    const isPlacement = !['irrelevant', 'unclassified', 'general'].includes(classification.classification);

    if (companyName && isPlacement) {
      const normalized = normalizeCompanyName(companyName);
      let comp = validCompanyMap.get(normalized.toLowerCase());

      if (!comp) {
        // Look up existing company by name or alias
        const { data: existingComp } = await supabase
          .from('companies')
          .select('id, name')
          .eq('user_id', userId)
          .eq('name', normalized)
          .single();

        if (existingComp) {
          comp = { id: existingComp.id, canonicalName: normalized };
        } else {
          // Check aliases
          const { data: aliasMatch } = await supabase
            .from('companies')
            .select('id, name')
            .eq('user_id', userId)
            .contains('aliases', [normalized.toLowerCase()])
            .single();

          if (aliasMatch) {
            comp = { id: aliasMatch.id, canonicalName: normalized };
            await supabase
              .from('companies')
              .update({ name: normalized })
              .eq('id', aliasMatch.id);
          } else {
            // Create new legitimate NeoPAT company
            const { data: newComp } = await supabase
              .from('companies')
              .insert({
                user_id: userId,
                name: normalized,
                aliases: [normalized.toLowerCase(), companyName.toLowerCase()],
              })
              .select('id')
              .single();

            if (newComp) {
              comp = { id: newComp.id, canonicalName: normalized };
            }
          }
        }

        if (comp) {
          validCompanyMap.set(normalized.toLowerCase(), comp);
          validCompanyIdSet.add(comp.id);
        }
      }

      // Link this NeoPAT email to the company
      if (comp) {
        await supabase
          .from('emails')
          .update({
            company_id: comp.id,
            classification: classification.classification,
            is_relevant: true,
          })
          .eq('id', email.id);
      }
    } else {
      // Unlink non-company NeoPAT emails (e.g. general portal links)
      await supabase
        .from('emails')
        .update({
          company_id: null,
          classification: classification.classification,
          is_relevant: false,
        })
        .eq('id', email.id);
    }
  }

  // 4. Phase 2: Purge ANY Company in DB that is NOT in the Official NeoPAT List
  // This permanently removes Datagrokr, Google, PS Associate Engineer, and all non-NeoPAT broadcast drives.
  const { data: currentDbCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', userId);

  const deletedCompanyNames: string[] = [];

  for (const comp of currentDbCompanies || []) {
    if (!validCompanyIdSet.has(comp.id)) {
      await supabase.from('events').delete().eq('user_id', userId).eq('company_id', comp.id);
      await supabase.from('applications').delete().eq('user_id', userId).eq('company_id', comp.id);
      await supabase.from('notifications').delete().eq('user_id', userId).eq('company_id', comp.id);
      await supabase.from('companies').delete().eq('user_id', userId).eq('id', comp.id);
      deletedCompanyNames.push(comp.name);
    }
  }

  // 5. Phase 3: Match College Emails against Official NeoPAT Companies ONLY
  let collegeLinkedCount = 0;
  let collegeDiscardedCount = 0;

  for (const email of collegeEmails) {
    const subject = email.subject || '';
    const sender = email.sender || '';
    const bodySnippet = email.body_snippet || '';

    const classification = classifyEmail({
      gmailMessageId: email.id,
      threadId: null,
      sender,
      senderEmail: sender.match(/<([^>]+)>/)?.[1] || sender,
      subject,
      receivedAt: email.received_at ? new Date(email.received_at) : new Date(),
      bodySnippet,
      bodyPlain: bodySnippet,
      bodyHtml: '',
      hasAttachments: false,
      attachments: [],
      labels: [],
    });

    const companyName = classification.companyName;
    let matchedCompanyId: string | null = null;

    if (companyName) {
      const normalized = normalizeCompanyName(companyName).toLowerCase();

      // Check if this matches an existing NeoPAT company
      for (const [neoName, comp] of validCompanyMap.entries()) {
        if (
          neoName === normalized ||
          neoName.includes(normalized) ||
          normalized.includes(neoName)
        ) {
          matchedCompanyId = comp.id;
          break;
        }
      }
    }

    if (matchedCompanyId) {
      // Link college circular to legitimate NeoPAT company
      await supabase
        .from('emails')
        .update({
          company_id: matchedCompanyId,
          classification: classification.classification,
          is_relevant: true,
        })
        .eq('id', email.id);

      collegeLinkedCount++;
    } else {
      // Discard non-NeoPAT college email (e.g. Datagrokr, MBA drives, etc.)
      await supabase
        .from('emails')
        .update({
          company_id: null,
          classification: classification.classification,
          is_relevant: false,
        })
        .eq('id', email.id);

      collegeDiscardedCount++;
    }
  }

  // 6. Phase 4: Recalculate Stage Progression & Events for Official NeoPAT Companies
  const { data: remainingCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', userId);

  const { data: candidateMatches } = await supabase
    .from('candidate_matches')
    .select('id, match_type, email_id')
    .eq('user_id', userId);

  let updatedAppsCount = 0;
  const applicationResults: Array<{ company: string; status: string; role?: string | null; ctc?: string | null }> = [];

  for (const comp of remainingCompanies || []) {
    const { data: companyEmails } = await supabase
      .from('emails')
      .select('id, subject, body_snippet, classification, received_at')
      .eq('user_id', userId)
      .eq('company_id', comp.id);

    if (!companyEmails || companyEmails.length === 0) continue;

    const emailIds = new Set(companyEmails.map((e) => e.id));
    const matchedEmailIds = new Set(
      (candidateMatches || [])
        .filter((cm) => emailIds.has((cm as unknown as { email_id: string }).email_id))
        .map((cm) => (cm as unknown as { email_id: string }).email_id)
    );

    const combinedEmailText = companyEmails
      .map((e) => `${e.subject || ''}\n${e.body_snippet || ''}`)
      .join('\n\n');

    const extractedJob = extractJobDetails(combinedEmailText);

    // Identify user actions & progression from emails
    const isWithdrawn = companyEmails.some((e) => {
      const full = `${e.subject || ''} ${e.body_snippet || ''}`.toLowerCase();
      return (
        e.classification === 'withdrawal' ||
        e.classification === 'decline' ||
        /registration.*withdrawn|your registration.*withdrawn|declined\s+drive/i.test(full) ||
        /confirmation.*drive\s+registration\s+update.*withdrawn/i.test(full)
      );
    });

    const hasConfirmedRegistration = companyEmails.some((e) => {
      const subj = (e.subject || '').toLowerCase();
      const full = `${subj} ${e.body_snippet || ''}`.toLowerCase();
      return (
        e.classification === 'registration_confirmation' ||
        /confirmed:\s*your\s+registration/i.test(subj) ||
        /registration\s+(confirmed|successful|received)/i.test(full) ||
        /successfully\s+registered|thank\s+you\s+for\s+(registering|applying)/i.test(full)
      );
    });

    // Progression stage emails
    const selectionListPattern = /selection\s+list|congratulations.*offer|selected\s+candidates|final\s+select/i;
    const selectionEmails = companyEmails.filter((e) =>
      selectionListPattern.test(e.subject || '')
    );

    const nextRoundPattern =
      /next\s+round\s+of\s+selection|next\s+round\s+is\s+scheduled|interview\s+(?:is\s+)?scheduled|technical\s+interview|hr\s+interview|final\s+interview|interview\s+shortlist|shortlist\s+for\s+interview|shortlisted\s+for\s+(?:the\s+)?interview/i;
    const nextRoundEmails = companyEmails.filter((e) =>
      nextRoundPattern.test(`${e.subject || ''} ${e.body_snippet || ''}`)
    );

    const testShortlistPattern = /shortlist|online\s+test|coding\s+test|assessment|test\s+schedule/i;
    const testShortlistEmails = companyEmails.filter((e) =>
      testShortlistPattern.test(e.subject || '')
    );

    const isMatchedInSelectionList = selectionEmails.some((e) => matchedEmailIds.has(e.id));
    const isMatchedInNextRound = nextRoundEmails.some((e) => matchedEmailIds.has(e.id));
    const isMatchedInTest = testShortlistEmails.some((e) => matchedEmailIds.has(e.id));

    // Extract events
    const allExtractedEvents = companyEmails.flatMap((e) =>
      extractEvents({
        gmailMessageId: e.id,
        threadId: null,
        sender: '',
        senderEmail: '',
        subject: e.subject || '',
        receivedAt: e.received_at ? new Date(e.received_at) : new Date(),
        bodySnippet: e.body_snippet || '',
        bodyPlain: e.body_snippet || '',
        bodyHtml: '',
        hasAttachments: false,
        attachments: [],
        labels: [],
      })
    );

    const hasPptEvent = allExtractedEvents.some((evt) => evt.eventType === 'ppt');

    // ── STATUS COMPUTATION ──
    let computedStatus = 'not_applied';

    if (isWithdrawn) {
      computedStatus = 'declined';
    } else if (selectionEmails.length > 0) {
      // Final selection list is out!
      if (isMatchedInSelectionList) {
        computedStatus = 'selected';
      } else {
        // Not in final selection list -> rejected
        computedStatus = 'rejected';
      }
    } else if (nextRoundEmails.length > 0) {
      // Next round / interview announcement is out!
      if (isMatchedInNextRound) {
        computedStatus = 'interview_scheduled';
      } else {
        // Failed the test round -> rejected
        computedStatus = 'rejected';
      }
    } else if (testShortlistEmails.length > 0) {
      if (isMatchedInTest) {
        computedStatus = 'test_scheduled';
      } else if (hasConfirmedRegistration) {
        computedStatus = 'test_scheduled';
      } else {
        computedStatus = 'not_shortlisted';
      }
    } else if (hasConfirmedRegistration) {
      if (hasPptEvent) {
        computedStatus = 'ppt_scheduled';
      } else {
        computedStatus = 'applied';
      }
    } else {
      computedStatus = 'not_applied';
    }

    const { data: existingApp } = await supabase
      .from('applications')
      .select('status, manual_override, role, ctc, stipend, location')
      .eq('user_id', userId)
      .eq('company_id', comp.id)
      .single();

    const finalStatus = existingApp?.manual_override ? existingApp.status : computedStatus;

    // Sanitize role
    let finalRole = extractedJob.role || existingApp?.role || null;
    if (finalRole && /\byou\s*(?:are|have|re)\b|dear\s|greetings|eligible|registr/i.test(finalRole)) {
      finalRole = extractedJob.role && !/\byou\s*(?:are|have|re)\b/i.test(extractedJob.role) ? extractedJob.role : null;
    }

    await supabase.from('applications').upsert(
      {
        user_id: userId,
        company_id: comp.id,
        status: finalStatus,
        status_source: existingApp?.manual_override ? 'manual_override' : 'sync_reprocess',
        status_confidence: 'high',
        role: finalRole,
        ctc: extractedJob.ctc || existingApp?.ctc || null,
        stipend: extractedJob.stipend || existingApp?.stipend || null,
        location: extractedJob.location || existingApp?.location || null,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'user_id,company_id' }
    );

    // Manage events: purge if eliminated
    if (['withdrawn', 'declined', 'rejected', 'not_shortlisted', 'not_applied'].includes(finalStatus)) {
      await supabase.from('events').delete().eq('user_id', userId).eq('company_id', comp.id);
    } else {
      for (const evt of allExtractedEvents) {
        if (!evt.startTime) continue;
        const startTimeIso = evt.startTime.toISOString();

        const { data: existingEvts } = await supabase
          .from('events')
          .select('id')
          .eq('user_id', userId)
          .eq('company_id', comp.id)
          .eq('event_type', evt.eventType)
          .limit(1);

        if (!existingEvts || existingEvts.length === 0) {
          await supabase.from('events').insert({
            user_id: userId,
            company_id: comp.id,
            event_type: evt.eventType,
            title: `${comp.name} - ${evt.title}`,
            start_time: startTimeIso,
            end_time: evt.endTime ? evt.endTime.toISOString() : null,
            venue: evt.venue,
            mode: evt.mode,
            confidence: evt.confidence,
          });
        }
      }
    }

    updatedAppsCount++;
    applicationResults.push({
      company: comp.name,
      status: finalStatus,
      role: finalRole,
      ctc: extractedJob.ctc,
    });
  }

  return {
    success: true,
    message: `Successfully re-indexed: ${validCompanyMap.size} official NeoPAT drives tracked`,
    neoPatDrivesCount: validCompanyMap.size,
    deletedNonNeoPatCompanies: deletedCompanyNames,
    collegeCircularsLinked: collegeLinkedCount,
    collegeCircularsDiscarded: collegeDiscardedCount,
    updatedApplications: updatedAppsCount,
    results: applicationResults,
  };
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await performReprocess(session.userId);
    return NextResponse.json(res);
  } catch (err) {
    console.error('Reprocess failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reprocess failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await performReprocess(session.userId);
    return NextResponse.json(res);
  } catch (err) {
    console.error('Reprocess failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reprocess failed' },
      { status: 500 }
    );
  }
}
