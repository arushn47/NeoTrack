import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyEmail, extractCompanyName, normalizeCompanyName } from '@/lib/sync/classifier';
import { extractDriveNumber, extractEvents, extractJobDetails, extractTravelRequirement } from '@/lib/sync/events';
import { isFuzzyCompanyMatch } from '@/lib/sync/engine';

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
      .order('received_at', { ascending: true })
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
  // Process NeoPAT circulars chronologically so registration & eligibility emails establish drive identity
  neoPatEmails.sort((a, b) => new Date(a.received_at || 0).getTime() - new Date(b.received_at || 0).getTime());
  const collegeEmails = emails.filter((e) => !isNeoPatSender(e.sender || ''));

  // 3. Phase 1: Establish Official NeoPAT Companies ONLY
  // ONLY emails from noreply.cdcinfo@vitstudent.ac.in define the company drives in NeoTrack!
  const validCompanyMap = new Map<string, { id: string; canonicalName: string; activeDriveDate: Date }>(); // name -> { id, canonicalName, activeDriveDate }
  const driveNumberToCompanyMap = new Map<string, { id: string; canonicalName: string; activeDriveDate: Date }>(); // drive_number (pat-PL-*) -> comp
  const validCompanyIdSet = new Set<string>();
  const emailUpdates: Array<{ id: string; company_id: string | null; classification: string; is_relevant: boolean }> = [];

  for (const email of neoPatEmails) {
    const subject = email.subject || '';
    const sender = email.sender || '';
    const bodySnippet = email.body_snippet || '';
    const emailDate = email.received_at ? new Date(email.received_at) : new Date();
    const fullEmailText = `${subject}\n${bodySnippet}`;
    const driveNumber = extractDriveNumber(fullEmailText);

    const classification = classifyEmail({
      gmailMessageId: email.id,
      threadId: null,
      sender,
      senderEmail: sender.match(/<([^>]+)>/)?.[1] || sender,
      subject,
      receivedAt: emailDate,
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
      let comp: { id: string; canonicalName: string; activeDriveDate: Date } | undefined;

      // 1. Primary Identity Anchor: Check if drive_number matches an already established company
      if (driveNumber && driveNumberToCompanyMap.has(driveNumber)) {
        comp = driveNumberToCompanyMap.get(driveNumber);
      }

      // 2. Name-based lookup if no drive_number match
      if (!comp) {
        if (driveNumber) {
          // If this email has a driveNumber, NEVER reuse a company already bound to a DIFFERENT driveNumber
          const existing = validCompanyMap.get(normalized.toLowerCase());
          if (existing) {
            let boundToAnother = false;
            for (const [dNum, cObj] of driveNumberToCompanyMap.entries()) {
              if (cObj.id === existing.id && dNum !== driveNumber) {
                boundToAnother = true;
                break;
              }
            }
            if (!boundToAnother) {
              comp = existing;
            }
          }
        } else {
          comp = validCompanyMap.get(normalized.toLowerCase());
        }
      }

      if (!comp && !driveNumber) {
        // Also check if any existing NeoPAT drive in validCompanyMap fuzzy matches! (Only for emails without a drive number)
        for (const [validKey, cObj] of validCompanyMap.entries()) {
          // Avoid overly broad single-word matches in Phase 1 (e.g. generic "Honeywell" shouldn't steal a specific division)
          if (normalized.split(/\s+/).length === 1 && cObj.canonicalName.split(/\s+/).length > 2) {
            continue;
          }
          if (isFuzzyCompanyMatch(validKey, normalized) || isFuzzyCompanyMatch(cObj.canonicalName, normalized)) {
            comp = cObj;
            break;
          }
        }
      }

      if (!comp) {
        // Look up existing company by name or alias
        const { data: existingComp } = await supabase
          .from('companies')
          .select('id, name')
          .eq('user_id', userId)
          .eq('name', normalized)
          .single();

        let boundToAnother = false;
        if (existingComp && driveNumber) {
          for (const [dNum, cObj] of driveNumberToCompanyMap.entries()) {
            if (cObj.id === existingComp.id && dNum !== driveNumber) {
              boundToAnother = true;
              break;
            }
          }
        }

        if (existingComp && !boundToAnother) {
          comp = { id: existingComp.id, canonicalName: normalized, activeDriveDate: emailDate };
        } else {
          // Check aliases if not bound to another drive
          const { data: aliasMatch } = !driveNumber
            ? await supabase
                .from('companies')
                .select('id, name')
                .eq('user_id', userId)
                .contains('aliases', [normalized.toLowerCase()])
                .single()
            : { data: null };

          if (aliasMatch) {
            comp = { id: aliasMatch.id, canonicalName: normalized, activeDriveDate: emailDate };
            await supabase
              .from('companies')
              .update({ name: normalized })
              .eq('id', aliasMatch.id);
          } else {
            // Check existing user companies with fuzzy match before creating a duplicate
            const { data: userComps } = await supabase
              .from('companies')
              .select('id, name')
              .eq('user_id', userId);

            let dbFuzzyMatch: { id: string; name: string } | null = null;
            if (userComps && userComps.length > 0) {
              for (const uc of userComps) {
                if (isFuzzyCompanyMatch(uc.name, normalized)) {
                  dbFuzzyMatch = uc;
                  break;
                }
              }
            }

            if (dbFuzzyMatch) {
              const chosenCanonical = normalized.length > dbFuzzyMatch.name.length ? normalized : dbFuzzyMatch.name;
              comp = { id: dbFuzzyMatch.id, canonicalName: chosenCanonical, activeDriveDate: emailDate };
              if (chosenCanonical !== dbFuzzyMatch.name) {
                await supabase.from('companies').update({ name: chosenCanonical }).eq('id', dbFuzzyMatch.id);
              }
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
                comp = { id: newComp.id, canonicalName: normalized, activeDriveDate: emailDate };
              }
            }
          }
        }
      } else {
        // Update activeDriveDate to the latest registered/eligible drive cycle
        if (emailDate > comp.activeDriveDate) {
          comp.activeDriveDate = emailDate;
        }
      }

      if (comp) {
        validCompanyMap.set(comp.canonicalName.toLowerCase(), comp);
        if (
          !validCompanyMap.has(normalized.toLowerCase()) ||
          validCompanyMap.get(normalized.toLowerCase())?.id === comp.id
        ) {
          validCompanyMap.set(normalized.toLowerCase(), comp);
        }
        if (driveNumber) {
          driveNumberToCompanyMap.set(driveNumber, comp);
        }
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
    const emailDate = email.received_at ? new Date(email.received_at) : new Date();

    const classification = classifyEmail({
      gmailMessageId: email.id,
      threadId: null,
      sender,
      senderEmail: sender.match(/<([^>]+)>/)?.[1] || sender,
      subject,
      receivedAt: emailDate,
      bodySnippet,
      bodyPlain: bodySnippet,
      bodyHtml: '',
      hasAttachments: false,
      attachments: [],
      labels: [],
    });

    const fullEmailText = `${subject}\n${bodySnippet}`;
    const driveNumber = extractDriveNumber(fullEmailText);
    const companyName = classification.companyName;
    let matchedCompanyId: string | null = null;

    // 1. Primary Identity Anchor: Drive Number match
    if (driveNumber && driveNumberToCompanyMap.has(driveNumber)) {
      matchedCompanyId = driveNumberToCompanyMap.get(driveNumber)!.id;
    } else if (companyName) {
      const normalized = normalizeCompanyName(companyName).toLowerCase();

      // 2. Exact match first
      if (validCompanyMap.has(normalized)) {
        matchedCompanyId = validCompanyMap.get(normalized)!.id;
      } else {
        // 3. Token-based fuzzy match against legitimate NeoPAT companies
        for (const comp of Array.from(validCompanyMap.values())) {
          if (isFuzzyCompanyMatch(comp.canonicalName, companyName)) {
            matchedCompanyId = comp.id;
            break;
          }
        }
      }
    }

    // 4. Reverse Search fallback: if no match yet, check if any known NeoPAT company name is mentioned in the subject
    if (!matchedCompanyId) {
      const subjectLower = subject.toLowerCase();
      // Sort valid companies by canonical name length descending to match longest first
      const knownCompanies = Array.from(validCompanyMap.values()).sort((a, b) => b.canonicalName.length - a.canonicalName.length);
      
      for (const comp of knownCompanies) {
        if (comp.canonicalName.length < 3) continue; // Skip very short generic names
        const escaped = comp.canonicalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i');
        if (regex.test(subjectLower)) {
          matchedCompanyId = comp.id;
          break;
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

    // 1. Identify true official CDC registration circular with highest precision
    const mainCircularEmail =
      companyEmails.find((e) => {
        const text = `${e.subject || ''}\n${e.body_snippet || ''}`;
        return (
          /name\s+of\s+the\s+company/i.test(text) &&
          /eligibility\s+criteria/i.test(text) &&
          /category/i.test(text)
        );
      }) ||
      companyEmails.find((e) =>
        /super\s*dream.*registration|dream.*registration|placement\s+registration|internship\s+registration|offer\s+registration/i.test(e.subject || '')
      ) ||
      companyEmails.find((e) =>
        /date\s+of\s+visit/i.test(e.body_snippet || '') || /registration/i.test(e.subject || '')
      ) ||
      companyEmails[0];

    const mainEmailText = `${mainCircularEmail.subject || ''}\n${mainCircularEmail.body_snippet || ''}`;
    const mainJobDetails = extractJobDetails(mainEmailText);

    // 2. Extract fallback details from all combined CDC emails only if main circular missed them
    const combinedEmailText = companyEmails
      .map((e) => `${e.subject || ''}\n${e.body_snippet || ''}`)
      .join('\n\n');
    const fallbackJobDetails = extractJobDetails(combinedEmailText);

    const extractedJob = {
      role: mainJobDetails.role || fallbackJobDetails.role,
      category: mainJobDetails.category || fallbackJobDetails.category,
      ctc: mainJobDetails.ctc || fallbackJobDetails.ctc,
      stipend: mainJobDetails.stipend || fallbackJobDetails.stipend,
      location: mainJobDetails.location || fallbackJobDetails.location,
    };

    // Identify user actions & progression from emails
    const withdrawalEmails = companyEmails.filter((e) => {
      const full = `${e.subject || ''} ${e.body_snippet || ''}`.toLowerCase();
      return (
        e.classification === 'withdrawal' ||
        e.classification === 'decline' ||
        /registration.*withdrawn|your registration.*withdrawn|declined\s+drive/i.test(full) ||
        /confirmation.*drive\s+registration\s+update.*withdrawn/i.test(full)
      );
    });

    const latestWithdrawalTime = withdrawalEmails.reduce((max, e) => {
      const t = e.received_at ? new Date(e.received_at).getTime() : 0;
      return Math.max(max, t);
    }, 0);

    const registrationEmails = companyEmails.filter((e) => {
      const subj = (e.subject || '').toLowerCase();
      const full = `${subj} ${e.body_snippet || ''}`.toLowerCase();
      return (
        e.classification === 'registration_confirmation' ||
        /confirmed:\s*your\s+registration/i.test(subj) ||
        /registration\s+(confirmed|successful|received)/i.test(full) ||
        /successfully\s+registered|thank\s+you\s+for\s+(registering|applying)/i.test(full)
      );
    });

    const latestRegistrationTime = registrationEmails.reduce((max, e) => {
      const t = e.received_at ? new Date(e.received_at).getTime() : 0;
      return Math.max(max, t);
    }, 0);

    // ONLY considered withdrawn if the withdrawal occurred AFTER the latest registration confirmation!
    const isWithdrawn = withdrawalEmails.length > 0 && latestWithdrawalTime > latestRegistrationTime;
    const hasConfirmedRegistration = registrationEmails.length > 0 && latestRegistrationTime >= latestWithdrawalTime;

    const isAfterRegistration = (e: { received_at: string | null }) => {
      if (!latestRegistrationTime) return true;
      const t = e.received_at ? new Date(e.received_at).getTime() : 0;
      return t >= (latestRegistrationTime - 2 * 60 * 1000);
    };

    // Progression stage emails (ONLY those on or after latest registration!)
    const selectionListPattern = /selection\s+list|congratulations.*offer|selected\s+candidates|final\s+select/i;
    const selectionEmails = companyEmails.filter((e) =>
      isAfterRegistration(e) && selectionListPattern.test(e.subject || '')
    );

    const nextRoundPattern =
      /next\s+round\s+of\s+selection|next\s+round\s+is\s+scheduled|interview\s+(?:is\s+)?scheduled|technical\s+interview|hr\s+interview|final\s+interview|interview\s+shortlist|shortlist\s+for\s+interview|shortlisted\s+for\s+(?:the\s+)?interview/i;
    const nextRoundEmails = companyEmails.filter((e) =>
      isAfterRegistration(e) && nextRoundPattern.test(`${e.subject || ''} ${e.body_snippet || ''}`)
    );

    const testShortlistPattern = /shortlist\s+(?:for|of)?|test\s+shortlist|shortlisted\s+candidates|shortlisted\s+students/i;
    const testShortlistEmails = companyEmails.filter((e) =>
      isAfterRegistration(e) && testShortlistPattern.test(e.subject || '')
    );

    const testPattern =
      /online\s+test|coding\s+test|aptitude\s+test|assessment\s+test|assessment\s+is\s+scheduled|online\s+assessment|codility|hackerrank|mettl/i;
    const testEmails = companyEmails.filter((e) =>
      isAfterRegistration(e) && testPattern.test(`${e.subject || ''} ${e.body_snippet || ''}`)
    );

    const isMatchedInSelectionList = selectionEmails.some((e) => matchedEmailIds.has(e.id));
    const isMatchedInNextRound = nextRoundEmails.some((e) => matchedEmailIds.has(e.id));
    const isMatchedInTest = companyEmails.some(
      (e) =>
        matchedEmailIds.has(e.id) &&
        (testShortlistPattern.test(e.subject || '') || testPattern.test(`${e.subject || ''} ${e.body_snippet || ''}`))
    );

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

    const hasPptEvent = companyEmails.some((e) => {
      if (!isAfterRegistration(e)) return false;
      const subj = (e.subject || '').toLowerCase();
      const body = (e.body_snippet || '').toLowerCase();
      return /ppt|pre[\s-]*placement\s*talk/i.test(subj) || /pre[\s-]*placement\s*talk/i.test(body);
    });

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
      // 2. Candidate opted out / withdrawn
      computedStatus = 'declined';
    } else if (hasConfirmedRegistration) {
      // 3. Candidate registered for this drive:
      if (selectionEmails.length > 0 || nextRoundEmails.length > 0 || testShortlistEmails.length > 0 || testEmails.length > 0) {
        // A test, interview, or selection list was released for this drive, and the user was NOT shortlisted in it
        computedStatus = 'not_shortlisted';
      } else if (hasPptEvent) {
        computedStatus = 'ppt_scheduled';
      } else {
        computedStatus = 'applied';
      }
    } else if (selectionEmails.length > 0 || nextRoundEmails.length > 0 || testShortlistEmails.length > 0 || testEmails.length > 0) {
      // Candidate never registered for this drive
      computedStatus = 'not_applied';
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

    // Sanitize role: It must not be category name, prose, or invitation phrases
    let finalRole = existingApp?.manual_override ? existingApp.role : (extractedJob.role || extractJobDetails(combinedEmailText).role);
    if (finalRole && (
      /\byou\s*(?:are|have|re)\b|dear\s|greetings|eligible|registr|for the candidate|reserve a position|expect them/i.test(finalRole) ||
      /^(?:super\s+dream|dream|regular)(?:\s+(?:internship|offer|placement|drive))?$/i.test(finalRole.trim())
    )) {
      finalRole = null;
    }

    // Extract Drive Mode strictly from the main registration/announcement circular email
    const travelReq = extractTravelRequirement(mainEmailText);

    // Job Work Location (e.g. Remote, Bengaluru, Gurugram, Pan India)
    let workLocation = extractedJob.location || null;
    if (workLocation && /please find|attached shortlisted|services interested|as per business|nonsense|come at|economy class|round trip|placement office|\bpre$/i.test(workLocation)) {
      workLocation = null;
    }
    // Filter out campus/drive venue names — these are interview locations, not job work locations
    if (workLocation && /^(?:vit\s+)?(?:vellore|chennai|bhopal)(?:\s+campus)?$/i.test(workLocation.trim())) {
      workLocation = null;
    }
    if (workLocation) {
      if (/remote/i.test(workLocation)) workLocation = 'Remote';
      else if (/pan\s+india/i.test(workLocation)) workLocation = 'Pan India';
    }

    // VIT Placement Policy:
    // Touching or above 10 LPA (or max of CTC range >= 10) -> Super Dream
    // Below 10 LPA -> Dream (>= 4.5) or Regular (< 4.5)
    let finalCategory = extractedJob.category || null;
    const finalCtc = existingApp?.manual_override ? existingApp.ctc : (extractedJob.ctc || null);
    if (finalCtc) {
      const matches = [...finalCtc.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
      if (matches.length > 0) {
        const maxCtc = Math.max(...matches);
        const isIntern = Boolean(extractedJob.stipend || existingApp?.stipend) || /internship|intern\b/i.test(mainEmailText);
        if (maxCtc >= 10) {
          finalCategory = isIntern ? 'Super Dream Internship' : 'Super Dream Offer';
        } else if (maxCtc >= 4.5) {
          finalCategory = isIntern ? 'Dream Internship' : 'Dream Offer';
        } else {
          finalCategory = 'Regular Offer';
        }
      }
    }

    await supabase.from('applications').upsert(
      {
        user_id: userId,
        company_id: comp.id,
        status: finalStatus,
        status_source: existingApp?.manual_override ? 'manual_override' : 'sync_reprocess',
        status_confidence: 'high',
        role: finalRole,
        category: finalCategory,
        ctc: finalCtc,
        stipend: existingApp?.manual_override ? existingApp.stipend : (extractedJob.stipend || null),
        location: workLocation || 'Pan India / Remote',
        notes: travelReq || null,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'user_id,company_id' }
    );

    // Manage events: fetch manual events and only wipe automated events for this company
    const { data: manualEvents } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', comp.id)
      .eq('manual_override', true);

    await supabase
      .from('events')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', comp.id)
      .eq('manual_override', false);

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
          // Unify coding_test and online_test under the same key so duplicate wordings collapse into a single assessment round
          const normalizedKey =
            evt.eventType === 'coding_test' || evt.eventType === 'online_test'
              ? 'online_test'
              : evt.eventType;
          const existing = latestEventsByType.get(normalizedKey);

          // If we already recorded an event with an explicit time (e.g. "3:30 pm"),
          // and this newer email only has a generic date without time (default 9am),
          // preserve the exact time while upgrading venue/mode if provided!
          if (existing && existing.hasExplicitTime && !evt.hasExplicitTime) {
            latestEventsByType.set(normalizedKey, {
              ...existing,
              venue: evt.venue && evt.venue !== 'Campus / Offline' ? evt.venue : existing.venue,
              mode: evt.mode !== 'unknown' ? evt.mode : existing.mode,
            });
          } else {
            latestEventsByType.set(normalizedKey, evt);
          }
        }
      }

      // Check which event types already have a manual override event so automated events don't duplicate them
      const manualEventTypes = new Set(
        (manualEvents || []).map((m) =>
          m.event_type === 'coding_test' ? 'online_test' : m.event_type
        )
      );

      for (const evt of Array.from(latestEventsByType.values())) {
        const normalizedKey =
          evt.eventType === 'coding_test' || evt.eventType === 'online_test'
            ? 'online_test'
            : evt.eventType;

        if (manualEventTypes.has(normalizedKey)) {
          // Preserve the manual/chatbot event for this stage
          continue;
        }

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
          manual_override: false,
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
    message: `Successfully re-indexed: ${validCompanyIdSet.size} official NeoPAT drives tracked`,
    neoPatDrivesCount: validCompanyIdSet.size,
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
