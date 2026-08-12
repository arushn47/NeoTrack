import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/notifications
 * Fetches recent notifications for the authenticated user.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: 'Unauthorized', code: 'unauthorized' } },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, company_id, is_read, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: { message: error.message, code: 'db_error' } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: notifications || [], error: null });
}

/**
 * PATCH /api/notifications
 * Marks all notifications as read for the user.
 */
export async function PATCH() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: 'Unauthorized', code: 'unauthorized' } },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', session.userId);

  return NextResponse.json({ success: true });
}
