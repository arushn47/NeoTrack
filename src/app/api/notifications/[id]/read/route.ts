import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/notifications/[id]/read
 * Marks a specific notification as read.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', session.userId);

  if (error) {
    console.error('[API Notifications] Mark read error:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
