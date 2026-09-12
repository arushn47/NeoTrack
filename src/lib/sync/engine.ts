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
  cleanCompanyName,
  extractCompanyName,
  normalizeCompanyName,
  computeNormalizedKey,
  checkAcronymMatch,
  extractCompanyAliases,
  ENGLISH_STOPWORDS,
  type ClassificationResult,
} from '@/lib/sync/classifier';
import { extractDriveNumber } from '@/lib/sync/events';
import {
  buildCircularCatalog,
  loadAllDriveResolutions,
  resolveDriveByTimingCorrelation,
  type CircularRoleEntry,
  type DriveResolutionResult,
} from '@/lib/sync/drive-correlator';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// Sync Progress Types & Constants
// ============================================

export const PAGE_SIZE = 150;

export interface SyncPageRow {
  id: string;
  user_id: string;
  gmail_account_id: string;
  page_index: number;
  message_ids: string[];
  next_offset: number;
  status: 'pending' | 'in_progress' | 'complete';
  created_at?: string;
  updated_at?: string;
}

export interface ProcessPageResult {
  completed: boolean;
  emailsProcessed: number;
  newEmails: number;
  newCompanies: number;
  skippedDuplicates: number;
  errors: string[];
}

export interface SyncProgress {
  phase: 'initializing' | 'fetching' | 'processing' | 'complete' | 'error';
  accountEmail: string;
  accountType: string;
  totalMessages: number;
  processedMessages: number;
  alreadyIndexed?: number;
  remainingMessages?: number;
  isResuming?: boolean;
  newEmails: number;
  newCompanies: number;
  skippedDuplicates: number;
  errors: string[];
  currentSubject?: string;
  isInitialSync?: boolean;
  currentPageIndex?: number;
  totalPagesCount?: number;
  isPage0Complete?: boolean;
}

export interface SyncResult {
  totalEmailsFetched: number;
  totalEmailsProcessed: number;
  newEmails: number;
  newCompanies: number;
  skippedDuplicates: number;
  errors: string[];
  alreadyRunning?: boolean;
  currentPageIndex?: number;
  totalPagesCount?: number;
  isPage0Complete?: boolean;
  hasMorePagesPending?: boolean;
  accounts: {
    email: string;
    accountType: string;
    emailsFetched: number;
    emailsProcessed: number;
    newEmails: number;
    newCompanies: number;
  }[];
}

// Known NeoPAT/CDC senders that always pass (no keyword check needed)
export const TRUSTED_PLACEMENT_SENDERS = [
  'noreply.cdcinfo@vitstudent.ac.in',
  'cdcinfo@vitstudent.ac.in',
  'vitlions2027@vitbhopal.ac.in',
  'placementoffice@vitbhopal.ac.in',
];

// Known non-placement senders to always skip (Google, Microsoft notifications, social media, etc.)
export const BLOCKED_SENDERS = /noreply-accounts@google|no-reply@accounts\.google|noreply@github|notifications@github|@linkedin\.com|@facebookmail|@discord|@slack|noreply@medium|noreply@.*\.zoom\.us|security-noreply|account-security|password.*reset|verify.*email|do-not-reply@|mailer-daemon/i;

export const isTrustedSender = (senderEmail: string, isPersonal: boolean) =>
  isPersonal
    ? /@vitstudent\.ac\.in$/i.test(senderEmail)
    : TRUSTED_PLACEMENT_SENDERS.includes(senderEmail.toLowerCase());

// Retry a Gmail API call with exponential backoff on quota/rate-limit errors
export async function withQuotaBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  const BACKOFF_DELAYS = [10_000, 30_000, 90_000]; // 10s, 30s, 90s
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = /quota exceeded|rate.?limit|units.?per.?minute|rateLimitExceeded/i.test(msg);
      if (isQuota && attempt < maxRetries) {
        const delay = BACKOFF_DELAYS[attempt] ?? 90_000;
        console.warn(`Gmail quota hit — backing off ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('withQuotaBackoff: unreachable');
}

/**
 * Plans count-based sync pages for an account.
 * Slices already-deduped newMsgIds (newest-first, straight from Gmail)
 * into fixed pages of PAGE_SIZE.
 */
export async function planSyncPages(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  account: GmailAccount,
  newMsgIds: string[]
): Promise<SyncPageRow[]> {
  // Check if active (pending or in_progress) pages already exist for this account
  const { data: existingPages } = await supabase
    .from('sync_pages')
    .select('*')
    .eq('gmail_account_id', account.id)
    .order('page_index', { ascending: true });

  const pendingOrActive = (existingPages || []).filter((p) => p.status !== 'complete');
  if (pendingOrActive.length > 0) {
    return existingPages as SyncPageRow[];
  }

  if (!newMsgIds || newMsgIds.length === 0) {
    return [];
  }

  // Slice newMsgIds (newest-first, straight from Gmail) into chunks of PAGE_SIZE
  const pagesToInsert: {
    user_id: string;
    gmail_account_id: string;
    page_index: number;
    message_ids: string[];
    next_offset: number;
    status: 'pending';
  }[] = [];

  for (let i = 0; i < newMsgIds.length; i += PAGE_SIZE) {
    const pageIndex = Math.floor(i / PAGE_SIZE);
    const slice = newMsgIds.slice(i, i + PAGE_SIZE);
    pagesToInsert.push({
      user_id: userId,
      gmail_account_id: account.id,
      page_index: pageIndex,
      message_ids: slice,
      next_offset: 0,
      status: 'pending',
    });
  }

  // Delete any old completed pages for this account before inserting new season plan
  await supabase.from('sync_pages').delete().eq('gmail_account_id', account.id);

  const { data: inserted, error } = await supabase
    .from('sync_pages')
    .insert(pagesToInsert)
    .select('*')
    .order('page_index', { ascending: true });

  if (error) {
    console.error('[planSyncPages] Failed to insert sync pages:', error);
    throw new Error(`Failed to plan sync pages: ${error.message}`);
  }

  return (inserted || []) as SyncPageRow[];
}

/**
 * Processes a single sync page.
 * Reverses ONLY this page's message_ids (giving oldest-to-newest chronological order within this page),
 * preserves per-message processing logic, and respects timeBudgetMs.
 */
export async function processPage(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  account: GmailAccount,
  page: SyncPageRow,
  timeBudgetMs: number,
  deps: {
    userNeoId: string | null;
    userEmail: string;
    circularCatalog: Map<string, any[]>;
    persistedResolutions: Map<string, any>;
    driveResolutionsMap: Map<string, string>;
  },
  onProgress?: (progress: SyncProgress) => void
): Promise<ProcessPageResult> {
  // Mark page in_progress
  await supabase
    .from('sync_pages')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', page.id);

  // Reverse ONLY this page's slice (oldest to newest within this page)
  const chronoSortedMsgIds = [...page.message_ids].reverse();
  const startIndex = page.next_offset || 0;
  const startTime = Date.now();

  const isPersonal = account.account_type === 'personal';
  const isAccountInitialSync = !account.last_history_id;
  const BATCH_SIZE = isAccountInitialSync ? 3 : 5;
  const INTER_BATCH_DELAY_MS = isAccountInitialSync ? 500 : 0;

  const { gmail } = await createGmailClient(account);
  const { fetchMessageMetadata } = await import('@/lib/gmail/client');

  // Pre-check: IDs in this page already in emails table
  const { data: existingRows } = await supabase
    .from('emails')
    .select('gmail_message_id')
    .eq('gmail_account_id', account.id)
    .in('gmail_message_id', chronoSortedMsgIds);

  const existingInDb = new Set((existingRows || []).map((r) => r.gmail_message_id));

  let emailsProcessedCount = 0;
  let newEmailsCount = 0;
  let newCompaniesCount = 0;
  let skippedDuplicatesCount = 0;
  const errorsList: string[] = [];
  let currentIndex = startIndex;

  for (let i = startIndex; i < chronoSortedMsgIds.length; i += BATCH_SIZE) {
    const elapsed = Date.now() - startTime;
    // Check if time budget exceeded before processing next batch
    if (elapsed >= timeBudgetMs && i > startIndex) {
      console.log(`[processPage] Time budget (${timeBudgetMs}ms) reached for page ${page.page_index} at offset ${i}/${chronoSortedMsgIds.length}. Pausing page.`);
      await supabase
        .from('sync_pages')
        .update({
          next_offset: i,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', page.id);

      return {
        completed: false,
        emailsProcessed: emailsProcessedCount,
        newEmails: newEmailsCount,
        newCompanies: newCompaniesCount,
        skippedDuplicates: skippedDuplicatesCount,
        errors: errorsList,
      };
    }

    const batch = chronoSortedMsgIds.slice(i, i + BATCH_SIZE);

    for (const msgId of batch) {
      currentIndex++;

      if (existingInDb.has(msgId)) {
        skippedDuplicatesCount++;
        continue;
      }

      try {
        // Stage 1: Cheap metadata inspection
        let shouldFetchFull = true;
        const metadata = await withQuotaBackoff(() => fetchMessageMetadata(gmail, msgId));
        const subj = metadata.subject.toLowerCase();
        const senderLower = metadata.senderEmail.toLowerCase();

        // A. Always block known non-placement senders
        if (BLOCKED_SENDERS.test(senderLower)) {
          shouldFetchFull = false;
        }
        // B. Always allow trusted CDC/NeoPAT senders
        else if (isTrustedSender(senderLower, isPersonal)) {
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
        const parsedEmail = await withQuotaBackoff(() => fetchMessageDetail(gmail, msgId));

        onProgress?.({
          phase: 'processing',
          accountEmail: account.email,
          accountType: account.account_type,
          totalMessages: chronoSortedMsgIds.length,
          processedMessages: currentIndex,
          currentPageIndex: page.page_index,
          currentSubject: parsedEmail.subject.slice(0, 80),
          newEmails: newEmailsCount,
          newCompanies: newCompaniesCount,
          skippedDuplicates: skippedDuplicatesCount,
          errors: errorsList,
        });

        const fullEmailText = `${parsedEmail.subject}\n${parsedEmail.bodyPlain || parsedEmail.bodySnippet || ''}`;
        const driveNumber = extractDriveNumber(fullEmailText);

        // Classify the email with resolved drive numbers
        const classification = classifyEmail(parsedEmail, deps.driveResolutionsMap);
        let companyName = classification.companyName;

        // Timing correlation
        if (isPersonal && driveNumber && companyName) {
          const baseClean = cleanCompanyName(companyName);
          if (['Apple', 'Honeywell', 'Zluri', 'EY'].some((b) => b.toLowerCase() === baseClean.toLowerCase())) {
            const resolution = await resolveDriveByTimingCorrelation(
              supabase,
              driveNumber,
              baseClean,
              parsedEmail.receivedAt,
              deps.circularCatalog,
              deps.persistedResolutions
            );
            if (resolution) {
              companyName = resolution.resolvedCompanyName;
              deps.driveResolutionsMap.set(driveNumber, resolution.resolvedCompanyName);
            }
          }
        }

        // College role cataloging
        if (!isPersonal) {
          const baseCompanies = ['Apple', 'Honeywell', 'Zluri', 'EY'];
          for (const base of baseCompanies) {
            if (new RegExp(`\\b${base}\\b`, 'i').test(parsedEmail.subject) || new RegExp(`\\b${base}\\b`, 'i').test(parsedEmail.bodyPlain || parsedEmail.bodySnippet || '')) {
              const { extractTrackOrRole } = await import('@/lib/sync/drive-correlator');
              const trackInfo = extractTrackOrRole(fullEmailText, base);
              if (trackInfo) {
                const key = base.toLowerCase();
                if (!deps.circularCatalog.has(key)) deps.circularCatalog.set(key, []);
                deps.circularCatalog.get(key)!.push({
                  emailId: parsedEmail.gmailMessageId,
                  companyBaseName: base,
                  role: trackInfo.role,
                  track: trackInfo.track,
                  resolvedCompanyName: trackInfo.resolvedCompanyName,
                  sourceDate: parsedEmail.receivedAt,
                  subject: parsedEmail.subject,
                });
              }
            }
          }
        }

        let companyId: string | null = null;
        const isPlacementClassification = !['irrelevant', 'unclassified', 'general'].includes(
          classification.classification
        );

        if (companyName && isPlacementClassification) {
          const isNeoPatEmail =
            isPersonal &&
            /noreply\.cdcinfo@vitstudent\.ac\.in/i.test(
              parsedEmail.senderEmail || parsedEmail.sender
            );

          companyId = await upsertCompany(supabase, userId, companyName, isNeoPatEmail);

          if (companyId) {
            // Check if newly created company
            const { count } = await supabase
              .from('emails')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', companyId);

            if (count === 0) {
              newCompaniesCount++;
            }

            // DUAL-WRITE FIX: Baseline initialization only!
            // Do NOT overwrite status with 'withdrawn' or keywords here.
            // Leave all status evaluation, withdrawals, opt-outs, and promotions
            // strictly to processEmailForEventsAndStatus!
            const { data: currentApp } = await supabase
              .from('applications')
              .select('id')
              .eq('user_id', userId)
              .eq('company_id', companyId)
              .single();

            if (!currentApp) {
              await supabase.from('applications').insert({
                user_id: userId,
                company_id: companyId,
                status: 'not_applied',
                status_source: isPersonal ? 'neopat_personal_email' : 'college_email_announcement',
                status_confidence: 'high',
                applied_at: parsedEmail.receivedAt.toISOString(),
                status_source_email_at: parsedEmail.receivedAt.toISOString(),
                last_updated: new Date().toISOString(),
              });
            }
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
            body_snippet: (parsedEmail.bodyPlain || parsedEmail.bodySnippet || '').slice(
              0,
              !isPersonal && isTrustedSender(parsedEmail.senderEmail || parsedEmail.sender, isPersonal) ? 50000 : 10000
            ),
            classification: classification.classification,
            is_processed: true,
            is_relevant: classification.classification !== 'irrelevant',
            processed_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            skippedDuplicatesCount++;
          } else {
            errorsList.push(insertError.message);
          }
        } else {
          newEmailsCount++;

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
              deps.userNeoId,
              account.email,
              gmail
            );
          }
        }

        emailsProcessedCount++;
      } catch (emailErr) {
        const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
        const isQuota = /quota exceeded|rate.?limit|units.?per.?minute/i.test(errMsg);
        if (!isQuota) {
          errorsList.push(errMsg);
        }
      }
    }

    // Persist checkpoint after each batch to survive sudden shutdowns
    await supabase
      .from('sync_pages')
      .update({
        next_offset: currentIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', page.id);

    if (INTER_BATCH_DELAY_MS > 0 && i + BATCH_SIZE < chronoSortedMsgIds.length) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
    }
  }

  // Page exhausted! Mark complete
  await supabase
    .from('sync_pages')
    .update({
      next_offset: chronoSortedMsgIds.length,
      status: 'complete',
      updated_at: new Date().toISOString(),
    })
    .eq('id', page.id);

  return {
    completed: true,
    emailsProcessed: emailsProcessedCount,
    newEmails: newEmailsCount,
    newCompanies: newCompaniesCount,
    skippedDuplicates: skippedDuplicatesCount,
    errors: errorsList,
  };
}

// In-memory active sync trackers (active within current Node.js server process)
const activeSyncMap = new Map<string, SyncProgress>();
const activeSyncLocks = new Set<string>();

export function getActiveSyncProgress(userId: string): SyncProgress | null {
  return activeSyncMap.get(userId) || null;
}

export function isUserSyncActive(userId: string): boolean {
  return activeSyncLocks.has(userId);
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
  onProgress?: (progress: SyncProgress) => void,
  options?: {
    isBackgroundCron?: boolean;
    timeBudgetMs?: number;
  }
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

  // Fetch user's configured Neo ID and email
  const { data: userData } = await supabase
    .from('users')
    .select('neo_id, email')
    .eq('id', userId)
    .single();
  const userNeoId = userData?.neo_id || null;
  const userEmail = userData?.email || '';

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

  // 0. Concurrency Guard: In-memory lock (protects within same process)
  if (activeSyncLocks.has(userId)) {
    console.log(`[Sync Engine] In-memory sync lock active for user ${userId}. Gracefully skipping concurrent request.`);
    return {
      totalEmailsFetched: 0,
      totalEmailsProcessed: 0,
      newEmails: 0,
      newCompanies: 0,
      skippedDuplicates: 0,
      errors: [],
      alreadyRunning: true,
      accounts: [],
    };
  }

  // Check Supabase sync_state table (protects across processes & external 15-min cron)
  try {
    const { data: dbLock } = await supabase
      .from('sync_state')
      .select('is_syncing, updated_at, phase')
      .eq('user_id', userId)
      .single();

    if (dbLock?.is_syncing) {
      const lastUpdated = new Date(dbLock.updated_at || 0).getTime();
      // Active syncs touch updated_at every ~1.5s. If untouched for > 2.5 min, the process died (e.g. laptop shut down)
      const isStale = Date.now() - lastUpdated > 150 * 1000;
      if (!isStale) {
        console.log(`[Sync Engine] User ${userId} sync is already active in database (phase: ${dbLock.phase}, updated: ${dbLock.updated_at}). Gracefully skipping concurrent invocation.`);
        return {
          totalEmailsFetched: 0,
          totalEmailsProcessed: 0,
          newEmails: 0,
          newCompanies: 0,
          skippedDuplicates: 0,
          errors: [],
          alreadyRunning: true,
          accounts: [],
        };
      } else {
        console.warn(`[Sync Engine] Stale sync lock found for user ${userId} (>2.5m untouched, likely crash/shutdown). Overriding lock.`);
      }
    }
  } catch {
    // If sync_state table not yet created in Supabase, proceed with in-memory lock
  }

  // Acquire active lock
  activeSyncLocks.add(userId);

  // Determine if this is an initial discovery sync across any connected account
  const isInitialSync = connectedAccounts.some((a) => !a.last_history_id);

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

  let latestProgress: SyncProgress = {
    phase: 'initializing',
    accountEmail: '',
    accountType: '',
    totalMessages: 0,
    processedMessages: 0,
    newEmails: 0,
    newCompanies: 0,
    skippedDuplicates: 0,
    errors: [],
    isInitialSync,
  };
  activeSyncMap.set(userId, latestProgress);

  let lastDbWriteTime = 0;
  const persistProgressToDb = async (p: SyncProgress, force = false) => {
    activeSyncMap.set(userId, p);
    const now = Date.now();
    if (!force && now - lastDbWriteTime < 1500) return;
    lastDbWriteTime = now;
    try {
      await supabase.from('sync_state').upsert({
        user_id: userId,
        is_syncing: p.phase !== 'complete' && p.phase !== 'error',
        phase: p.phase,
        account_email: p.accountEmail,
        account_type: p.accountType,
        total_messages: p.totalMessages,
        processed_messages: p.processedMessages,
        new_emails: p.newEmails,
        new_companies: p.newCompanies,
        skipped_duplicates: p.skippedDuplicates,
        current_subject: p.currentSubject || null,
        is_initial_sync: isInitialSync,
        current_page_index: p.currentPageIndex ?? 0,
        total_pages: p.totalPagesCount ?? 1,
        updated_at: new Date().toISOString(),
        completed_at: p.phase === 'complete' ? new Date().toISOString() : null,
        last_error: p.errors.length > 0 ? p.errors[p.errors.length - 1] : null,
      });
    } catch {
      // Gracefully ignore if sync_state table not yet created
    }
  };

  const notifyProgress = (p: SyncProgress, forceDb = false) => {
    latestProgress = p;
    p.isInitialSync = isInitialSync;
    onProgress?.(p);
    persistProgressToDb(p, forceDb);
  };

  notifyProgress(latestProgress, true);

  try {
    // Lazy caches for drive resolutions and circular catalog
    // IMPORTANT: These are NOT fetched upfront to prevent burning Supabase egress when sync is idle.
    let persistedResolutions: Map<string, DriveResolutionResult> | null = null;
    let driveResolutionsMap: Map<string, string> | null = null;
    let circularCatalog: Map<string, CircularRoleEntry[]> | null = null;

    const getDriveResolutions = async () => {
      if (persistedResolutions && driveResolutionsMap) {
        return { persistedResolutions, driveResolutionsMap };
      }
      persistedResolutions = await loadAllDriveResolutions(supabase);
      driveResolutionsMap = new Map<string, string>();
      for (const [dNum, r] of persistedResolutions.entries()) {
        driveResolutionsMap.set(dNum, r.resolvedCompanyName);
      }
      return { persistedResolutions, driveResolutionsMap };
    };

    const getCircularCatalog = async () => {
      if (circularCatalog) return circularCatalog;
      // Pre-fetch ONLY the specific base companies needed by buildCircularCatalog
      // This prevents loading all 1,500+ circulars with 50KB bodies on every sync run
      const { data: storedCirculars } = await supabase
        .from('emails')
        .select('id, subject, sender, body_snippet, received_at')
        .eq('user_id', userId)
        .not('sender', 'ilike', '%noreply.cdcinfo@vitstudent.ac.in%')
        .or('subject.ilike.%apple%,subject.ilike.%honeywell%,subject.ilike.%zluri%,subject.ilike.%ey%');

      circularCatalog = buildCircularCatalog(storedCirculars || []);
      return circularCatalog;
    };

    // 2. Process each account using count-based, resumable pages
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
        isInitialSync,
      };

      notifyProgress(progress, true);

      try {
        const { gmail } = await createGmailClient(account);
        const { fetchHistoryChanges, getProfileHistoryId } = await import('@/lib/gmail/history');

        // Check for active or pending pages for this account
        const { data: existingPages } = await supabase
          .from('sync_pages')
          .select('*')
          .eq('gmail_account_id', account.id)
          .order('page_index', { ascending: true });

        let pages: SyncPageRow[] = (existingPages || []) as SyncPageRow[];
        let pendingPages = pages.filter((p) => p.status !== 'complete');

        // If no pending pages exist, check Gmail for new messages and plan pages
        if (pendingPages.length === 0) {
          progress.phase = 'fetching';
          notifyProgress(progress);

          let messageIds: string[] = [];
          let nextHistoryId: string | null = null;

          if (account.last_history_id) {
            const historyResult = await fetchHistoryChanges(gmail, account.last_history_id);
            if (!historyResult.historyExpired) {
              messageIds = historyResult.messageIds;
              nextHistoryId = historyResult.latestHistoryId;
            } else {
              const afterDate = account.last_sync_at ? new Date(account.last_sync_at) : undefined;
              const query = getPlacementSearchQuery(account.account_type as 'personal' | 'college', afterDate);
              const maxLimit = account.account_type === 'personal' ? 1000 : 2500;
              messageIds = await fetchMessageIds(gmail, query, maxLimit);
              nextHistoryId = historyResult.latestHistoryId || (await getProfileHistoryId(gmail));
            }
          } else {
            const afterDate = account.last_sync_at ? new Date(account.last_sync_at) : undefined;
            const query = getPlacementSearchQuery(account.account_type as 'personal' | 'college', afterDate);
            const maxLimit = account.account_type === 'personal' ? 2500 : 5000;
            messageIds = await fetchMessageIds(gmail, query, maxLimit);
            nextHistoryId = await getProfileHistoryId(gmail);
          }

          accountResult.emailsFetched = messageIds.length;

          // Fast Pre-Check: Filter out emails already in DB
          const { data: existingRows } = await supabase
            .from('emails')
            .select('gmail_message_id')
            .eq('gmail_account_id', account.id);

          const existingSet = new Set((existingRows || []).map((r) => r.gmail_message_id));
          const newMsgIds = messageIds.filter((id) => !existingSet.has(id));
          const skippedCount = messageIds.length - newMsgIds.length;

          progress.skippedDuplicates += skippedCount;
          result.skippedDuplicates += skippedCount;

          if (newMsgIds.length > 0) {
            pages = await planSyncPages(supabase, userId, account, newMsgIds);
            pendingPages = pages.filter((p) => p.status !== 'complete');
          } else {
            // No new emails to process
            await supabase
              .from('gmail_accounts')
              .update({
                last_sync_at: new Date().toISOString(),
                last_history_id: nextHistoryId || account.last_history_id,
              })
              .eq('id', account.id);
          }
        }

        // If there are pending pages, process the appropriate page
        if (pendingPages.length > 0) {
          // Foreground: ALWAYS target Page 0 if pending (most recent ~150 emails).
          // If Page 0 is already complete, target the lowest pending page.
          // Background cron: target lowest pending page.
          let targetPage = pendingPages.find((p) => p.page_index === 0);
          if (!targetPage || (options?.isBackgroundCron && targetPage.status === 'complete')) {
            targetPage = pendingPages[0];
          }

          const totalPagesCount = pages.length;
          const targetIndex = targetPage.page_index;
          progress.phase = 'processing';
          progress.currentPageIndex = targetIndex;
          progress.totalPagesCount = totalPagesCount;
          progress.totalMessages = targetPage.message_ids.length;
          progress.processedMessages = targetPage.next_offset || 0;
          notifyProgress(progress, true);

          const timeBudgetMs = options?.timeBudgetMs || (options?.isBackgroundCron ? 45_000 : 40_000);

          // Lazy-load drive resolutions and catalog only when a page is actively being processed
          const { persistedResolutions: pRes, driveResolutionsMap: dMap } = await getDriveResolutions();
          const cCatalog = await getCircularCatalog();

          const pageRes = await processPage(
            supabase,
            userId,
            account,
            targetPage,
            timeBudgetMs,
            {
              userNeoId,
              userEmail,
              circularCatalog: cCatalog,
              persistedResolutions: pRes,
              driveResolutionsMap: dMap,
            },
            (pageProg) => {
              pageProg.currentPageIndex = targetIndex;
              pageProg.totalPagesCount = totalPagesCount;
              notifyProgress(pageProg);
            }
          );

          accountResult.emailsProcessed += pageRes.emailsProcessed;
          accountResult.newEmails += pageRes.newEmails;
          accountResult.newCompanies += pageRes.newCompanies;
          result.newEmails += pageRes.newEmails;
          result.newCompanies += pageRes.newCompanies;
          result.skippedDuplicates += pageRes.skippedDuplicates;
          result.errors.push(...pageRes.errors);

          // Check if all pages for this account are now complete
          const { data: refreshedPages } = await supabase
            .from('sync_pages')
            .select('status')
            .eq('gmail_account_id', account.id);

          const allDone = refreshedPages && refreshedPages.length > 0 && refreshedPages.every((p) => p.status === 'complete');
          if (allDone) {
            const nextHistId = await getProfileHistoryId(gmail).catch(() => null);
            await supabase
              .from('gmail_accounts')
              .update({
                last_sync_at: new Date().toISOString(),
                last_history_id: nextHistId || account.last_history_id,
              })
              .eq('id', account.id);
          }

          // Update result flags
          result.currentPageIndex = targetIndex;
          result.totalPagesCount = totalPagesCount;
          result.isPage0Complete = targetIndex === 0 && pageRes.completed;
          result.hasMorePagesPending = !allDone;
        }
      } catch (accountErr) {
        const errMsg =
          accountErr instanceof Error ? accountErr.message : String(accountErr);
        console.error(`Sync failed for account ${account.email}:`, errMsg);
        progress.phase = 'error';
        progress.errors.push(errMsg);
        result.errors.push(`Account ${account.email}: ${errMsg}`);
        notifyProgress(progress, true);
      }

      result.totalEmailsFetched += accountResult.emailsFetched;
      result.totalEmailsProcessed += accountResult.emailsProcessed;
      result.accounts.push(accountResult);
    }

  // 5. Circular reconciliation: reconcile unlinked college circulars against user companies
  // IDLE GUARD: Only run reconciliation if emails were actually processed in this sync run!
  // If no new emails arrived and no pending pages were processed, the DB is unchanged.
  if (result.totalEmailsProcessed > 0) {
    try {
      const { data: unlinkedEmails } = await supabase
        .from('emails')
        .select('id, thread_id, subject, sender, received_at')
        .eq('user_id', userId)
        .is('company_id', null);

      if (unlinkedEmails && unlinkedEmails.length > 0) {
        const { data: allUserComps } = await supabase
          .from('companies')
          .select('id, name, aliases')
          .eq('user_id', userId);

        if (allUserComps && allUserComps.length > 0) {
          // A. Build Thread-to-Company map from confident, already-linked emails
          // Directionality guard: Only inherit if a thread has EXACTLY ONE unique company_id
          const { data: threadLinkedEmails } = await supabase
            .from('emails')
            .select('thread_id, company_id')
            .eq('user_id', userId)
            .not('thread_id', 'is', null)
            .not('company_id', 'is', null);

          const threadCompanyMap = new Map<string, Set<string>>();
          for (const te of threadLinkedEmails || []) {
            if (te.thread_id && te.company_id) {
              const set = threadCompanyMap.get(te.thread_id) || new Set<string>();
              set.add(te.company_id);
              threadCompanyMap.set(te.thread_id, set);
            }
          }

          // B. Build NeoPAT registration timeline map for timing correlation (±24h window)
          const { data: neoPatEmails } = await supabase
            .from('emails')
            .select('company_id, received_at')
            .eq('user_id', userId)
            .not('company_id', 'is', null)
            .ilike('sender', '%noreply.cdcinfo@vitstudent.ac.in%');

          const neoPatTimelines = (neoPatEmails || []).map((ne) => {
            const comp = allUserComps.find((c) => c.id === ne.company_id);
            return {
              companyId: ne.company_id as string,
              companyName: comp ? comp.name : '',
              time: new Date(ne.received_at).getTime(),
            };
          }).filter((n) => n.companyName.length > 0);

          const WINDOW_MS = 24 * 60 * 60 * 1000; // ±24h window

          for (const email of unlinkedEmails) {
            let matchedCompanyId: string | null = null;

            // 1. Direct Company Name Extraction Match
            // Note: Omitting body_snippet to save egress; extraction relies on subject & sender
            const compName = extractCompanyName(
              email.subject || '',
              email.sender || '',
              '',
              email.received_at ? new Date(email.received_at) : undefined
            );

            if (compName) {
              const norm = normalizeCompanyName(compName).toLowerCase();
              const matched = allUserComps.find((c) => {
                const cLower = c.name.toLowerCase();
                return (
                  cLower === norm ||
                  (c.aliases || []).includes(norm) ||
                  isFuzzyCompanyMatch(c.name, compName) ||
                  (c.aliases || []).some((a: string) => isFuzzyCompanyMatch(a, compName))
                );
              });
              if (matched) {
                matchedCompanyId = matched.id;
              }
            }

            // 2. Thread Inheritance (Directionality: only if thread has EXACTLY 1 unique company)
            if (!matchedCompanyId && email.thread_id) {
              const candidateSet = threadCompanyMap.get(email.thread_id);
              if (candidateSet && candidateSet.size === 1) {
                matchedCompanyId = Array.from(candidateSet)[0];
              }
            }

            // 3. Same-Day Timing Correlation (Unambiguous only: strictly 1 candidate)
            // Directionality guard: NEVER hijack emails that already have an extracted company name (e.g. Divum, Danfoss)
            // and ONLY match against email subject, NEVER against body_snippet (which contains random branch names & course terms).
            if (!matchedCompanyId && !compName && email.received_at) {
              const emailTime = new Date(email.received_at).getTime();
              const candidates = neoPatTimelines.filter((n) => {
                if (Math.abs(n.time - emailTime) > WINDOW_MS) return false;
                return isFuzzyCompanyMatch(n.companyName, email.subject || '');
              });

              const uniqueCandidates = Array.from(new Set(candidates.map((c) => c.companyId)));
              if (uniqueCandidates.length === 1) {
                matchedCompanyId = uniqueCandidates[0];
              }
              // If > 1 candidates, ambiguous: do not guess!
            }

            if (matchedCompanyId) {
              await supabase
                .from('emails')
                .update({ company_id: matchedCompanyId, is_relevant: true })
                .eq('id', email.id);

              // Register newly linked email to thread map for downstream emails in same pass
              if (email.thread_id) {
                const set = threadCompanyMap.get(email.thread_id) || new Set<string>();
                set.add(matchedCompanyId);
                threadCompanyMap.set(email.thread_id, set);
              }

              // Lazy-fetch body_snippet ONLY for this matched email to extract events/CTC
              const { data: fullEmail } = await supabase
                .from('emails')
                .select('body_snippet')
                .eq('id', email.id)
                .single();
              const emailBodySnippet = fullEmail?.body_snippet || '';

              // Process reconciled circular for Events, CTC, and Roles
              try {
                const { processEmailForEventsAndStatus } = await import(
                  '@/lib/sync/status-engine'
                );
                await processEmailForEventsAndStatus(
                  supabase,
                  userId,
                  matchedCompanyId,
                  {
                    gmailMessageId: email.id,
                    threadId: email.thread_id,
                    sender: email.sender || '',
                    senderEmail: email.sender?.match(/<([^>]+)>/)?.[1] || email.sender || '',
                    subject: email.subject || '',
                    receivedAt: email.received_at ? new Date(email.received_at) : new Date(),
                    bodySnippet: emailBodySnippet,
                    bodyPlain: emailBodySnippet,
                    bodyHtml: '',
                    hasAttachments: false,
                    attachments: [],
                    labels: [],
                  },
                  email.id,
                  userNeoId,
                  userEmail
                );
              } catch (err) {
                console.warn('Failed to process reconciled circular for events:', err);
              }
            }
          }
        }
      }
    } catch (reconcileErr) {
      console.warn('Post-sync circular reconciliation non-critical error:', reconcileErr);
    }

    // 6. Automatic Google Calendar reconciliation:
    // Only runs if new emails or archive pages were processed
    try {
      const { reconcileUserGoogleCalendar } = await import('@/lib/calendar/google-sync');
      const calResult = await reconcileUserGoogleCalendar(userId);
      console.log(`[Google Calendar Auto-Sync] User ${userId}: ${calResult.message}`);
    } catch (calErr) {
      console.warn('[Google Calendar Auto-Sync] Non-critical reconciliation error:', calErr);
    }
  } else {
    console.log(
      `[SyncEngine] User ${userId} sync run idle: 0 emails processed across accounts. Skipped catalog fetch, reconciliation, and calendar sync.`
    );
  }

  return result;
} finally {
  activeSyncLocks.delete(userId);
  activeSyncMap.delete(userId);
  try {
    const isError = result.errors.length > 0 && result.totalEmailsProcessed === 0;
    await supabase.from('sync_state').upsert({
      user_id: userId,
      is_syncing: false,
      phase: isError ? 'error' : 'complete',
      total_messages: latestProgress.totalMessages,
      processed_messages: latestProgress.processedMessages,
      new_emails: result.newEmails,
      new_companies: result.newCompanies,
      skipped_duplicates: result.skippedDuplicates,
      is_initial_sync: isInitialSync,
      current_page_index: latestProgress.currentPageIndex ?? 0,
      total_pages: latestProgress.totalPagesCount ?? 1,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: result.errors.length > 0 ? result.errors[result.errors.length - 1] : null,
    });
  } catch {
    // Ignore if sync_state table not yet created
  }
}
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
  'intelligence', 'intelligent', 'artificial', 'hardware',
  ...ENGLISH_STOPWORDS,
]);

/**
 * Robust fuzzy matcher for company names based on distinctive token overlap.
 * Prevents false matches (e.g. "Kinaxis Super Dream" matching "Superjoin Finance").
 */
export function isFuzzyCompanyMatch(compName: string, targetName: string): boolean {
  let cLower = compName.toLowerCase().trim();
  let tLower = targetName.toLowerCase().trim();

  // Guard: Never merge distinct role tracks or divisions (SDET, SRE, SAP, GDS, Aerospace, Solutions Lab, Technologies) with base company or each other
  const trackTokens = ['sdet', 'sre', 'sap', 'gds', 'aerospace', 'solutions lab', 'technologies'];
  for (const tok of trackTokens) {
    if (
      (cLower.includes(tok) && !tLower.includes(tok)) ||
      (!cLower.includes(tok) && tLower.includes(tok))
    ) {
      return false;
    }
  }

  // Normalize known typos
  cLower = cLower.replace(/\bunthikable\b/g, 'unthinkable');
  tLower = tLower.replace(/\bunthikable\b/g, 'unthinkable');

  if (cLower === tLower) return true;

  // --- Step 1: Normalized-key match ---
  // Strips legal words, removes spaces/punctuation, then compares.
  // This catches: "goldmansachs" == "goldman sachs", "ExxonMobil" == "Exxon Mobil",
  //               "HCL Tech" == "HCL Technologies", "Infosys BPM" == "Infosys"
  const cKey = computeNormalizedKey(compName);
  const tKey = computeNormalizedKey(targetName);
  if (cKey.length >= 3 && tKey.length >= 3 && cKey === tKey) {
    return true;
  }

  // --- Step 1.5: Acronym / Initialism match ---
  // Matches "WTW" ↔ "Willis Towers Watson", "TCS" ↔ "Tata Consultancy Services",
  // parenthetical aliases "(WTW India)", known initialisms, etc.
  if (checkAcronymMatch(cLower, tLower) || checkAcronymMatch(tLower, cLower)) {
    return true;
  }

  // --- Step 2: Distinctive token overlap (handles abbreviations / partial names) ---
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

  const tokenMatches = (a: string, b: string) => {
    if (a === b) return true;
    // Allow minor stem variations (e.g. plural s, es) but strictly limit length difference to <= 2
    if (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a))) {
      return Math.abs(a.length - b.length) <= 2;
    }
    return false;
  };

  // Match if all distinctive tokens of target exist in comp, or vice versa
  const allTargetInComp = tTokens.every((t) => cTokens.some((c) => tokenMatches(c, t)));
  const allCompInTarget = cTokens.every((c) => tTokens.some((t) => tokenMatches(c, t)));

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

  // 3. Dynamic matching against existing user companies.
  // isFuzzyCompanyMatch checks (in order):
  //   a. Track guard: never merge distinct tracks (SDET/SRE/Aerospace/Solutions Lab)
  //   b. Normalized-key match: catches "goldmansachs" == "Goldman Sachs", "ExxonMobil" == "Exxon Mobil"
  //   c. Acronym / Initialism match: catches "WTW" == "Willis Towers Watson", "TCS" == "Tata Consultancy Services"
  //   d. Token overlap: catches "PlaySimple" matching "PlaySimple Games"
  const { data: userCompanies } = await supabase
    .from('companies')
    .select('id, name, aliases')
    .eq('user_id', userId);

  if (userCompanies && userCompanies.length > 0) {
    for (const comp of userCompanies) {
      const aliasMatch = (comp.aliases || []).some((a: string) => isFuzzyCompanyMatch(a, normalized));
      if (isFuzzyCompanyMatch(comp.name, normalized) || aliasMatch) {
        // Automatically persist new alias on the company if not already present
        const existingAliases: string[] = comp.aliases || [];
        const normLower = normalized.toLowerCase();
        if (!existingAliases.includes(normLower)) {
          const updatedAliases = [...existingAliases, normLower];
          await supabase
            .from('companies')
            .update({ aliases: updatedAliases })
            .eq('id', comp.id);
        }
        return comp.id;
      }
    }
  }

  // 4. If no match found and allowCreate is false (e.g. College email), DO NOT create!
  if (!allowCreate) {
    return null;
  }

  // 5. If no match found and allowCreate is true (Personal email), create new company
  const generatedAliases = extractCompanyAliases(companyName, normalized);
  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      user_id: userId,
      name: normalized,
      aliases: generatedAliases,
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
