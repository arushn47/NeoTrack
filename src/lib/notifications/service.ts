import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToUser, type PushNotificationPayload } from './push';
import { getNotificationPreferences } from './preferences';

export type NotificationType =
  | 'status_change'
  | 'shortlist_match'
  | 'test_scheduled'
  | 'interview_scheduled'
  | 'ppt_scheduled'
  | 'deadline_approaching'
  | 'new_company'
  | 'sync_complete'
  | 'general';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  companyId?: string | null;
  applicationId?: string | null;
  eventId?: string | null;
  link?: string | null;
  /**
   * Deterministic idempotency key to prevent duplicate notifications.
   * Format: `${userId}:${companyId || 'global'}:${type}:${sourceKey}`
   */
  dedupeKey: string;
  pushPayload?: Partial<PushNotificationPayload>;
}

/**
 * Dispatches a notification to both In-App Notification Center and Web Push.
 * Adheres strictly to user preferences and idempotency.
 */
export async function sendNotification(
  params: CreateNotificationParams
): Promise<{ inAppCreated: boolean; pushSent: boolean }> {
  const {
    userId,
    type,
    title,
    body,
    companyId,
    applicationId,
    eventId,
    link,
    dedupeKey,
    pushPayload,
  } = params;

  const supabase = createAdminClient();

  // 1. Check user preferences
  const prefs = await getNotificationPreferences(userId);

  // Check category preference
  let isCategoryEnabled = true;
  switch (type) {
    case 'status_change':
      isCategoryEnabled = prefs.notifyStatusChange;
      break;
    case 'shortlist_match':
      isCategoryEnabled = prefs.notifyShortlist;
      break;
    case 'test_scheduled':
      isCategoryEnabled = prefs.notifyTests;
      break;
    case 'interview_scheduled':
      isCategoryEnabled = prefs.notifyInterviews;
      break;
    case 'ppt_scheduled':
      isCategoryEnabled = prefs.notifyPpt;
      break;
    case 'new_company':
      isCategoryEnabled = prefs.notifyNewJds;
      break;
    case 'deadline_approaching':
      isCategoryEnabled = prefs.notifyReminders;
      break;
    default:
      isCategoryEnabled = true;
  }

  if (!isCategoryEnabled) {
    return { inAppCreated: false, pushSent: false };
  }

  let inAppCreated = false;

  // 2. Insert into in-app notifications if in-app notifications are enabled
  if (prefs.inAppEnabled) {
    const { data: inserted, error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        company_id: companyId || null,
        application_id: applicationId || null,
        event_id: eventId || null,
        type,
        title,
        message: body,
        body,
        link: link || (companyId ? `/companies/${companyId}` : '/'),
        dedupe_key: dedupeKey,
        is_read: false,
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        // Unique constraint violation on dedupe_key -> Notification was already generated before!
        return { inAppCreated: false, pushSent: false };
      }
      console.error('[Notification Service] In-app insert error:', insertError);
    } else if (inserted) {
      inAppCreated = true;
    }
  }

  // 3. Dispatch Web Push notification if browser push is enabled
  let pushSent = false;
  if (prefs.browserPushEnabled) {
    const targetLink = link || (companyId ? `/companies/${companyId}` : '/');
    const { sent } = await sendPushToUser(userId, {
      title,
      body,
      tag: dedupeKey,
      data: {
        url: targetLink,
        companyId: companyId || undefined,
        eventId: eventId || undefined,
        type,
        ...pushPayload?.data,
      },
      ...pushPayload,
    });
    pushSent = sent > 0;
  }

  return { inAppCreated, pushSent };
}

// ============================================
// Specialized Notification Triggers
// ============================================

/**
 * Notifies user of an application status change (Applied -> Shortlisted, Withdrawn, etc.)
 */
export async function notifyStatusChange(params: {
  userId: string;
  companyId: string;
  companyName: string;
  oldStatus: string | null;
  newStatus: string;
  sourceEmailId?: string;
}) {
  const { userId, companyId, companyName, oldStatus, newStatus, sourceEmailId } = params;

  if (oldStatus === newStatus) return; // Do not notify if status did not change

  const dedupeKey = `status:${userId}:${companyId}:${newStatus}:${sourceEmailId || 'sync'}`;

  let title = `NeoTrack — ${companyName} Status Update`;
  let body = `Your application status for ${companyName} has changed to ${newStatus.toUpperCase().replace(/_/g, ' ')}.`;

  if (newStatus === 'shortlisted') {
    title = `🎉 NeoTrack — ${companyName} Shortlisted!`;
    body = `You have been shortlisted for ${companyName}. Check your schedule for upcoming test rounds.`;
  } else if (newStatus === 'selected') {
    title = `🏆 NeoTrack — ${companyName} Offer / Selected!`;
    body = `Congratulations! You have received a selection/offer update for ${companyName}!`;
  } else if (newStatus === 'withdrawn') {
    title = `NeoTrack — ${companyName} Application Withdrawn`;
    body = `Your ${companyName} application has been marked as withdrawn/opted-out.`;
  } else if (newStatus === 'not_shortlisted') {
    title = `NeoTrack — ${companyName} Selection List Released`;
    body = `Selection list released for ${companyName}. Status marked as Not Shortlisted.`;
  }

  return sendNotification({
    userId,
    type: 'status_change',
    title,
    body,
    companyId,
    link: `/companies/${companyId}`,
    dedupeKey,
  });
}

/**
 * Notifies user when their Neo ID is found in an Excel shortlist.
 */
export async function notifyShortlistMatch(params: {
  userId: string;
  companyId: string;
  companyName: string;
  neoId: string;
  emailSubject: string;
  sourceEmailId?: string;
}) {
  const { userId, companyId, companyName, neoId, emailSubject, sourceEmailId } = params;
  const dedupeKey = `shortlist:${userId}:${companyId}:${neoId}:${sourceEmailId || 'match'}`;

  return sendNotification({
    userId,
    type: 'shortlist_match',
    title: `🎉 ${companyName} Shortlist Match!`,
    body: `Your Neo ID (${neoId}) was found in the official ${companyName} shortlist!`,
    companyId,
    link: `/companies/${companyId}`,
    dedupeKey,
  });
}

/**
 * Notifies user when a new test, PPT, or interview event is scheduled.
 */
export async function notifyEventScheduled(params: {
  userId: string;
  companyId: string;
  companyName: string;
  eventType: string;
  startTime: Date | null;
  venue?: string | null;
  eventId?: string;
}) {
  const { userId, companyId, companyName, eventType, startTime, venue, eventId } = params;

  const dateStr = startTime
    ? startTime.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : 'Date TBD';

  const dateKey = startTime ? startTime.toISOString().slice(0, 10) : 'unknown';
  const dedupeKey = `event:${userId}:${companyId}:${eventType}:${dateKey}`;

  let title = `📅 ${companyName} — Event Scheduled`;
  let body = `${eventType.replace(/_/g, ' ').toUpperCase()} on ${dateStr}${venue ? ` at ${venue}` : ''}.`;
  let notifType: NotificationType = 'test_scheduled';

  if (['online_test', 'coding_test'].includes(eventType)) {
    title = `📝 ${companyName} — Online Test Scheduled`;
    body = `Online assessment scheduled for ${dateStr}${venue ? ` at ${venue}` : ''}.`;
    notifType = 'test_scheduled';
  } else if (['technical_interview', 'hr_interview', 'final_interview'].includes(eventType)) {
    title = `💼 ${companyName} — Interview Scheduled`;
    body = `Interview round scheduled for ${dateStr}${venue ? ` at ${venue}` : ''}.`;
    notifType = 'interview_scheduled';
  } else if (eventType === 'ppt') {
    title = `📢 ${companyName} — PPT Scheduled`;
    body = `Pre-Placement Talk scheduled for ${dateStr}${venue ? ` at ${venue}` : ''}.`;
    notifType = 'ppt_scheduled';
  }

  return sendNotification({
    userId,
    type: notifType,
    title,
    body,
    companyId,
    eventId,
    link: `/calendar`,
    dedupeKey,
  });
}
