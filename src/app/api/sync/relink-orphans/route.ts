import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractCompanyName } from '@/lib/sync/classifier';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/sync/relink-orphans
 * Re-evaluates email-to-company assignments across all stored emails
 * to fix orphaned emails and emails misassigned by loose alias matching.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const userId = session.userId;

  // 1. Fetch all companies for this user
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, aliases')
    .eq('user_id', userId);

  if (!companies || companies.length === 0) {
    return NextResponse.json({ message: 'No companies found', linked: 0 });
  }

  // 2. Fetch all emails for this user
  const { data: allEmails, error } = await supabase
    .from('emails')
    .select('id, subject, sender, company_id')
    .eq('user_id', userId);

  if (error || !allEmails || allEmails.length === 0) {
    return NextResponse.json({ message: 'No emails found', linked: 0 });
  }

  let linked = 0;
  const details: { subject: string; company: string }[] = [];

  for (const email of allEmails) {
    const extractedName = extractCompanyName(email.subject || '', email.sender || '');
    if (!extractedName) continue;

    // Find the matching company using exact or word-boundary alias matching
    let matchedCompanyId: string | null = null;
    let matchedCompanyName = '';

    const extLower = extractedName.toLowerCase().trim();

    for (const company of companies) {
      const compNameLower = company.name.toLowerCase().trim();

      // Exact match
      if (compNameLower === extLower) {
        matchedCompanyId = company.id;
        matchedCompanyName = company.name;
        break;
      }

      // Dynamic substring match for multi-word company names (length >= 4)
      if (
        compNameLower.length >= 4 &&
        extLower.length >= 4 &&
        (compNameLower.includes(extLower) || extLower.includes(compNameLower))
      ) {
        matchedCompanyId = company.id;
        matchedCompanyName = company.name;
        break;
      }

      // Check aliases with word boundary
      const aliases: string[] = company.aliases || [];
      for (const alias of aliases) {
        const aliasLower = alias.toLowerCase().trim();
        if (aliasLower.length >= 2) {
          const escaped = aliasLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i');
          if (regex.test(extLower)) {
            matchedCompanyId = company.id;
            matchedCompanyName = company.name;
            break;
          }
        }
      }
      if (matchedCompanyId) break;
    }

    if (matchedCompanyId && matchedCompanyId !== email.company_id) {
      await supabase
        .from('emails')
        .update({ company_id: matchedCompanyId })
        .eq('id', email.id);

      linked++;
      details.push({ subject: email.subject || '', company: matchedCompanyName });
    }
  }

  return NextResponse.json({
    success: true,
    totalEmails: allEmails.length,
    relinked: linked,
    details: details.slice(0, 20),
  });
}

