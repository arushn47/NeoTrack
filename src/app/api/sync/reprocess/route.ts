import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyEmail, extractCompanyName, normalizeCompanyName } from '@/lib/sync/classifier';
import { extractEvents, extractJobDetails } from '@/lib/sync/events';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Re-indexes all stored emails, cleans up invalid companies (e.g. Google, PS Associate Engineer),
 * fixes company names (e.g. EY -> EY GDS), and recalculates exact application statuses and events.
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

  // 1. Clean invalid candidate matches where match was merely the recipient email address
  if (userEmail) {
    const regMatch = userEmail.match(/([0-9]{2}[a-z]{3}[0-9]{4,5})/i);
    const regNo = regMatch ? regMatch[1].toUpperCase() : '';
    
    // Delete email_body matches that matched the recipient email or had no valid Neo ID
    const { data: allMatches } = await supabase
      .from('candidate_matches')
      .select('id, match_type, matched_value')
      .eq('user_id', userId);

    const matchesToDelete = (allMatches || []).filter((m) => {
      if (m.match_type === 'xlsx_cell') return false; // Keep verified Excel matches
      const val = (m.matched_value || '').toUpperCase();
      // If the match was just the user's registration number or email in headers, delete it
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

  // 2. Fetch ALL emails for this user
  const { data: emails, error: emailsError } = await supabase
    .from('emails')
    .select('id, subject, sender, body_snippet, classification, company_id, received_at')
    .eq('user_id', userId);

  if (emailsError || !emails || emails.length === 0) {
    return { success: true, message: 'No emails found to reprocess', fixed: 0 };
  }

  // 3. Re-evaluate company extraction & classification for EVERY email
  const companyNameToId = new Map<string, string>();
  let unlinkedCount = 0;
  let reclassifiedCount = 0;

  for (const email of emails) {
    const subject = email.subject || '';
    const sender = email.sender || '';
    const bodySnippet = email.body_snippet || '';

    // Classify email with updated rules
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
    const isPlacementRelevant = !['irrelevant', 'unclassified', 'general'].includes(
      classification.classification
    );

    if (companyName && isPlacementRelevant) {
      const normalized = normalizeCompanyName(companyName);

      // Get or create company
      let compId = companyNameToId.get(normalized);
      if (!compId) {
        const { data: existingComp } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', userId)
          .eq('name', normalized)
          .single();

        if (existingComp) {
          compId = existingComp.id;
        } else {
          // Check aliases match
          const { data: aliasMatch } = await supabase
            .from('companies')
            .select('id')
            .eq('user_id', userId)
            .contains('aliases', [normalized.toLowerCase()])
            .single();

          if (aliasMatch) {
            compId = aliasMatch.id;
            // Update name to canonical (e.g. EY -> EY GDS)
            await supabase
              .from('companies')
              .update({ name: normalized })
              .eq('id', compId);
          } else {
            // Insert clean company
            const { data: newComp } = await supabase
              .from('companies')
              .insert({
                user_id: userId,
                name: normalized,
                aliases: [normalized.toLowerCase(), companyName.toLowerCase()],
              })
              .select('id')
              .single();
            compId = newComp?.id;
          }
        }
        if (compId) companyNameToId.set(normalized, compId);
      }

      // Link email to clean company
      await supabase
        .from('emails')
        .update({
          company_id: compId || null,
          classification: classification.classification,
          is_relevant: true,
        })
        .eq('id', email.id);

      reclassifiedCount++;
    } else {
      // Unlink non-company / irrelevant emails (e.g. Google security notifications, role links)
      await supabase
        .from('emails')
        .update({
          company_id: null,
          classification: classification.classification,
          is_relevant: false,
        })
        .eq('id', email.id);

      unlinkedCount++;
    }
  }

  // 4. Delete Fake / Orphan Companies (e.g. Google, PS Associate Engineer)
  const { data: allCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', userId);

  const deletedCompanies: string[] = [];
  const INVALID_COMPANY_NAMES = [
    'google', 'ps associate engineer', 'ps associate software engineer',
    'associate engineer', 'associate software engineer', 'software engineer',
    'data scientist', 'data analyst', 'placement drive',
  ];

  for (const comp of allCompanies || []) {
    const isExplicitlyInvalid = INVALID_COMPANY_NAMES.some(
      (inv) => comp.name.toLowerCase().trim() === inv
    );

    const { count } = await supabase
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('company_id', comp.id);

    if (isExplicitlyInvalid || count === 0) {
      // Delete events, applications, candidate matches, and company
      await supabase.from('events').delete().eq('user_id', userId).eq('company_id', comp.id);
      await supabase.from('applications').delete().eq('user_id', userId).eq('company_id', comp.id);
      await supabase.from('notifications').delete().eq('user_id', userId).eq('company_id', comp.id);
      await supabase.from('companies').delete().eq('user_id', userId).eq('id', comp.id);
      deletedCompanies.push(comp.name);
    }
  }

  // 5. Fetch updated list of remaining legitimate companies
  const { data: validCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', userId);

  // Fetch updated candidate matches
  const { data: candidateMatches } = await supabase
    .from('candidate_matches')
    .select('id, match_type, email_id')
    .eq('user_id', userId);

  let updatedAppsCount = 0;
  const applicationResults: Array<{ company: string; status: string; role?: string | null }> = [];

  for (const comp of validCompanies || []) {
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

    // Combine email text for details
    const combinedEmailText = companyEmails
      .map((e) => `${e.subject || ''}\n${e.body_snippet || ''}`)
      .join('\n\n');

    const extractedJob = extractJobDetails(combinedEmailText);

    // Identify email types
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

    // Candidate match verification
    const isMatchedInSelectionList = selectionEmails.some((e) => matchedEmailIds.has(e.id));
    const isMatchedInNextRound = nextRoundEmails.some((e) => matchedEmailIds.has(e.id));
    const isMatchedInTest = testShortlistEmails.some((e) => matchedEmailIds.has(e.id));

    // Extract events across all emails for this company
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
        // Did not make final selection list -> rejected
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
      // Test schedule or shortlist
      if (isMatchedInTest) {
        computedStatus = 'test_scheduled';
      } else if (hasConfirmedRegistration) {
        // Registered and waiting for test
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

    // Get existing application record
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

    // Upsert application
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

    // Manage events: if rejected/withdrawn/not_shortlisted, delete events
    if (['withdrawn', 'declined', 'rejected', 'not_shortlisted', 'not_applied'].includes(finalStatus)) {
      await supabase.from('events').delete().eq('user_id', userId).eq('company_id', comp.id);
    } else {
      // Re-insert valid events with deduplication
      for (const evt of allExtractedEvents) {
        if (!evt.startTime) continue;
        const startTimeIso = evt.startTime.toISOString();

        // Check if event already exists
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
    });
  }

  return {
    success: true,
    message: 'Placement feed successfully re-indexed and cleaned',
    totalEmailsScanned: emails.length,
    reclassifiedEmails: reclassifiedCount,
    unlinkedIrrelevantEmails: unlinkedCount,
    deletedInvalidCompanies: deletedCompanies,
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
