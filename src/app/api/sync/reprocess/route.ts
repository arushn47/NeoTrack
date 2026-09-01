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
export async function performReprocess(userId: string) {
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

  // 2. Fetch ALL stored emails for this user with automatic pagination
  const emails: Array<{
    id: string;
    subject: string | null;
    sender: string | null;
    body_snippet: string | null;
    classification: string | null;
    company_id: string | null;
    received_at: string | null;
  }> = [];

  const pageSize = 1000;
  let page = 0;
  while (true) {
    const { data: chunk, error: chunkErr } = await supabase
      .from('emails')
      .select('id, subject, sender, body_snippet, classification, company_id, received_at')
      .eq('user_id', userId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (chunkErr || !chunk || chunk.length === 0) break;
    emails.push(...chunk);
    if (chunk.length < pageSize) break;
    page++;
  }

  if (emails.length === 0) {
    return { success: true, message: 'No emails found to reprocess', fixed: 0 };
  }

  // Separate emails into NeoPAT emails (noreply.cdcinfo@vitstudent.ac.in) and College circulars
  const isNeoPatSender = (sender: string) => /noreply\.cdcinfo@vitstudent\.ac\.in/i.test(sender);

  const neoPatEmails = emails.filter((e) => isNeoPatSender(e.sender || ''));
  const collegeEmails = emails.filter((e) => !isNeoPatSender(e.sender || ''));

  // 3. Phase 1: Establish Official NeoPAT Companies ONLY
  // ONLY emails from noreply.cdcinfo@vitstudent.ac.in define the company drives in NeoTrack!
  const validCompanyMap = new Map<string, { id: string; canonicalName: string }>(); // name -> { id, canonicalName }
  const validCompanyIdSet = new Set<string>();
  const emailUpdates: Array<{ id: string; company_id: string | null; classification: string; is_relevant: boolean }> = [];

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
      }

      if (comp) {
        validCompanyMap.set(normalized.toLowerCase(), comp);
        validCompanyIdSet.add(comp.id);

        emailUpdates.push({
          id: email.id,
          company_id: comp.id,
          classification: classification.classification,
          is_relevant: true,
        });
      }
    } else {
      emailUpdates.push({
        id: email.id,
        company_id: null,
        classification: classification.classification,
        is_relevant: false,
      });
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

      // 1. Exact match first
      if (validCompanyMap.has(normalized)) {
        matchedCompanyId = validCompanyMap.get(normalized)!.id;
      } else {
        // 2. Substring match with distinct company guards (longest name first)
        const sortedValid = Array.from(validCompanyMap.entries()).sort((a, b) => b[0].length - a[0].length);
        for (const [neoName, comp] of sortedValid) {
          // Guard: Never cross-match EY GDS and EY SAP
          if (
            (neoName.includes('gds') && normalized.includes('sap')) ||
            (neoName.includes('sap') && normalized.includes('gds')) ||
            (!neoName.includes('sap') && !neoName.includes('gds') && (normalized.includes('sap') || normalized.includes('gds'))) ||
            (!normalized.includes('sap') && !normalized.includes('gds') && (neoName.includes('sap') || neoName.includes('gds')))
          ) {
            continue;
          }

          // Guard: Never cross-match Honeywell Aerospace and Honeywell Technology Solutions Lab
          if (
            (neoName.includes('aerospace') && normalized.includes('technology')) ||
            (neoName.includes('technology') && normalized.includes('aerospace'))
          ) {
            continue;
          }

          // Guard: Never cross-match Apple SDET and Apple SRE
          if (
            (neoName.includes('sdet') && normalized.includes('sre')) ||
            (neoName.includes('sre') && normalized.includes('sdet')) ||
            (!neoName.includes('sdet') && !neoName.includes('sre') && (normalized.includes('sdet') || normalized.includes('sre'))) ||
            (!normalized.includes('sdet') && !normalized.includes('sre') && (neoName.includes('sdet') || neoName.includes('sre')))
          ) {
            continue;
          }

          if (neoName.length >= 4 && normalized.length >= 4) {
            if (neoName === normalized || neoName.includes(normalized) || normalized.includes(neoName)) {
              matchedCompanyId = comp.id;
              break;
            }
          }
        }
      }
    }

    if (matchedCompanyId) {
      emailUpdates.push({
        id: email.id,
        company_id: matchedCompanyId,
        classification: classification.classification,
        is_relevant: true,
      });
      collegeLinkedCount++;
    } else {
      emailUpdates.push({
        id: email.id,
        company_id: null,
        classification: classification.classification,
        is_relevant: false,
      });
      collegeDiscardedCount++;
    }
  }

  // Fast Batch Update emails in grouped chunks
  const groupedUpdates = new Map<string, string[]>();
  for (const u of emailUpdates) {
    const key = `${u.company_id || 'null'}|${u.classification}|${u.is_relevant}`;
    if (!groupedUpdates.has(key)) groupedUpdates.set(key, []);
    groupedUpdates.get(key)!.push(u.id);
  }

  for (const [key, ids] of groupedUpdates.entries()) {
    const [compIdStr, cls, isRelStr] = key.split('|');
    const compId = compIdStr === 'null' ? null : compIdStr;
    const isRel = isRelStr === 'true';

    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      await supabase
        .from('emails')
        .update({
          company_id: compId,
          classification: cls as any,
          is_relevant: isRel,
        })
        .in('id', chunk);
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

    // ── STATUS COMPUTATION (Strict not_shortlisted vs rejected vs positive match distinction) ──
    let computedStatus = 'not_applied';

    // 1. Definite Positive Candidate Shortlist / Selection Matches ALWAYS take precedence:
    if (isMatchedInSelectionList) {
      computedStatus = 'selected';
    } else if (isMatchedInNextRound) {
      if (selectionEmails.length > 0) {
        computedStatus = 'rejected';
      } else {
        computedStatus = 'interview_scheduled';
      }
    } else if (isMatchedInTest) {
      if (selectionEmails.length > 0 || nextRoundEmails.length > 0) {
        computedStatus = 'rejected';
      } else {
        computedStatus = 'test_scheduled';
      }
    } else if (isWithdrawn) {
      // 2. Candidate opted out / withdrawn and was not matched in any positive shortlist
      computedStatus = 'declined';
    } else if (selectionEmails.length > 0 || nextRoundEmails.length > 0 || testShortlistEmails.length > 0) {
      // Test, next round, or selection emails were released, but candidate was NEVER matched in any shortlist!
      if (hasConfirmedRegistration) {
        computedStatus = 'not_shortlisted';
      } else {
        computedStatus = 'not_applied';
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

    // Manage events: wipe existing events for this company
    await supabase.from('events').delete().eq('user_id', userId).eq('company_id', comp.id);

    const isOptedOutOrEliminated = ['declined', 'withdrawn', 'not_shortlisted', 'not_applied', 'rejected'].includes(finalStatus);

    if (!isOptedOutOrEliminated) {
      // Sort company emails chronologically (earliest to latest) so latest email timing takes precedence
      const sortedEmails = [...companyEmails].sort((a, b) => {
        const tA = a.received_at ? new Date(a.received_at).getTime() : 0;
        const tB = b.received_at ? new Date(b.received_at).getTime() : 0;
        return tA - tB;
      });

      // Deduplicate: 1 single timing per event stage. Newer email replaces earlier timing!
      const latestEventsByType = new Map<string, any>();
      for (const e of sortedEmails) {
        const evts = extractEvents({
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
        });

        for (const evt of evts) {
          if (!evt.startTime) continue;
          // Store/update with the latest email's extracted event
          latestEventsByType.set(evt.eventType, evt);
        }
      }

      for (const evt of Array.from(latestEventsByType.values())) {
        await supabase.from('events').insert({
          user_id: userId,
          company_id: comp.id,
          event_type: evt.eventType,
          title: `${comp.name} - ${evt.title}`,
          start_time: evt.startTime.toISOString(),
          end_time: evt.endTime ? evt.endTime.toISOString() : null,
          venue: evt.venue,
          mode: evt.mode,
          confidence: evt.confidence,
        });
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
