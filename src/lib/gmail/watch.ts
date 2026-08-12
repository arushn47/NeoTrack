import type { gmail_v1 } from 'googleapis';

export interface WatchResponse {
  historyId: string;
  expiration: string;
}

/**
 * Registers a Gmail account for push notifications via Google Cloud Pub/Sub.
 *
 * @param gmail - Authenticated Gmail client
 * @param topicName - Full Pub/Sub topic name, e.g. "projects/my-project/topics/gmail-push"
 */
export async function setupGmailWatch(
  gmail: gmail_v1.Gmail,
  topicName: string
): Promise<WatchResponse | null> {
  try {
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
      },
    });

    if (response.data.historyId && response.data.expiration) {
      return {
        historyId: String(response.data.historyId),
        expiration: String(response.data.expiration),
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to setup Gmail watch:', error);
    return null;
  }
}

/**
 * Stops push notifications for a Gmail account.
 */
export async function stopGmailWatch(gmail: gmail_v1.Gmail): Promise<boolean> {
  try {
    await gmail.users.stop({ userId: 'me' });
    return true;
  } catch (error) {
    console.error('Failed to stop Gmail watch:', error);
    return false;
  }
}
