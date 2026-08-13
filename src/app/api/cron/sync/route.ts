import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSync } from '@/lib/sync/engine';

/**
 * GET /api/cron/sync
 * Scheduled background sync endpoint for Vercel Cron or external cron jobs.
 * Runs sync automatically for all active users even when the web app is closed.
 */
export async function GET(req: NextRequest) {
  // Verify secret authorization header if configured
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  } catch (err: any) {
    console.error('[Cron Sync Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
