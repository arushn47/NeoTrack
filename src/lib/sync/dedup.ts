import { createAdminClient } from '@/lib/supabase/admin';
import { computeNormalizedKey } from '@/lib/sync/classifier';
import { isFuzzyCompanyMatch } from '@/lib/sync/engine';
import { extractAllDriveNumbers } from '@/lib/sync/events';

export interface DedupResult {
  mergedGroupsCount: number;
  removedCompaniesCount: number;
  details: Array<{ canonical: string; removed: string[] }>;
}

/**
 * Robust post-sync deduplication engine.
 * Scans all companies of a user and merges duplicates caused by naming variations,
 * concurrent sync batches, or circulars vs official NeoPAT notifications.
 */
export async function deduplicateUserCompanies(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<DedupResult> {
  const result: DedupResult = {
    mergedGroupsCount: 0,
    removedCompaniesCount: 0,
    details: [],
  };

  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, aliases, drive_number, drive_name')
    .eq('user_id', userId);

  if (error || !companies || companies.length <= 1) {
    return result;
  }

  // Pre-fetch drive numbers bound to each company via emails to prevent merging companies with conflicting drives
  const boundDrivesMap = new Map<string, string[]>();
  for (const c of companies) {
    if (c.drive_number) {
      boundDrivesMap.set(c.id, [c.drive_number.toLowerCase()]);
    }
  }

  const { data: driveEmails } = await supabase
    .from('emails')
    .select('company_id, body_snippet, body_plain')
    .eq('user_id', userId)
    .not('company_id', 'is', null);

  for (const e of driveEmails || []) {
    const emailText = [e.body_snippet, e.body_plain].filter(Boolean).join('\n');
    if (e.company_id && emailText) {
      const drives = extractAllDriveNumbers(emailText).map((d) => d.toLowerCase());
      const existing = boundDrivesMap.get(e.company_id) || [];
      boundDrivesMap.set(e.company_id, Array.from(new Set([...existing, ...drives])));
    }
  }

  const areDrivesConflicting = (id1: string, id2: string): boolean => {
    const d1 = boundDrivesMap.get(id1) || [];
    const d2 = boundDrivesMap.get(id2) || [];
    if (d1.length > 0 || d2.length > 0) {
      return !d1.some((d) => d2.includes(d));
    }
    return false;
  };

  // Group duplicate companies
  const groups: Array<typeof companies> = [];
  const visited = new Set<string>();

  for (let i = 0; i < companies.length; i++) {
    const c1 = companies[i];
    if (visited.has(c1.id)) continue;

    const group = [c1];
    visited.add(c1.id);

    const k1 = computeNormalizedKey(c1.name);

    for (let j = i + 1; j < companies.length; j++) {
      const c2 = companies[j];
      if (visited.has(c2.id)) continue;

      if (areDrivesConflicting(c1.id, c2.id)) {
        continue;
      }

      let isMatch = false;

      // Rule 1: Same non-null drive number
      if (
        c1.drive_number &&
        c2.drive_number &&
        c1.drive_number.toLowerCase() === c2.drive_number.toLowerCase()
      ) {
        isMatch = true;
      }

      // Rule 2: Same normalized key (if length >= 3)
      if (!isMatch && k1.length >= 3) {
        const k2 = computeNormalizedKey(c2.name);
        if (k1 === k2) {
          isMatch = true;
        }
      }

      // Rule 3: Fuzzy matching
      if (!isMatch && isFuzzyCompanyMatch(c1.name, c2.name)) {
        isMatch = true;
      }

      // Rule 4: Cross-alias check
      if (!isMatch) {
        const a1 = (c1.aliases || []).map((a: string) => a.toLowerCase());
        const a2 = (c2.aliases || []).map((a: string) => a.toLowerCase());
        if (a1.includes(c2.name.toLowerCase()) || a2.includes(c1.name.toLowerCase())) {
          isMatch = true;
        }
      }

      // Rule 5: Parenthetical brand matching (e.g. "Eternal (Zomato)" vs "Zomato")
      if (!isMatch) {
        const extractParts = (name: string) => {
          const parens = Array.from(name.matchAll(/\(([^)]+)\)/g)).map((m) => m[1].trim().toLowerCase());
          const outside = name.replace(/\([^)]*\)/g, ' ').trim().toLowerCase();
          return [...parens, ...(outside ? [outside] : [])];
        };
        const p1 = extractParts(c1.name);
        const p2 = extractParts(c2.name);
        if (p1.some((part) => p2.includes(part) || p2.some((other) => isFuzzyCompanyMatch(part, other)))) {
          isMatch = true;
        }
      }

      if (isMatch) {
        group.push(c2);
        visited.add(c2.id);
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  for (const group of groups) {
    // Count emails for each company to pick the best canonical record
    const withCounts = await Promise.all(
      group.map(async (c) => {
        const { count } = await supabase
          .from('emails')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', c.id);
        return { ...c, emailCount: count ?? 0 };
      })
    );

    // Prefer company that has drive_number, then by highest email count
    withCounts.sort((a, b) => {
      if (a.drive_number && !b.drive_number) return -1;
      if (!a.drive_number && b.drive_number) return 1;
      return b.emailCount - a.emailCount;
    });

    const canonical = withCounts[0];
    const duplicates = withCounts.slice(1);

    // Merge aliases and drive information
    const allAliases = new Set(canonical.aliases || []);
    allAliases.add(canonical.name.toLowerCase());
    for (const d of duplicates) {
      allAliases.add(d.name.toLowerCase());
      (d.aliases || []).forEach((a: string) => allAliases.add(a.toLowerCase()));
    }

    const updateFields: Record<string, any> = {
      aliases: Array.from(allAliases),
    };
    if (!canonical.drive_number) {
      const withDrive = duplicates.find((d) => d.drive_number);
      if (withDrive) {
        updateFields.drive_number = withDrive.drive_number;
        updateFields.drive_name = withDrive.drive_name || canonical.drive_name;
      }
    }
    await supabase.from('companies').update(updateFields).eq('id', canonical.id);

    // Reassign emails & events, reconcile applications
    for (const dup of duplicates) {
      await supabase.from('emails').update({ company_id: canonical.id }).eq('company_id', dup.id);
      await supabase.from('events').update({ company_id: canonical.id, gcal_event_id: null }).eq('company_id', dup.id);
      await supabase.from('notifications').delete().eq('company_id', dup.id);

      const { data: dupApp } = await supabase
        .from('applications')
        .select('*')
        .eq('company_id', dup.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (dupApp) {
        const { data: canonApp } = await supabase
          .from('applications')
          .select('*')
          .eq('company_id', canonical.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (!canonApp) {
          await supabase.from('applications').update({ company_id: canonical.id }).eq('id', dupApp.id);
        } else {
          // If canonApp is only 'not_applied' / 'unknown', but dupApp had an advanced status (e.g. withdrawn, applied, etc.), preserve that status
          if (
            ['not_applied', 'unknown'].includes(canonApp.status) &&
            !['not_applied', 'unknown'].includes(dupApp.status)
          ) {
            await supabase
              .from('applications')
              .update({
                status: dupApp.status,
                status_source: dupApp.status_source,
                status_confidence: dupApp.status_confidence,
                status_source_email_at: dupApp.status_source_email_at,
                last_updated: new Date().toISOString(),
              })
              .eq('id', canonApp.id);
          }
          await supabase.from('applications').delete().eq('id', dupApp.id);
        }
      }

      await supabase.from('companies').delete().eq('id', dup.id);
      result.removedCompaniesCount++;
    }

    result.mergedGroupsCount++;
    result.details.push({
      canonical: canonical.name,
      removed: duplicates.map((d) => d.name),
    });
  }

  return result;
}
