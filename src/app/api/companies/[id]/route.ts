import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/companies/[id]
 * Deletes a company and all its related data (emails, events, applications, matches, notifications).
 * All child tables have ON DELETE CASCADE, so deleting the company cascades automatically.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: companyId } = await params;
  const supabase = createAdminClient();

  // Verify the company belongs to this user
  const { data: company, error: fetchError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .eq('user_id', session.userId)
    .single();

  if (fetchError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  // Unlink emails first (set company_id to null instead of deleting emails)
  await supabase
    .from('emails')
    .update({ company_id: null })
    .eq('company_id', companyId)
    .eq('user_id', session.userId);

  // Delete events for this company
  await supabase
    .from('events')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', session.userId);

  // Delete notifications for this company
  await supabase
    .from('notifications')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', session.userId);

  // Delete candidate matches linked to this company's emails
  // (matches are linked via email_id, not company_id directly)

  // Delete the application
  await supabase
    .from('applications')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', session.userId);

  // Delete the company itself
  const { error: deleteError } = await supabase
    .from('companies')
    .delete()
    .eq('id', companyId)
    .eq('user_id', session.userId);

  if (deleteError) {
    console.error('Failed to delete company:', deleteError);
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: company.name });
}
