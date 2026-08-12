import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/user/neo-id
 * 
 * Updates the user's Neo ID.
 * Body: { neo_id: string | null }
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: 'Unauthorized', code: 'unauthorized' } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { neo_id } = body;

  // Validate Neo ID format if provided
  if (neo_id !== null && neo_id !== '') {
    if (typeof neo_id !== 'string' || !/^[A-Z0-9]{6,12}$/i.test(neo_id)) {
      return NextResponse.json(
        { error: { message: 'Invalid Neo ID format', code: 'invalid_neo_id' } },
        { status: 400 }
      );
    }
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('users')
    .update({ neo_id: neo_id || null })
    .eq('id', session.userId);

  if (error) {
    return NextResponse.json(
      { error: { message: 'Failed to update Neo ID', code: 'db_error' } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { neo_id: neo_id || null }, error: null });
}
