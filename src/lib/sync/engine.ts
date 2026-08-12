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

  if (accountsError || !accounts || accounts.length === 0) {
    throw new Error('No connected Gmail accounts found. Please connect a Gmail account in Settings.');
  }

  // Fetch user's configured Neo ID
  const { data: userData } = await supabase
    .from('users')
    .select('neo_id')
    .eq('id', userId)
    .single();
  const userNeoId = userData?.neo_id || null;

  // Sort accounts so 'personal' is processed FIRST
  // This allows official NeoPAT emails to establish master company records first
  const sortedAccounts = (accounts as GmailAccount[]).sort((a, b) => {
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
          const maxLimit = account.account_type === 'personal' ? 150 : 60;
          messageIds = await fetchMessageIds(gmail, query, maxLimit);
          nextHistoryId = historyResult.latestHistoryId || (await getProfileHistoryId(gmail));
        }
      } else {
        // Tier 1: Initial Discovery Sync
        progress.phase = 'fetching';
        onProgress?.(progress);

        const afterDate = account.last_sync_at ? new Date(account.last_sync_at) : undefined;
        const query = getPlacementSearchQuery(account.account_type as 'personal' | 'college', afterDate);
        const maxLimit = account.account_type === 'personal' ? 150 : 60;
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

      progress.skippedDuplicates += skippedCount;
      result.skippedDuplicates += skippedCount;
      progress.totalMessages = newMsgIds.length;
      progress.processedMessages = 0;
      onProgress?.(progress);

      // 3. Process each NEW message in controlled concurrency batches (Worker pool: 5)
      progress.phase = 'processing';
      onProgress?.(progress);

      const isPersonal = account.account_type === 'personal';
      const BATCH_SIZE = 5;

      for (let i = 0; i < newMsgIds.length; i += BATCH_SIZE) {
        const batch = newMsgIds.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (msgId) => {
            try {
              // Stage 1: Cheap metadata inspection
              let shouldFetchFull = true;
              if (!isPersonal) {
                const metadata = await fetchMessageMetadata(gmail, msgId);
                const subj = metadata.subject.toLowerCase();
                const isPlacementRelevant =
                  /shortlist|selection|online\s+test|coding\s+test|assessment|interview|ppt|pre-placement|super\s+dream|dream\s+core/i.test(
                    subj
                  );
                if (!isPlacementRelevant) {
                  shouldFetchFull = false;
                }
              }

              if (!shouldFetchFull) {
                return;
              }

              // Stage 2: Full message detail & attachments
              const parsedEmail = await fetchMessageDetail(gmail, msgId);
              progress.currentSubject = parsedEmail.subject.slice(0, 80);

              // Classify the email
              const classification = classifyEmail(parsedEmail);

              // Extract/create company
              let companyId: string | null = null;

              if (classification.companyName) {
                companyId = await upsertCompany(
                  supabase,
                  userId,
                  classification.companyName,
                  isPersonal // ONLY allow creating new companies from Personal account emails
                );

                if (companyId && isPersonal) {
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
                    .select('status')
                    .eq('user_id', userId)
                    .eq('company_id', companyId)
                    .single();

                  let targetStatus = currentApp?.status || 'applied';
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
                  } else if (!currentApp) {
                    targetStatus = 'applied';
                  }

                  await supabase.from('applications').upsert(
                    {
                      user_id: userId,
                      company_id: companyId,
                      status: targetStatus,
                      status_source: 'neopat_personal_email',
                      status_confidence: 'high',
                      applied_at: parsedEmail.receivedAt.toISOString(),
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
                  body_snippet: parsedEmail.bodySnippet
                    ? parsedEmail.bodySnippet.slice(0, 500)
                    : '',
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
          })
        );

        progress.processedMessages = Math.min(i + batch.length, newMsgIds.length);
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

  return result;
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

  // 3. Dynamic Substring Match against existing user companies
  // (e.g. "PlaySimple" in email matches existing "PlaySimple Games" registered from NeoPAT)
  const { data: userCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', userId);

  if (userCompanies && userCompanies.length > 0) {
    const targetLower = normalized.toLowerCase();
    for (const comp of userCompanies) {
      const compLower = comp.name.toLowerCase();
      // Match if one contains the other (e.g. "MUFG" inside "MUFG Financial", or "PlaySimple" in "PlaySimple Games")
      if (compLower.includes(targetLower) || targetLower.includes(compLower)) {
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
