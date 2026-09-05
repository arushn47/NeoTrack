import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/tokens';

export interface SyncCalendarEventParams {
  userId: string;
  title: string;
  startTime: string; // ISO string
  endTime?: string | null;
  venue?: string | null;
  description?: string | null;
  mode?: string | null;
  /** If provided, the existing GCal event will be updated in-place instead of searching/inserting. */
  gcalEventId?: string | null;
}

/**
 * Creates an authorized OAuth2 client for Google Calendar API
 */
async function getCalendarOAuthClient(userId: string) {
  const supabase = createAdminClient();

  const { data: accounts } = await supabase
    .from('gmail_accounts')
    .select('*')
    .eq('user_id', userId)
    .not('refresh_token_encrypted', 'is', null);

  if (!accounts || accounts.length === 0) return null;

  const account = accounts.find((a) => a.account_type === 'personal') || accounts[0];
  if (!account.refresh_token_encrypted) return null;

  const refreshToken = decrypt(account.refresh_token_encrypted);
  const accessToken = account.access_token_encrypted ? decrypt(account.access_token_encrypted) : undefined;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
  });

  return oauth2Client;
}

/**
 * Pushes an event to the user's primary Google Calendar.
 * - If `gcalEventId` is provided, updates that specific event (no duplicates).
 * - Otherwise falls back to a time-window fuzzy search, then inserts if no match found.
 * Returns the canonical GCal event ID so callers can persist it.
 */
export async function pushEventToGoogleCalendar(params: SyncCalendarEventParams): Promise<string | null> {
  try {
    const auth = await getCalendarOAuthClient(params.userId);
    if (!auth) return null;

    const calendar = google.calendar({ version: 'v3', auth });

    const startDate = new Date(params.startTime);
    if (isNaN(startDate.getTime())) return null;

    const endDate = params.endTime && !isNaN(new Date(params.endTime).getTime())
      ? new Date(params.endTime)
      : new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour default

    const eventPayload = {
      summary: params.title,
      location: params.venue || 'Campus / Online',
      description:
        params.description ||
        `Placement Assessment / Event tracked by NeoTrack.\nMode: ${params.mode || 'Offline'}\nVenue: ${params.venue || 'Campus / Online'}`,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 120 },
          { method: 'email', minutes: 1440 }, // 24 hours before
        ],
      },
    };

    // --- Path 1: We have a stored GCal event ID — update directly, no search needed ---
    if (params.gcalEventId) {
      try {
        const updateRes = await calendar.events.update({
          calendarId: 'primary',
          eventId: params.gcalEventId,
          requestBody: eventPayload,
        });
        return updateRes.data.id || null;
      } catch (updateErr: unknown) {
        // If the event was manually deleted from GCal (404), fall through to insert
        const status = (updateErr as { code?: number })?.code;
        if (status !== 404 && status !== 410) {
          console.error('Google Calendar update error:', updateErr);
          return null;
        }
        // Event no longer exists — fall through to insert a fresh one
      }
    }

    // --- Path 2: No stored ID — fuzzy search within ±4h window to avoid duplicates ---
    const timeMin = new Date(startDate.getTime() - 4 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(startDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const companyPrefix = params.title.split(' - ')[0].trim();

    try {
      const searchRes = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        q: companyPrefix,
      });

      const existingMatch = searchRes.data.items?.find((item) =>
        item.summary?.toLowerCase().includes(companyPrefix.toLowerCase())
      );

      if (existingMatch?.id) {
        const updateRes = await calendar.events.update({
          calendarId: 'primary',
          eventId: existingMatch.id,
          requestBody: eventPayload,
        });
        return updateRes.data.id || null;
      }
    } catch {
      // List failed or search error — proceed to insert directly
    }

    // --- Path 3: No existing event found — insert fresh ---
    const insertRes = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventPayload,
    });

    return insertRes.data.id || null;
  } catch (err) {
    console.error('Google Calendar Auto-Sync Error (user may need to reconnect for calendar scope):', err);
    return null;
  }
}

/**
 * Removes an event from Google Calendar.
 * - If `eventId` is provided, deletes that specific event directly (preferred).
 * - Falls back to name-based search only when no ID is available.
 */
export async function deleteEventFromGoogleCalendar(params: {
  userId: string;
  companyName: string;
  /** Preferred: direct GCal event ID. If provided, skips name-based search entirely. */
  eventId?: string | null;
}): Promise<boolean> {
  try {
    const auth = await getCalendarOAuthClient(params.userId);
    if (!auth) return false;

    const calendar = google.calendar({ version: 'v3', auth });

    // --- Fast path: delete by stored event ID ---
    if (params.eventId) {
      try {
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: params.eventId,
        });
        return true;
      } catch (err: unknown) {
        const status = (err as { code?: number })?.code;
        // 404/410 means it was already deleted from GCal — still consider it a success
        if (status === 404 || status === 410) return true;
        console.error('Google Calendar Delete (by ID) Error:', err);
        return false;
      }
    }

    // --- Fallback: name-based search (legacy path, used when gcal_event_id is missing) ---
    const searchRes = await calendar.events.list({
      calendarId: 'primary',
      q: params.companyName,
    });

    if (searchRes.data.items && searchRes.data.items.length > 0) {
      for (const item of searchRes.data.items) {
        if (item.id) {
          await calendar.events.delete({
            calendarId: 'primary',
            eventId: item.id,
          });
        }
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error('Google Calendar Delete Error:', err);
    return false;
  }
}
