import { NextRequest, NextResponse, after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSync } from '@/lib/sync/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — handles multi-user sync on Vercel Pro

async function executeBackgroundSync(userIds: string[]) {
  for (const userId of userIds) {
    try {
      await runSync(userId);
      console.log(`[Cron Sync] Successfully synced user ${userId}`);
    } catch (err: any) {
      console.error(`[Cron Sync] Failed for user ${userId}:`, err);
    }
  }
}

/**
 * GET /api/cron/sync
 * Scheduled background sync endpoint for Vercel Cron or external cron services (e.g. cron-job.org).
 * Runs sync automatically for all active users even when the web app is closed.
 */
export async function GET(req: NextRequest) {
  // Verify secret authorization header or query parameter if configured
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get('authorization');
    const xSecret = req.headers.get('x-cron-secret');
    const querySecret = req.nextUrl.searchParams.get('secret') || req.nextUrl.searchParams.get('key');

    const isAuthorized =
      authHeader === `Bearer ${secret}` ||
      authHeader === secret ||
      xSecret === secret ||
      querySecret === secret;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = createAdminClient();

    // Get all users who have connected Gmail accounts
    const { data: accounts, error } = await supabase
      .from('gmail_accounts')
      .select('user_id')
      .eq('is_connected', true);

    if (error || !accounts || accounts.length === 0) {
      return NextResponse.json({ message: 'No connected accounts to sync' }, { status: 200 });
    }

    // Deduplicate user_ids
    const userIds = Array.from(new Set(accounts.map((a) => a.user_id)));

    // Check if caller explicitly requested synchronous waiting (?wait=true)
    const shouldWait = req.nextUrl.searchParams.get('wait') === 'true';

    if (shouldWait) {
      const syncResults = [];
      for (const userId of userIds) {
        try {
          const result = await runSync(userId);
          syncResults.push({ userId, status: 'success', result });
        } catch (err: any) {
          console.error(`[Cron Sync] Failed for user ${userId}:`, err);
          syncResults.push({ userId, status: 'error', error: err.message });
        }
      }
      return NextResponse.json({
        success: true,
        usersProcessed: userIds.length,
        details: syncResults,
      });
    }

    // Non-blocking execution for external cron services (cron-job.org):
    // Dispatches background work via Next.js after() and immediately responds 200 OK in ~50ms
    // to prevent external cron HTTP 30-second timeouts.
    after(executeBackgroundSync(userIds));

    return NextResponse.json({
      success: true,
      message: `Background sync triggered for ${userIds.length} user(s)`,
      usersCount: userIds.length,
    });
  } catch (err: any) {
    console.error('[Cron Sync Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
