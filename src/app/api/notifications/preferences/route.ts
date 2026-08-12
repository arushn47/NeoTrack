import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/notifications/preferences';

/**
 * GET /api/notifications/preferences
 * Returns the current user's notification preferences.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const preferences = await getNotificationPreferences(session.userId);
    return NextResponse.json({ preferences });
  } catch (err) {
    console.error('[API Notification Prefs] Fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications/preferences
 * Updates the user's notification preferences.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const updated = await updateNotificationPreferences(session.userId, body);
    return NextResponse.json({ preferences: updated });
  } catch (err) {
    console.error('[API Notification Prefs] Update error:', err);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
