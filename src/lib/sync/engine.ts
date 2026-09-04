import {
  createGmailClient,
  fetchMessageIds,
  fetchMessageDetail,
  getPlacementSearchQuery,
  type GmailAccount,
  type ParsedEmail,
} from '@/lib/gmail/client';
import {
  classifyEmail,
  extractCompanyName,
  normalizeCompanyName,
  type ClassificationResult,
} from '@/lib/sync/classifier';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// Sync Progress Types
// ============================================

export interface SyncProgress {
  phase: 'initializing' | 'fetching' | 'processing' | 'complete' | 'error';
  accountEmail: string;
  accountType: string;
  totalMessages: number;
  processedMessages: number;
  newEmails: number;
  newCompanies: number;
  skippedDuplicates: number;
  errors: string[];
  currentSubject?: string;
}

export interface SyncResult {
  totalEmailsFetched: number;
  totalEmailsProcessed: number;
  newEmails: number;
  newCompanies: number;
  skippedDuplicates: number;
  errors: string[];
  accounts: {
    email: string;
    accountType: string;
    emailsFetched: number;
    emailsProcessed: number;
    newEmails: number;
    newCompanies: number;
  }[];
}

// ============================================
// Sync Engine
// ============================================

/**
 * Runs the full email sync for a user.
 * Fetches emails from all connected Gmail accounts,
 * classifies them, extracts companies, and stores in database.
 *
 * @param userId - The user's UUID
 * @param onProgress - Optional callback for streaming progress updates
 */
export async function runSync(
  userId: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const supabase = createAdminClient();

  // 1. Get all connected Gmail accounts for this user
  const { data: accounts, error: accountsError } = await supabase
    .from('gmail_accounts')
    .select('id, email, account_type, access_token_encrypted, refresh_token_encrypted, token_expiry, last_sync_at, last_history_id')
    .eq('user_id', userId)
    .eq('is_connected', true);

  if (accountsError) {
    throw new Error(`Failed to fetch Gmail accounts: ${accountsError.message}`);
  }

  const connectedAccounts = (accounts || []) as GmailAccount[];
  const hasPersonal = connectedAccounts.some((a) => a.account_type === 'personal');
  const hasCollege = connectedAccounts.some((a) => a.account_type === 'college');

  // Fetch user's configured Neo ID
  const { data: userData } = await supabase
    .from('users')
    .select('neo_id')
    .eq('id', userId)
    .single();
  const userNeoId = userData?.neo_id || null;

  // RULE: Guard sync until user completes all 3 onboarding setup items
  if (!hasPersonal || !hasCollege || !userNeoId) {
    const missing: string[] = [];
    if (!hasPersonal) missing.push('Personal Gmail (for NeoPAT drives)');
    if (!hasCollege) missing.push('College Gmail (for CTC/JDs)');
    if (!userNeoId) missing.push('NeoPAT Registration ID');

    throw new Error(
      `Complete setup to sync: Please add ${missing.join(', ')} in Settings.`
    );
  }

  // Sort accounts so 'personal' is processed FIRST
  // This allows official NeoPAT emails to establish master company records first
  const sortedAccounts = connectedAccounts.sort((a, b) => {
    if (a.account_type === 'personal' && b.account_type !== 'personal') return -1;
    if (a.account_type !== 'personal' && b.account_type === 'personal') return 1;
    return 0;
  });

  const result: SyncResult = {
    totalEmailsFetched: 0,
    totalEmailsProcessed: 0,
    newEmails: 0,
    newCompanies: 0,
    skippedDuplicates: 0,
    errors: [],
    accounts: [],
  };

  // 2. Process each account
  for (const account of sortedAccounts) {
    const accountResult = {
      email: account.email,
      accountType: account.account_type,
      emailsFetched: 0,
      emailsProcessed: 0,
      newEmails: 0,
      newCompanies: 0,
    };

    const progress: SyncProgress = {
      phase: 'initializing',
      accountEmail: account.email,
      accountType: account.account_type,
      totalMessages: 0,
      processedMessages: 0,
      newEmails: 0,
      newCompanies: 0,
      skippedDuplicates: 0,
      errors: [],
    };

    onProgress?.(progress);

    try {
      // Create authenticated Gmail client
      const { gmail } = await createGmailClient(account);
      const { fetchHistoryChanges, getProfileHistoryId } = await import('@/lib/gmail/history');
      const { fetchMessageMetadata } = await import('@/lib/gmail/client');

      let messageIds: string[] = [];
      let nextHistoryId: string | null = null;

      // Tier 2: Incremental Sync via history.list if last_history_id exists
      if (account.last_history_id) {
        progress.phase = 'fetching';
        onProgress?.(progress);

        const historyResult = await fetchHistoryChanges(gmail, account.last_history_id);
        if (!historyResult.historyExpired) {
          messageIds = historyResult.messageIds;
          nextHistoryId = historyResult.latestHistoryId;
        } else {
          // Fall back to targeted search if history expired (>30 days)
          const afterDate = account.last_sync_at ? new Date(account.last_sync_at) : undefined;
          const query = getPlacementSearchQuery(account.account_type as 'personal' | 'college', afterDate);
          const maxLimit = account.account_type === 'personal' ? 1000 : 2500;
          messageIds = await fetchMessageIds(gmail, query, maxLimit);
          nextHistoryId = historyResult.latestHistoryId || (await getProfileHistoryId(gmail));
        }
      } else {
        // Tier 1: Initial Discovery Sync
        progress.phase = 'fetching';
        onProgress?.(progress);

        const afterDate = account.last_sync_at ? new Date(account.last_sync_at) : undefined;
        const query = getPlacementSearchQuery(account.account_type as 'personal' | 'college', afterDate);
        const maxLimit = account.account_type === 'personal' ? 2500 : 5000;
        messageIds = await fetchMessageIds(gmail, query, maxLimit);
        nextHistoryId = await getProfileHistoryId(gmail);
      }

      accountResult.emailsFetched = messageIds.length;

      // Fast Pre-Check: Fetch all existing gmail_message_ids for this account in ONE DB call
      const { data: existingRows } = await supabase
        .from('emails')
        .select('gmail_message_id')
        .eq('gmail_account_id', account.id);

      const existingSet = new Set((existingRows || []).map((r) => r.gmail_message_id));
      const newMsgIds = messageIds.filter((id) => !existingSet.has(id));
      const skippedCount = messageIds.length - newMsgIds.length;

      // Ensure messages are processed in chronological order (oldest to newest)
      // Gmail messages.list returns newest first, so reversing gives chronological order.
      const chronoSortedMsgIds = [...newMsgIds].reverse();

      progress.skippedDuplicates += skippedCount;
      result.skippedDuplicates += skippedCount;
      progress.totalMessages = chronoSortedMsgIds.length;
      progress.processedMessages = 0;
      onProgress?.(progress);

      // 3. Process each NEW message in controlled concurrency batches (Worker pool: 5)
      progress.phase = 'processing';
      onProgress?.(progress);

      const isPersonal = account.account_type === 'personal';
      const BATCH_SIZE = 5;

      // Known NeoPAT/CDC senders that always pass (no keyword check needed)
      const TRUSTED_PLACEMENT_SENDERS = [
        'noreply.cdcinfo@vitstudent.ac.in',
        'cdcinfo@vitstudent.ac.in',
        'vitlions2027@vitbhopal.ac.in',
        'placementoffice@vitbhopal.ac.in',
      ];
      // Trust entire @vitstudent.ac.in domain on personal accounts — these are all CDC/NeoPAT
      const isTrustedSender = (senderEmail: string) =>
        isPersonal
          ? /@vitstudent\.ac\.in$/i.test(senderEmail)
          : TRUSTED_PLACEMENT_SENDERS.includes(senderEmail.toLowerCase());

      // Known non-placement senders to always skip (Google, Microsoft notifications, social media, etc.)
      const BLOCKED_SENDERS = /noreply-accounts@google|no-reply@accounts\.google|noreply@github|notifications@github|@linkedin\.com|@facebookmail|@discord|@slack|noreply@medium|noreply@.*\.zoom\.us|security-noreply|account-security|password.*reset|verify.*email|do-not-reply@|mailer-daemon/i;

      for (let i = 0; i < chronoSortedMsgIds.length; i += BATCH_SIZE) {
        const batch = chronoSortedMsgIds.slice(i, i + BATCH_SIZE);

        for (const msgId of batch) {
            try {
              // Stage 1: Cheap metadata inspection — filter out non-placement emails
              // For BOTH personal and college accounts during incremental sync (history.list),
              // we must verify each email is placement-relevant before full processing.
              let shouldFetchFull = true;
              const metadata = await fetchMessageMetadata(gmail, msgId);
              const subj = metadata.subject.toLowerCase();
              const senderLower = metadata.senderEmail.toLowerCase();

              // A. Always block known non-placement senders
              if (BLOCKED_SENDERS.test(senderLower)) {
                shouldFetchFull = false;
              }
              // B. Always allow trusted CDC/NeoPAT senders
              else if (isTrustedSender(senderLower)) {
                shouldFetchFull = true;
              }
              // C. For all other senders, require placement keywords in subject
              else {
                const isPlacementRelevant =
                  /shortlist|selection|online\s+test|coding\s+test|assessment|interview|ppt|pre-placement|super\s+dream|dream\s+core|registration|internship|placement\s+drive|campus\s+drive|hiring|cdc\s+info|candidate\s+information|offer|joining|onboarding/i.test(
                    subj
                  );
                if (!isPlacementRelevant) {
                  shouldFetchFull = false;
                }
              }

              if (!shouldFetchFull) {
                continue;
              }

              // Stage 2: Full message detail & attachments
              const parsedEmail = await fetchMessageDetail(gmail, msgId);
              progress.currentSubject = parsedEmail.subject.slice(0, 80);

              // Classify the email
              const classification = classifyEmail(parsedEmail);

              // Extract/create company
              // GUARD: Don't create companies from irrelevant/unclassified/general emails.
              // These are noise (Google notifications, account updates, etc.) that slipped
              // through the metadata filter.
              let companyId: string | null = null;
              const isPlacementClassification = !['irrelevant', 'unclassified', 'general'].includes(
                classification.classification
              );

              if (classification.companyName && isPlacementClassification) {
                // RULE: ONLY emails from noreply.cdcinfo@vitstudent.ac.in (the official NeoPAT sender)
                // on the personal account are allowed to create new companies.
                // College emails have thousands of drives for all branches/batches and should
                // ONLY match against existing NeoPAT companies for enrichment/verification.
                const isNeoPatEmail =
                  isPersonal &&
                  /noreply\.cdcinfo@vitstudent\.ac\.in/i.test(
                    parsedEmail.senderEmail || parsedEmail.sender
                  );
                const allowCreate = isNeoPatEmail;

                companyId = await upsertCompany(
                  supabase,
                  userId,
                  classification.companyName,
                  allowCreate
                );

                if (companyId) {
                  // Check if this is a newly created company
                  const { count } = await supabase
                    .from('emails')
                    .select('id', { count: 'exact', head: true })
                    .eq('company_id', companyId);

                  if (count === 0) {
                    progress.newCompanies++;
                    accountResult.newCompanies++;
                    result.newCompanies++;
                  }

                  // Check current application status first
                  const { data: currentApp } = await supabase
                    .from('applications')
                    .select('status, applied_at')
                    .eq('user_id', userId)
                    .eq('company_id', companyId)
                    .single();

                  // Determine the correct default status for NEW companies:
                  // - Registration/JD emails → 'not_applied' (just announced, not yet applied)
                  // - Registration confirmations → 'applied' (confirmed participation)
                  // - Existing apps keep their current status
                  const isConfirmation =
                    classification.classification === 'registration_confirmation' ||
                    /registration\s+confirm|successfully\s+register|application\s+received|you\s+have\s+registered/i.test(
                      (parsedEmail.bodyPlain || parsedEmail.bodySnippet || '')
                    );

                  let targetStatus = currentApp?.status || (isConfirmation ? 'applied' : 'not_applied');
                  const text = (
                    parsedEmail.subject +
                    ' ' +
                    (parsedEmail.bodyPlain || parsedEmail.bodySnippet || '')
                  ).toLowerCase();

                  if (
                    text.includes('decline') ||
                    text.includes('opted out') ||
                    text.includes('opt-out') ||
                    text.includes('withdrawn') ||
                    text.includes('withdraw')
                  ) {
                    targetStatus = 'withdrawn';
                  } else if (
                    currentApp?.status === 'withdrawn' ||
                    currentApp?.status === 'declined'
                  ) {
                    targetStatus = currentApp.status; // Keep withdrawn!
                  } else if (
                    text.includes('not eligible') ||
                    text.includes('ineligible')
                  ) {
                    targetStatus = 'not_applied';
                  } else if (isConfirmation) {
                    targetStatus = 'applied';
                  }

                  await supabase.from('applications').upsert(
                    {
                      user_id: userId,
                      company_id: companyId,
                      status: targetStatus,
                      status_source: isPersonal ? 'neopat_personal_email' : 'college_email_announcement',
                      status_confidence: 'high',
                      applied_at: currentApp?.applied_at || parsedEmail.receivedAt.toISOString(),
                      last_updated: new Date().toISOString(),
                    },
                    { onConflict: 'user_id,company_id' }
                  );
                }
              }

              // Insert email into DB
              const { data: insertedEmail, error: insertError } = await supabase
                .from('emails')
                .insert({
                  user_id: userId,
                  gmail_account_id: account.id,
                  company_id: companyId,
                  gmail_message_id: parsedEmail.gmailMessageId,
                  thread_id: parsedEmail.threadId,
                  subject: parsedEmail.subject,
                  sender: parsedEmail.sender,
                  received_at: parsedEmail.receivedAt.toISOString(),
                  body_snippet: (parsedEmail.bodyPlain || parsedEmail.bodySnippet || '').slice(0, 10000),
                  classification: classification.classification,
                  is_processed: true,
                  is_relevant: classification.classification !== 'irrelevant',
                  processed_at: new Date().toISOString(),
                })
                .select('id')
                .single();

              if (insertError) {
                if (insertError.code === '23505') {
                  progress.skippedDuplicates++;
                  result.skippedDuplicates++;
                } else {
                  console.error(`Failed to insert email ${msgId}:`, insertError);
                  progress.errors.push(
                    `Failed to store email: ${parsedEmail.subject.slice(0, 50)}`
                  );
                  result.errors.push(insertError.message);
                }
              } else {
                progress.newEmails++;
                accountResult.newEmails++;
                result.newEmails++;

                // Process for Events, CTC, Roles, and Neo ID matching if linked to a company
                if (companyId && insertedEmail) {
                  const { processEmailForEventsAndStatus } = await import(
                    '@/lib/sync/status-engine'
                  );
                  await processEmailForEventsAndStatus(
                    supabase,
                    userId,
                    companyId,
                    parsedEmail,
                    insertedEmail.id,
                    userNeoId,
                    account.email,
                    gmail
                  );
                }
              }

              accountResult.emailsProcessed++;
              result.totalEmailsProcessed++;
            } catch (emailErr) {
              const errMsg =
                emailErr instanceof Error ? emailErr.message : String(emailErr);
              console.error(`Error processing message ${msgId}:`, errMsg);
              progress.errors.push(`Error processing message: ${errMsg.slice(0, 80)}`);
              result.errors.push(errMsg);
            }
        }

        progress.processedMessages = Math.min(i + batch.length, chronoSortedMsgIds.length);
        onProgress?.(progress);
      }

      // 4. Update last_sync_at and last_history_id
      await supabase
        .from('gmail_accounts')
        .update({
          last_sync_at: new Date().toISOString(),
          last_history_id: nextHistoryId || account.last_history_id,
        })
        .eq('id', account.id);

    } catch (accountErr) {
      const errMsg =
        accountErr instanceof Error ? accountErr.message : String(accountErr);
      console.error(`Sync failed for account ${account.email}:`, errMsg);
      progress.phase = 'error';
      progress.errors.push(errMsg);
      result.errors.push(`Account ${account.email}: ${errMsg}`);
      onProgress?.(progress);
    }

    result.totalEmailsFetched += accountResult.emailsFetched;
    result.totalEmailsProcessed += accountResult.emailsProcessed;
    result.accounts.push(accountResult);
  }

  // 5. If new companies were created, reconcile any unlinked college circulars in DB
  if (result.newCompanies > 0) {
    try {
      const { data: unlinkedEmails } = await supabase
        .from('emails')
        .select('id, subject, sender, body_snippet, received_at')
        .eq('user_id', userId)
        .is('company_id', null);

      if (unlinkedEmails && unlinkedEmails.length > 0) {
        const { data: allUserComps } = await supabase
          .from('companies')
          .select('id, name, aliases')
          .eq('user_id', userId);

        if (allUserComps && allUserComps.length > 0) {
          for (const email of unlinkedEmails) {
            const compName = extractCompanyName(
              email.subject || '',
              email.sender || '',
              email.body_snippet || ''
            );
            if (compName) {
              const norm = normalizeCompanyName(compName).toLowerCase();
              const matched = allUserComps.find((c) => {
                const cLower = c.name.toLowerCase();
                return (
                  cLower === norm ||
                  (c.aliases || []).includes(norm) ||
                  isFuzzyCompanyMatch(c.name, compName)
                );
              });
              if (matched) {
                await supabase
                  .from('emails')
                  .update({ company_id: matched.id, is_relevant: true })
                  .eq('id', email.id);
              }
            }
          }
        }
      }
    } catch (reconcileErr) {
      console.warn('Post-sync circular reconciliation non-critical error:', reconcileErr);
    }
  }

  return result;
}

// ============================================
// Company Matching Helpers
// ============================================

const GENERIC_MATCH_TOKENS = new Set([
  'pvt', 'ltd', 'limited', 'private', 'inc', 'corp', 'corporation',
  'co', 'company', 'llc', 'llp', 'solutions', 'services', 'technologies',
  'technology', 'tech', 'group', 'india', 'global', 'international',
  'systems', 'consulting', 'software', 'infotech', 'infosystems',
  'super', 'dream', 'regular', 'core', 'internship', 'placement', 'drive',
  'finance', 'batch', '2026', '2027', '2028', 'urgent', 'extended', 'deadline',
  'update', 'updated', 'campus', 'hiring', 'recruitment', 'talk', 'test',
]);

/**
 * Robust fuzzy matcher for company names based on distinctive token overlap.
 * Prevents false matches (e.g. "Kinaxis Super Dream" matching "Superjoin Finance").
 */
export function isFuzzyCompanyMatch(compName: string, targetName: string): boolean {
  const cLower = compName.toLowerCase().trim();
  const tLower = targetName.toLowerCase().trim();

  // Guard: Never merge distinct role tracks or divisions (SDET, SRE, SAP, GDS, Aerospace) with base company or each other
  const trackTokens = ['sdet', 'sre', 'sap', 'gds', 'aerospace'];
  for (const tok of trackTokens) {
    if (
      (cLower.includes(tok) && !tLower.includes(tok)) ||
      (!cLower.includes(tok) && tLower.includes(tok))
    ) {
      return false;
    }
  }

  if (cLower === tLower) return true;

  const cTokens = cLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !GENERIC_MATCH_TOKENS.has(w));

  const tTokens = tLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !GENERIC_MATCH_TOKENS.has(w));

  if (cTokens.length === 0 || tTokens.length === 0) {
    return false;
  }

  // Match if all distinctive tokens of target exist in comp, or vice versa
  const allTargetInComp = tTokens.every((t) =>
    cTokens.some((c) => c === t || (c.length >= 5 && t.length >= 5 && (c.startsWith(t) || t.startsWith(c))))
  );
  const allCompInTarget = cTokens.every((c) =>
    tTokens.some((t) => c === t || (c.length >= 5 && t.length >= 5 && (c.startsWith(t) || t.startsWith(c))))
  );

  return allTargetInComp || allCompInTarget;
}

// ============================================
// Company Upsert
// ============================================

/**
 * Creates or retrieves a company by name for a given user.
 * Handles normalization and alias checking.
 */
async function upsertCompany(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  companyName: string,
  allowCreate: boolean = true
): Promise<string | null> {
  const normalized = normalizeCompanyName(companyName);

  if (!normalized || normalized.length < 2) return null;

  // 1. Check exact name match for this user
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .eq('name', normalized)
    .single();

  if (existing) {
    return existing.id;
  }

  // 2. Check aliases match
  const { data: aliasMatch } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .contains('aliases', [normalized.toLowerCase()])
    .single();

  if (aliasMatch) {
    return aliasMatch.id;
  }

  // 3. Dynamic Token Match against existing user companies
  // (e.g. "PlaySimple" in email matches existing "PlaySimple Games" registered from NeoPAT)
  const { data: userCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', userId);

  if (userCompanies && userCompanies.length > 0) {
    for (const comp of userCompanies) {
      if (isFuzzyCompanyMatch(comp.name, normalized)) {
        return comp.id;
      }
    }
  }

  // 4. If no match found and allowCreate is false (e.g. College email), DO NOT create!
  if (!allowCreate) {
    return null;
  }

  // 5. If no match found and allowCreate is true (Personal email), create new company
  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      user_id: userId,
      name: normalized,
      aliases: [normalized.toLowerCase(), companyName.toLowerCase()].filter(
        (v, i, a) => a.indexOf(v) === i // Deduplicate
      ),
    })
    .select('id')
    .single();

  if (error) {
    // Unique constraint violation — race condition, fetch existing
    if (error.code === '23505') {
      const { data: refetch } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', userId)
        .eq('name', normalized)
        .single();
      return refetch?.id || null;
    }
    console.error('Failed to create company:', error);
    return null;
  }

  return newCompany?.id || null;
}

// ============================================
// Helpers
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
