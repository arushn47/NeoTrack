import { createAdminClient } from '@/lib/supabase/admin';

export interface NotificationPreferences {
  userId: string;
  browserPushEnabled: boolean;
  inAppEnabled: boolean;
  notifyStatusChange: boolean;
  notifyShortlist: boolean;
  notifyTests: boolean;
  notifyInterviews: boolean;
  notifyPpt: boolean;
  notifyNewJds: boolean;
  notifyReminders: boolean;
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'userId'> = {
  browserPushEnabled: true,
  inAppEnabled: true,
  notifyStatusChange: true,
  notifyShortlist: true,
  notifyTests: true,
  notifyInterviews: true,
  notifyPpt: true,
  notifyNewJds: true,
  notifyReminders: true,
};

/**
 * Retrieves the notification preferences for a user, creating defaults if not yet present.
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Return defaults if not found
    return {
      userId,
      ...DEFAULT_PREFERENCES,
    };
  }

  return {
    userId: data.user_id,
    browserPushEnabled: data.browser_push_enabled ?? true,
    inAppEnabled: data.in_app_enabled ?? true,
    notifyStatusChange: data.notify_status_change ?? true,
    notifyShortlist: data.notify_shortlist ?? true,
    notifyTests: data.notify_tests ?? true,
    notifyInterviews: data.notify_interviews ?? true,
    notifyPpt: data.notify_ppt ?? true,
    notifyNewJds: data.notify_new_jds ?? true,
    notifyReminders: data.notify_reminders ?? true,
  };
}

/**
 * Updates the notification preferences for a user.
 */
export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<Omit<NotificationPreferences, 'userId'>>
): Promise<NotificationPreferences> {
  const supabase = createAdminClient();

  const dbPayload: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (updates.browserPushEnabled !== undefined)
    dbPayload.browser_push_enabled = updates.browserPushEnabled;
  if (updates.inAppEnabled !== undefined)
    dbPayload.in_app_enabled = updates.inAppEnabled;
  if (updates.notifyStatusChange !== undefined)
    dbPayload.notify_status_change = updates.notifyStatusChange;
  if (updates.notifyShortlist !== undefined)
    dbPayload.notify_shortlist = updates.notifyShortlist;
  if (updates.notifyTests !== undefined)
    dbPayload.notify_tests = updates.notifyTests;
  if (updates.notifyInterviews !== undefined)
    dbPayload.notify_interviews = updates.notifyInterviews;
  if (updates.notifyPpt !== undefined)
    dbPayload.notify_ppt = updates.notifyPpt;
  if (updates.notifyNewJds !== undefined)
    dbPayload.notify_new_jds = updates.notifyNewJds;
  if (updates.notifyReminders !== undefined)
    dbPayload.notify_reminders = updates.notifyReminders;

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(dbPayload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to update notification preferences');
  }

  return {
    userId: data.user_id,
    browserPushEnabled: data.browser_push_enabled,
    inAppEnabled: data.in_app_enabled,
    notifyStatusChange: data.notify_status_change,
    notifyShortlist: data.notify_shortlist,
    notifyTests: data.notify_tests,
    notifyInterviews: data.notify_interviews,
    notifyPpt: data.notify_ppt,
    notifyNewJds: data.notify_new_jds,
    notifyReminders: data.notify_reminders,
  };
}
