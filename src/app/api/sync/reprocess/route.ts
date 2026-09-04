import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyEmail, cleanCompanyName, extractCompanyName, normalizeCompanyName, isInvalidCompanyName } from '@/lib/sync/classifier';
import { extractDriveNumber, extractEvents, extractJobDetails, extractTravelRequirement } from '@/lib/sync/events';
import { isFuzzyCompanyMatch } from '@/lib/sync/engine';
import {
  buildCircularCatalog,
  loadAllDriveResolutions,
  resolveDriveByTimingCorrelation,
} from '@/lib/sync/drive-correlator';

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
    .select('neo_id, email, name')
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

  // 2.5 Dynamic Timing Correlation Setup
  const circularCatalog = buildCircularCatalog(collegeEmails);
  const persistedResolutions = await loadAllDriveResolutions(supabase);
  const driveResolutionsMap = new Map<string, string>();
  for (const [dNum, r] of persistedResolutions.entries()) {
    driveResolutionsMap.set(dNum, r.resolvedCompanyName);
  }

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
    }, driveResolutionsMap);

    let companyName = classification.companyName;
    const isPlacement = !['irrelevant', 'unclassified', 'general'].includes(classification.classification);

    // If this NeoPAT email has a drive number and was identified with a base company (like 'Apple' or 'Honeywell'),
    // run timing correlation against circular catalog to resolve specific track (e.g. Apple SDET vs Apple SRE)
    if (driveNumber && companyName && isPlacement) {
      const baseClean = cleanCompanyName(companyName);
      if (['Apple', 'Honeywell', 'Zluri', 'EY'].some((b) => b.toLowerCase() === baseClean.toLowerCase())) {
        const resolution = await resolveDriveByTimingCorrelation(
          supabase,
          driveNumber,
          baseClean,
          emailDate,
          circularCatalog,
          persistedResolutions
        );
        if (resolution) {
          companyName = resolution.resolvedCompanyName;
          driveResolutionsMap.set(driveNumber, resolution.resolvedCompanyName);
        }
      }
    }

    if (companyName && isPlacement) {
      const normalized = normalizeCompanyName(companyName);
      if (!normalized || isInvalidCompanyName(normalized)) {
        continue;
      }
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
              let chosenCanonical = normalized.length > dbFuzzyMatch.name.length ? normalized : dbFuzzyMatch.name;
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

  // Register legitimate standalone circular drives (e.g. Honeywell Technologies 2027 Batch)
  for (const email of collegeEmails) {
    const subject = email.subject || '';
    if (/honeywell\s+dream\s+internship\s+registration/i.test(subject)) {
      const canonical = 'Honeywell Technologies';
      let { data: existingComp } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', userId)
        .eq('name', canonical)
        .single();

      if (!existingComp) {
        const { data: created } = await supabase
          .from('companies')
          .insert({
            user_id: userId,
            name: canonical,
            aliases: [canonical.toLowerCase()],
          })
          .select('id')
          .single();
        if (created) existingComp = { id: created.id, name: canonical };
      }

      if (existingComp) {
        const compObj = { id: existingComp.id, canonicalName: canonical, activeDriveDate: new Date(email.received_at || 0) };
        validCompanyMap.set(canonical.toLowerCase(), compObj);
        validCompanyIdSet.add(existingComp.id);
      }
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
    }, driveResolutionsMap);

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

    // 4. Reverse Search fallback: ONLY if no company was extracted at all from the email
    // (If an email was already confidently identified as another company like "Altair Engineering",
    // do NOT hijack it to a different company like "Siemens" just because the word appears in parentheses!)
    if (!matchedCompanyId && !companyName) {
      // Strip parenthetical corporate affiliations (e.g. "(A Siemens Company)", "(A Subsidiary of ...)")
      const sanitizedSubject = subject.replace(/\((?:a|an|the)?\s*[^)]*?(?:company|group|subsidiary|division)[^)]*\)/gi, ' ');
      const subjectLower = sanitizedSubject.toLowerCase();
      // Sort valid companies by canonical name length descending to match longest first
      const knownCompanies = Array.from(validCompanyMap.values()).sort((a, b) => b.canonicalName.length - a.canonicalName.length);
      
      for (const comp of knownCompanies) {
        if (comp.canonicalName.length < 4 || isInvalidCompanyName(comp.canonicalName)) continue; // Skip short or generic names
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
    .select('id, match_type, email_id, matched_value')
    .eq('user_id', userId);

  let updatedAppsCount = 0;
  const applicationResults: Array<{ company: string; status: string; role?: string | null; ctc?: string | null }> = [];

  for (const comp of remainingCompanies || []) {
    if (/honeywell/i.test(comp.name) && !/aerospace/i.test(comp.name) && comp.name !== 'Honeywell Technologies') {
      await supabase.from('companies').update({ name: 'Honeywell Technologies' }).eq('id', comp.id);
      comp.name = 'Honeywell Technologies';
    }
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

    // 0. Scan any Google Sheets pubhtml shortlists in company emails for candidate matches
    const { extractGoogleSheetUrls, scanGoogleSheetForCandidate } = await import('@/lib/sync/gsheet-parser');
    const gsheetEventsForCompany: Array<{
      eventType: string;
      title: string;
      startTime: Date;
      venue: string;
      mode: string;
      confidence: string;
      hasExplicitTime: boolean;
    }> = [];

    for (const email of companyEmails) {
      const emailText = `${email.subject || ''}\n${email.body_snippet || ''}`;
      const isRelevantCandidateEmail =
        /shortlist|selection|selected|test|assessment|interview|score|rank|eligible|candidates|students/i.test(
          emailText
        );
      if (!isRelevantCandidateEmail) continue;

      const gUrls = extractGoogleSheetUrls(emailText);
      for (const gUrl of gUrls) {
        const gMatch = await scanGoogleSheetForCandidate(gUrl, userEmail, userNeoId, userData?.name);
        if (gMatch && gMatch.matched) {
          matchedEmailIds.add(email.id);
          // Persist match in candidate_matches if not already present
          const alreadyMatched = (candidateMatches || []).some(
            (cm) => (cm as unknown as { email_id: string }).email_id === email.id
          );
          if (!alreadyMatched) {
            await supabase.from('candidate_matches').insert({
              user_id: userId,
              email_id: email.id,
              neo_id: userNeoId || userEmail,
              match_type: 'xlsx_cell',
              matched_value: gMatch.details,
              confidence: 'high',
            });
          }

          if (gMatch.eventDate) {
            const startTime = new Date(gMatch.eventDate);
            startTime.setHours(gMatch.slot && /slot\s*2/i.test(gMatch.slot) ? 14 : 9, 0, 0, 0);
            gsheetEventsForCompany.push({
              eventType: 'online_test',
              title: `Online Assessment${gMatch.slot ? ` (${gMatch.slot})` : ''}`,
              startTime,
              venue: 'Campus / Offline',
              mode: 'online',
              confidence: 'high',
              hasExplicitTime: true,
            });
          }
          break;
        }
      }
    }

    // Sort company emails descending (newest first) so recent circulars take precedence
    const sortedCompanyEmails = [...companyEmails].sort(
      (a, b) => new Date(b.received_at || 0).getTime() - new Date(a.received_at || 0).getTime()
    );

    // 1. Identify true official CDC registration circular with highest precision (newest first)
    const mainCircularEmail =
      sortedCompanyEmails.find((e) => {
        const text = `${e.subject || ''}\n${e.body_snippet || ''}`;
        return (
          /name\s+of\s+the\s+company/i.test(text) &&
          /eligibility\s+criteria/i.test(text) &&
          /category/i.test(text)
        );
      }) ||
      sortedCompanyEmails.find((e) =>
        /super\s*dream.*registration|dream.*registration|placement\s+registration|internship\s+registration|offer\s+registration/i.test(e.subject || '')
      ) ||
      sortedCompanyEmails.find((e) =>
        /date\s+of\s+visit/i.test(e.body_snippet || '') || /registration/i.test(e.subject || '')
      ) ||
      sortedCompanyEmails[0];

    // Drive Date Temporal Boundary:
    // "only consider emails after the drive time or date"
    // If an official registration circular exists for the drive (e.g. Honeywell Dream Internship on Aug 29),
    // any emails received before this drive date are from older completed cycles or irrelevant historical emails.
    const isRegistrationCircular = (e: { subject?: string | null; body_snippet?: string | null }) => {
      const text = `${e.subject || ''}\n${e.body_snippet || ''}`;
      return (
        (/name\s+of\s+the\s+company/i.test(text) && /category/i.test(text)) ||
        /super\s*dream.*registration|dream.*registration|placement\s+registration|internship\s+registration/i.test(
          e.subject || ''
        )
      );
    };

    // Find the earliest official registration circular of the active drive cluster
    const registrationCirculars = companyEmails.filter(isRegistrationCircular);
    registrationCirculars.sort(
      (a, b) => new Date(a.received_at || 0).getTime() - new Date(b.received_at || 0).getTime()
    );
    const driveRegistrationEmail = registrationCirculars[0] || mainCircularEmail;
    const driveStartDate = driveRegistrationEmail?.received_at
      ? new Date(driveRegistrationEmail.received_at)
      : null;

    // Filter out emails before driveStartDate (with 2-hour delivery buffer)
    const activeDriveEmails = driveStartDate
      ? sortedCompanyEmails.filter((e) => {
          const t = e.received_at ? new Date(e.received_at).getTime() : 0;
          return t >= driveStartDate.getTime() - 2 * 60 * 60 * 1000;
        })
      : sortedCompanyEmails;

    // Unlink any emails in DB that were received prior to the active drive start date,
    // but NEVER unlink personal withdrawal / decline confirmation emails!
    if (driveStartDate) {
      const stalePriorEmailIds = companyEmails
        .filter((e) => {
          if (e.classification === 'withdrawal' || e.classification === 'decline') return false;
          if (/withdrawn|declined/i.test(e.subject || '')) return false;
          const t = e.received_at ? new Date(e.received_at).getTime() : 0;
          return t < driveStartDate.getTime() - 2 * 60 * 60 * 1000;
        })
        .map((e) => e.id);

      if (stalePriorEmailIds.length > 0) {
        await supabase
          .from('emails')
          .update({ company_id: null, is_relevant: false })
          .in('id', stalePriorEmailIds);
      }
    }

    const mainEmailText = `${mainCircularEmail.subject || ''}\n${mainCircularEmail.body_snippet || ''}`;
    const mainJobDetails = extractJobDetails(mainEmailText);

    // 2. Extract fallback details from combined active CDC emails only if main circular missed them
    // Strictly filter out test announcements and shortlist circulars to prevent test venue/lab instructions from polluting job details
    const jobDetailEligibleEmails = activeDriveEmails.filter((e) => {
      const cls = e.classification || '';
      if (['test', 'venue_update', 'shortlist', 'interview', 'withdrawal', 'decline'].includes(cls)) return false;
      const subj = (e.subject || '').toLowerCase();
      if (/online\s+test|coding\s+test|shortlist|interview\s+is\s+scheduled/i.test(subj)) return false;
      return true;
    });

    const combinedEmailText = (jobDetailEligibleEmails.length > 0 ? jobDetailEligibleEmails : activeDriveEmails)
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

    // Identify user actions & progression from active drive emails
    const withdrawalEmails = companyEmails.filter((e) => {
      const full = `${e.subject || ''} ${e.body_snippet || ''}`.toLowerCase();
      // Exclude broadcast circulars mentioning opt-out policy or forms
      if (
        /who\s+(?:wish|want)\s+to\s+opt|if\s+you\s+(?:wish|want)\s+to\s+opt|opt[\s-]*out\s+(?:form|link|google|portal)|voluntary\s+withdrawal\s+only|forms\.gle/i.test(
          full
        )
      ) {
        return false;
      }
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

    const registrationEmails = activeDriveEmails.filter((e) => {
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
    const selectionEmails = activeDriveEmails.filter((e) =>
      isAfterRegistration(e) && selectionListPattern.test(e.subject || '')
    );

    const nextRoundPattern =
      /next\s+round\s+of\s+selection|next\s+round\s+is\s+scheduled|interview\s+(?:is\s+)?scheduled|technical\s+interview|hr\s+interview|final\s+interview|interview\s+shortlist|shortlist\s+for\s+interview|shortlisted\s+for\s+(?:the\s+)?interview/i;
    const nextRoundEmails = activeDriveEmails.filter((e) =>
      isAfterRegistration(e) && nextRoundPattern.test(`${e.subject || ''} ${e.body_snippet || ''}`)
    );

    const isInterviewOrSelectionEmail = (e: { subject?: string | null; body_snippet?: string | null }) => {
      const full = `${e.subject || ''} ${e.body_snippet || ''}`;
      return nextRoundPattern.test(full) || selectionListPattern.test(e.subject || '');
    };

    const testShortlistPattern =
      /test\s+shortlist|shortlist\s+for\s+(?:the\s+)?(?:test|assessment|exam)|shortlisted\s+for\s+(?:the\s+)?(?:online\s+)?(?:test|assessment)|candidate[s]?\s+shortlisted|shortlisted\s+(?:candidates|students)|shortlist\s+will\s+be\s+shared|only\s+shortlisted\s+students|attached\s+(?:updated\s+)?shortlist|\bneo\s+id\b|attached\s+(?:students?|candidates?)\s+list|find\s+the\s+attached\s+(?:students?|candidates?)\s+list/i;
    const testShortlistEmails = activeDriveEmails.filter((e) => {
      if (!isAfterRegistration(e)) return false;
      if (isInterviewOrSelectionEmail(e)) return false; // Next round / interview is NOT a test shortlist!
      if (e.classification === 'shortlist') return true;
      const full = `${e.subject || ''} ${e.body_snippet || ''}`;
      return testShortlistPattern.test(full);
    });

    const testPattern =
      /online\s+test|coding\s+test|aptitude\s+test|assessment\s+test|assessment\s+is\s+scheduled|online\s+assessment|codility|hackerrank|mettl/i;
    const testEmails = activeDriveEmails.filter((e) =>
      isAfterRegistration(e) && testPattern.test(`${e.subject || ''} ${e.body_snippet || ''}`)
    );

    // Differentiate matches in actual shortlists vs applied/opt-in lists
    const matchedShortlistEmailIds = new Set(
      (candidateMatches || [])
        .filter((m) => {
          if (m.match_type === 'xlsx_applied_list') return false;
          const val = (m.matched_value || '').toLowerCase();
          if (/applied[_\s-]*list|opt[_\s-]*in[_\s-]*list|opt_in|registration[_\s-]*list|applied[_\s-]*student|applied[_\s-]*candidate/i.test(val)) return false;
          return true;
        })
        .map((m) => (m as unknown as { email_id: string }).email_id)
        .filter(Boolean)
    );

    const isMatchedInSelectionList = selectionEmails.some((e) => matchedShortlistEmailIds.has(e.id));
    const isMatchedInNextRound = nextRoundEmails.some((e) => matchedShortlistEmailIds.has(e.id));
    const hasCompanyCandidateMatch = activeDriveEmails.some((e) => matchedEmailIds.has(e.id));

    // Test Shortlists evaluation:
    // Candidate wrote the test if:
    // 1. Confirmed in Google Sheet assessment slots
    // 2. OR matched in an actual test shortlist file / test announcement email (excluding applied/opt-in lists)
    const isMatchedInActualTestShortlist = activeDriveEmails.some(
      (e) => !isInterviewOrSelectionEmail(e) && matchedShortlistEmailIds.has(e.id)
    );

    // Only confirmed test rosters (Google Sheet slot or verified Excel shortlist) count as having written the test
    const isMatchedInTest = gsheetEventsForCompany.length > 0 || isMatchedInActualTestShortlist;

    // Extract events
    const allExtractedEvents = activeDriveEmails.flatMap((e) =>
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

    const hasPptEvent = activeDriveEmails.some((e) => {
      if (!isAfterRegistration(e)) return false;
      const subj = (e.subject || '').toLowerCase();
      const body = (e.body_snippet || '').toLowerCase();
      return /ppt|pre[\s-]*placement\s*talk/i.test(subj) || /pre[\s-]*placement\s*talk/i.test(body);
    });

    // ── STATUS COMPUTATION (Strict withdrawal priority & test verification) ──
    let computedStatus = 'not_applied';

    // Positive Match Timestamp Check:
    // If a genuine positive match (test shortlist, interview, or selection list) occurs strictly AFTER
    // the withdrawal timestamp (e.g. EY GDS test shortlist issued after an earlier withdrawal),
    // allow the positive match to override the withdrawal.
    const positiveMatchedEmails = activeDriveEmails.filter((e) => matchedShortlistEmailIds.has(e.id));
    const latestPositiveMatchEmailTime = positiveMatchedEmails.reduce((max, e) => {
      const t = e.received_at ? new Date(e.received_at).getTime() : 0;
      return Math.max(max, t);
    }, 0);

    const latestGsheetTime = gsheetEventsForCompany.reduce((max, g) => {
      const t = g.startTime ? new Date(g.startTime).getTime() : 0;
      return Math.max(max, t);
    }, 0);

    const latestPositiveMatchTime = Math.max(latestPositiveMatchEmailTime, latestGsheetTime);

    const genuinePositiveMatchAfterWithdrawal =
      isWithdrawn &&
      (isMatchedInSelectionList || isMatchedInNextRound || isMatchedInTest) &&
      latestPositiveMatchTime > latestWithdrawalTime;

    // 1. Withdrawal / Opt-Out takes precedence UNLESS a genuine positive match occurred after withdrawal
    if (isWithdrawn && !genuinePositiveMatchAfterWithdrawal) {
      computedStatus = 'withdrawn';
    } else if (isMatchedInSelectionList) {
      // 2. Definite Positive Candidate Shortlist / Selection Matches:
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
    } else if (
      hasConfirmedRegistration ||
      activeDriveEmails.some((e) => e.classification === 'registration' || /registration/i.test(e.subject || ''))
    ) {
      // 3. Candidate registered / applied for this drive:
      if (testShortlistEmails.length > 0 || selectionEmails.length > 0 || nextRoundEmails.length > 0) {
        // A test shortlist, interview, or selection list was released, and candidate was not in the latest shortlist!
        computedStatus = 'not_shortlisted';
      } else if (testEmails.length > 0) {
        // Open test announced for all registered students (no restrictive shortlist)
        computedStatus = 'test_scheduled';
      } else if (hasPptEvent) {
        computedStatus = 'ppt_scheduled';
      } else {
        computedStatus = 'applied';
      }
    } else if (hasCompanyCandidateMatch) {
      if (testShortlistEmails.length > 0 || selectionEmails.length > 0 || nextRoundEmails.length > 0) {
        computedStatus = 'not_shortlisted';
      } else if (testEmails.length > 0) {
        computedStatus = 'test_scheduled';
      } else if (hasPptEvent) {
        computedStatus = 'ppt_scheduled';
      } else {
        computedStatus = 'applied';
      }
    } else if (selectionEmails.length > 0 || nextRoundEmails.length > 0 || testShortlistEmails.length > 0 || testEmails.length > 0) {
      computedStatus = 'not_applied';
    } else {
      computedStatus = 'not_applied';
    }

    const { data: existingApp } = await supabase
      .from('applications')
      .select('status, manual_override, role, ctc, stipend, location, notes, applied_at')
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
    const travelReq = extractTravelRequirement(mainEmailText) || extractTravelRequirement(combinedEmailText);
    const existingTravel = existingApp?.notes ? existingApp.notes.split('\n')[0]?.trim() : null;
    const hasCampusLabEvent = allExtractedEvents.some((e) => /campus\s*\/\s*offline|\blc\s*\d+\b|\blab\b/i.test(e.venue || ''));
    const hasOnlineEvent = allExtractedEvents.some((e) => e.mode === 'online' || /online|virtual/i.test(e.venue || ''));

    let finalTravel = existingApp?.manual_override ? existingTravel : travelReq;
    if (!finalTravel) {
      if (hasCampusLabEvent) finalTravel = 'bhopal_lab';
      else if (hasOnlineEvent) finalTravel = 'online';
      else if (existingTravel && ['bhopal_lab', 'online'].includes(existingTravel)) {
        finalTravel = existingTravel;
      }
    }

    // Job Work Location (e.g. Remote, Bengaluru, Gurugram, Pan India)
    let workLocation = extractedJob.location || null;
    if (
      workLocation &&
      (/\byou\b|\bwe\b|\bi\b|\bcan\b|\bwrite\b|\bwant\b|\btest\b|\blab\b|\blc\s*\d+|\bsjt|\bprp|\banna|\bhall\b|---|forwarded|own\s+location|\b(?:lc|sjt|prp|tt|mb|cb|smv)\s*\d+\b|please find|attached shortlisted|services interested|as per business|nonsense|come at|economy class|round trip|placement office|\bpre$/i.test(
        workLocation
      ) ||
        /^(?:vit\s+)?(?:vellore|chennai|bhopal)(?:\s+campus)?$/i.test(workLocation.trim()))
    ) {
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
    const finalStipend = existingApp?.manual_override ? existingApp.stipend : (extractedJob.stipend || null);
    if (finalCtc) {
      const matches = [...finalCtc.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
      if (matches.length > 0) {
        const maxCtc = Math.max(...matches);
        const isIntern = Boolean(finalStipend) || /internship|intern\b/i.test(mainEmailText);
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
        stipend: finalStipend,
        location: workLocation || null,
        notes: finalTravel || null,
        applied_at: driveStartDate ? driveStartDate.toISOString() : (existingApp?.applied_at || new Date().toISOString()),
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

    const isOptedOut = ['declined', 'withdrawn'].includes(finalStatus);

    if (!isOptedOut) {
      // Sort active drive emails chronologically (earliest to latest) so latest email timing takes precedence
      const sortedEmails = [...activeDriveEmails].sort((a, b) => {
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

      // Merge Google Sheet test events if candidate matched in Google Sheet
      for (const gEvt of gsheetEventsForCompany) {
        latestEventsByType.set('online_test', {
          eventType: gEvt.eventType,
          title: gEvt.title,
          startTime: gEvt.startTime,
          endTime: null,
          venue: gEvt.venue,
          mode: gEvt.mode,
          confidence: gEvt.confidence,
          hasExplicitTime: gEvt.hasExplicitTime,
        });
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

        // Progression-based calendar event filtering:
        if (finalStatus === 'not_shortlisted' && normalizedKey !== 'ppt') {
          // Candidate not shortlisted for test/interview; do not schedule test/interview on calendar
          continue;
        }
        if (finalStatus === 'rejected') {
          if (!isMatchedInNextRound && ['interview', 'technical_interview', 'hr_interview', 'final_interview'].includes(normalizedKey)) {
            continue;
          }
          if (!isMatchedInTest && !isMatchedInNextRound && normalizedKey === 'online_test') {
            continue;
          }
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

export async function POST(req: Request) {
  let userId: string | null = null;
  const session = await getSession();
  if (session) {
    userId = session.userId;
  } else {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const url = new URL(req.url);
      const authHeader = req.headers.get('authorization');
      const querySecret = url.searchParams.get('secret') || url.searchParams.get('key');
      const isAuthorized =
        authHeader === `Bearer ${secret}` ||
        authHeader === secret ||
        querySecret === secret;
      if (isAuthorized) {
        userId = url.searchParams.get('userId') || '48380752-3627-4b81-b44a-4e158002902c';
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await performReprocess(userId);
    return NextResponse.json(res);
  } catch (err) {
    console.error('Reprocess failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reprocess failed' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  let userId: string | null = null;
  const session = await getSession();
  if (session) {
    userId = session.userId;
  } else {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const url = new URL(req.url);
      const authHeader = req.headers.get('authorization');
      const querySecret = url.searchParams.get('secret') || url.searchParams.get('key');
      const isAuthorized =
        authHeader === `Bearer ${secret}` ||
        authHeader === secret ||
        querySecret === secret;
      if (isAuthorized) {
        userId = url.searchParams.get('userId') || '48380752-3627-4b81-b44a-4e158002902c';
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await performReprocess(userId);
    return NextResponse.json(res);
  } catch (err) {
    console.error('Reprocess failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reprocess failed' },
      { status: 500 }
    );
  }
}
