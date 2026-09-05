import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeNormalizedKey } from '@/lib/sync/classifier';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/sync/dedup-companies
 * Finds companies with the same normalised key (e.g. "Goldmansachs" and "Goldman Sachs")
 * and merges the smaller one into the canonical (most-emails) record.
 * Also clears gcal_event_id on moved events so the next GCal sync re-creates them cleanly.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const userId = session.userId;

  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', userId);

  if (error || !companies || companies.length === 0) {
    return NextResponse.json({ message: 'No companies found', merged: 0 });
  }

  const groups = new Map<string, { id: string; name: string }[]>();
  for (const comp of companies) {
    const key = computeNormalizedKey(comp.name);
    if (!key || key.length < 2) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(comp);
  }

  const mergedGroups: { canonical: string; removed: string[] }[] = [];

  for (const [, group] of groups) {
    if (group.length <= 1) continue;

    const withCounts = await Promise.all(
      group.map(async (c) => {
        const { count } = await supabase
          .from('emails')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', c.id);
        return { ...c, emailCount: count ?? 0 };
      })
    );
    withCounts.sort((a, b) => b.emailCount - a.emailCount);

    const canonical = withCounts[0];
    const duplicates = withCounts.slice(1);

    for (const dup of duplicates) {
      await supabase.from('emails').update({ company_id: canonical.id }).eq('company_id', dup.id);
      await supabase.from('events').update({ company_id: canonical.id, gcal_event_id: null }).eq('company_id', dup.id);

      const { data: dupApp } = await supabase
        .from('applications').select('*').eq('company_id', dup.id).eq('user_id', userId).maybeSingle();

      if (dupApp) {
        const { data: canonApp } = await supabase
          .from('applications').select('id').eq('company_id', canonical.id).eq('user_id', userId).maybeSingle();
        if (!canonApp) {
          await supabase.from('applications').update({ company_id: canonical.id }).eq('id', dupApp.id);
        } else {
          await supabase.from('applications').delete().eq('id', dupApp.id);
        }
      }

      await supabase.from('companies').delete().eq('id', dup.id);
    }

    mergedGroups.push({ canonical: canonical.name, removed: duplicates.map((d) => d.name) });
  }

  return NextResponse.json({
    success: true,
    mergedGroups,
    totalMerged: mergedGroups.reduce((s, g) => s + g.removed.length, 0),
  });
}
