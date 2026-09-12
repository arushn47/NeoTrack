import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveSyncProgress, isUserSyncActive } from '@/lib/sync/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Check in-memory sync progress first (real-time in current server process)
  const memoryProgress = getActiveSyncProgress(session.userId);
  const memoryIsActive = isUserSyncActive(session.userId);

  // 2. Check sync_state table from Supabase (cross-server persistence)
  let dbSyncState: any = null;
  try {
    const { data } = await supabase
      .from('sync_state')
      .select('*')
      .eq('user_id', session.userId)
      .single();
    dbSyncState = data;
  } catch {
    // If sync_state table not yet created in Supabase, fallback gracefully
  }

  // 3. Fetch latest sync timestamp across accounts
  const { data: accounts } = await supabase
    .from('gmail_accounts')
    .select('last_sync_at')
    .eq('user_id', session.userId);

  const lastSyncAt =
    accounts
      ?.map((a) => a.last_sync_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;

  if (memoryIsActive && memoryProgress) {
    return NextResponse.json({
      isSyncing: true,
      phase: memoryProgress.phase,
      progress: memoryProgress,
      lastSyncAt,
    });
  }

  if (dbSyncState?.is_syncing) {
    const updatedAt = new Date(dbSyncState.updated_at || 0).getTime();
    const isStale = Date.now() - updatedAt > 15 * 60 * 1000;
    if (!isStale) {
      return NextResponse.json({
        isSyncing: true,
        phase: dbSyncState.phase,
        progress: {
          phase: dbSyncState.phase,
          accountEmail: dbSyncState.account_email || '',
          accountType: dbSyncState.account_type || '',
          totalMessages: dbSyncState.total_messages || 0,
          processedMessages: dbSyncState.processed_messages || 0,
          newEmails: dbSyncState.new_emails || 0,
          newCompanies: dbSyncState.new_companies || 0,
          skippedDuplicates: dbSyncState.skipped_duplicates || 0,
          errors: dbSyncState.last_error ? [dbSyncState.last_error] : [],
          currentSubject: dbSyncState.current_subject,
          isInitialSync: dbSyncState.is_initial_sync,
        },
        lastSyncAt,
      });
    }
  }

  return NextResponse.json({
    isSyncing: false,
    phase: dbSyncState?.phase || 'idle',
    progress: null,
    lastSyncAt,
  });
}
