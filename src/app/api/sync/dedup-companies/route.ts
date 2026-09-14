import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { deduplicateUserCompanies } from '@/lib/sync/dedup';
import { recalculateApplicationStatuses } from '@/app/api/sync/reprocess/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/sync/dedup-companies
 * Finds duplicate companies by drive_number, normalized key, cross-aliases, or fuzzy match,
 * merges emails/events into the canonical record, cleans up duplicate applications/companies,
 * and recalculates application statuses.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const userId = session.userId;

  const dedupResult = await deduplicateUserCompanies(supabase, userId);

  // Recalculate status if any companies were merged
  if (dedupResult.removedCompaniesCount > 0) {
    try {
      await recalculateApplicationStatuses(userId);
    } catch (recalcErr) {
      console.warn('[dedup-companies] Post-dedup status recalc warning:', recalcErr);
    }
  }

  return NextResponse.json({
    success: true,
    mergedGroups: dedupResult.details,
    totalMerged: dedupResult.removedCompaniesCount,
  });
}
