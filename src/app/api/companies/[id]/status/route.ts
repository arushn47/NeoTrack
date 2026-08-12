import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/companies/[id]/status
 *
 * Allows manual override of application status for a company.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: 'Unauthorized', code: 'unauthorized' } },
      { status: 401 }
    );
  }

  const { id: companyId } = await params;
  const body = await request.json();
  const { status, role, ctc, location, notes } = body;

  if (!status) {
    return NextResponse.json(
      { error: { message: 'Status is required', code: 'bad_request' } },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Upsert application record with manual override flag
  const { data: application, error } = await supabase
    .from('applications')
    .upsert(
      {
        user_id: session.userId,
        company_id: companyId,
        status,
        status_source: 'manual_override',
        status_confidence: 'manual',
        manual_override: true,
        role: role || undefined,
        ctc: ctc || undefined,
        location: location || undefined,
        notes: notes || undefined,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'user_id,company_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Failed to update status:', error);
    return NextResponse.json(
      { error: { message: error.message, code: 'db_error' } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: application, error: null });
}
