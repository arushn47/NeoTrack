import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/notifications
 * Returns recent in-app notifications and unread count for the authenticated user.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch recent notifications
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, body, link, company_id, is_read, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[API Notifications] Fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }

  // Count unread
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .eq('is_read', false);

  return NextResponse.json({
    notifications: notifications || [],
    unreadCount: unreadCount || 0,
  });
}

/**
 * POST /api/notifications
 * Marks all notifications as read for the authenticated user.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', session.userId)
    .eq('is_read', false);

  if (error) {
    console.error('[API Notifications] Mark all read error:', error);
    return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
