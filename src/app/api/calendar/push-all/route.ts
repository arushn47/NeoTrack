import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/tokens';

const EVENT_STAGE: Record<string, number> = {
  ppt: 1,
  online_test: 2,
  coding_test: 2,
  aptitude_test: 2,
  group_discussion: 2,
  technical_interview: 3,
  hr_interview: 3,
  interview: 3,
  final_interview: 4,
  offer: 5,
};

const STATUS_MAX_STAGE: Record<string, number> = {
  applied: 2,
  ppt_scheduled: 2,
  shortlisted: 2,
  test_scheduled: 2,
  interview_scheduled: 3,
  selected: 5,
  offer_received: 5,
  rejected: 0,
  not_shortlisted: 0,
  not_applied: 0,
  declined: 0,
  withdrawn: 0,
};

/**
 * POST /api/calendar/push-all
 * Full two-way reconciliation sync with Google Calendar:
 * 1. Pushes only legitimate active events (filters out registration deadlines, eliminated/withdrawn drives).
 * 2. Updates existing matched events in-place (no duplicates).
 * 3. Permanently deletes stale, duplicate, withdrawn, or dead NeoTrack events from Google Calendar.
 * 4. Inserts missing active events and links their gcal_event_id.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const userId = session.userId;

  // 1. Fetch user's eligible site events and pipeline status
  const [
    { data: events },
    { data: companies },
    { data: applications },
  ] = await Promise.all([
    supabase
      .from('events')
      .select('id, company_id, event_type, title, start_time, end_time, venue, mode, manual_override, gcal_event_id')
      .eq('user_id', userId)
      .order('start_time', { ascending: true }),

    supabase
      .from('companies')
      .select('id, name')
      .eq('user_id', userId),

    supabase
      .from('applications')
      .select('company_id, status')
      .eq('user_id', userId),
  ]);

  const companyMap = new Map((companies || []).map((c) => [c.id, c.name]));
  const appStatusMap = new Map((applications || []).map((a) => [a.company_id, a.status]));

  const seenKeys = new Set<string>();
  const eligibleEvents: Array<{
    id: string;
    companyId: string;
    companyName: string;
    eventType: string;
    title: string;
    startTime: string;
    endTime?: string | null;
    venue?: string | null;
    mode?: string | null;
    gcalEventId?: string | null;
  }> = [];

  for (const evt of events || []) {
    // NEVER sync registration deadlines to Google Calendar
    if (evt.event_type === 'registration_deadline') continue;
    if (!evt.start_time) continue;

    const status = appStatusMap.get(evt.company_id) || 'not_applied';
    const isManual = (evt as unknown as { manual_override?: boolean }).manual_override;

    // Filter out inactive/eliminated/withdrawn companies unless manually scheduled
    if (['not_shortlisted', 'rejected', 'not_applied', 'withdrawn', 'declined'].includes(status) && !isManual) {
      continue;
    }

    // Filter out stages beyond candidate's current progress
    if (!isManual) {
      const maxStage = STATUS_MAX_STAGE[status] ?? 2;
      const evtStage = EVENT_STAGE[evt.event_type] ?? 2;
      if (evtStage > maxStage) continue;
    }

    // Deduplicate identical company + event_type
    const key = `${evt.company_id}:${evt.event_type}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      eligibleEvents.push({
        id: evt.id,
        companyId: evt.company_id,
        companyName: companyMap.get(evt.company_id) || 'Placement Drive',
        eventType: evt.event_type,
        title: evt.title || `${companyMap.get(evt.company_id) || 'Placement'} - ${evt.event_type}`,
        startTime: evt.start_time,
        endTime: evt.end_time,
        venue: evt.venue,
        mode: evt.mode,
        gcalEventId: evt.gcal_event_id,
      });
    }
  }

  // 2. Fetch Google Calendar credentials
  const { data: accounts } = await supabase
    .from('gmail_accounts')
    .select('*')
    .eq('user_id', userId)
    .not('refresh_token_encrypted', 'is', null);

  const account = accounts?.find((a) => a.account_type === 'personal') || accounts?.[0];
  if (!account?.refresh_token_encrypted) {
    return NextResponse.json(
      { error: 'No personal Google account linked with Calendar permissions' },
      { status: 400 }
    );
  }

  const refreshToken = decrypt(account.refresh_token_encrypted);
  const accessToken = account.access_token_encrypted ? decrypt(account.access_token_encrypted) : undefined;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken, access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // 3. Retrieve all Google Calendar events for the active placement season
  const timeMin = new Date('2026-06-01T00:00:00Z').toISOString();
  const timeMax = new Date('2026-12-31T23:59:59Z').toISOString();

  const allGcalItems: any[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const res: any = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: 250,
      singleEvents: true,
      pageToken,
    });
    allGcalItems.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  // ONLY touch events created by NeoTrack (safe guard for personal events)
  const neoTrackGcalEvents = allGcalItems.filter(
    (item) => item.description?.includes('tracked by NeoTrack') || item.description?.includes('NeoTrack')
  );

  let deletedCount = 0;
  let updatedCount = 0;
  let insertedCount = 0;

  const matchedAppEventIds = new Set<string>();

  // 4. Reconcile existing GCal events: Update valid active ones, delete duplicates & stale ones
  for (const gItem of neoTrackGcalEvents) {
    const gStart = gItem.start?.dateTime ? new Date(gItem.start.dateTime).getTime() : 0;
    const gSummary = (gItem.summary || '').toLowerCase();

    // Match by stored gcalEventId or by company name + round type on same day
    const match = eligibleEvents.find((e) => {
      if (matchedAppEventIds.has(e.id)) return false; // Already claimed by another GCal event
      if (e.gcalEventId && e.gcalEventId === gItem.id) return true;

      const eStart = new Date(e.startTime).getTime();
      const sameDay = Math.abs(eStart - gStart) < 24 * 60 * 60 * 1000;
      const compLower = e.companyName.toLowerCase();
      const compMatch = gSummary.includes(compLower);

      const isPptE = e.eventType === 'ppt';
      const isPptG = /ppt|talk/i.test(gSummary);
      const isTestE = /test|assessment|coding/i.test(e.eventType);
      const isTestG = /test|assessment|coding/i.test(gSummary);

      return sameDay && compMatch && ((isPptE && isPptG) || (isTestE && isTestG));
    });

    if (match) {
      // Valid event -> Update in place
      matchedAppEventIds.add(match.id);
      const startDate = new Date(match.startTime);
      const endDate = match.endTime && !isNaN(new Date(match.endTime).getTime())
        ? new Date(match.endTime)
        : new Date(startDate.getTime() + 60 * 60 * 1000);

      await calendar.events.update({
        calendarId: 'primary',
        eventId: gItem.id,
        requestBody: {
          summary: match.title,
          location: match.venue || 'Campus / Online',
          description: `Placement Assessment / Event tracked by NeoTrack.\nMode: ${match.mode || 'Offline'}\nVenue: ${match.venue || 'Campus / Online'}`,
          start: { dateTime: startDate.toISOString(), timeZone: 'Asia/Kolkata' },
          end: { dateTime: endDate.toISOString(), timeZone: 'Asia/Kolkata' },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 30 },
              { method: 'popup', minutes: 120 },
              { method: 'email', minutes: 1440 },
            ],
          },
        },
      });

      // Update gcal_event_id in Supabase if not yet stored
      if (match.gcalEventId !== gItem.id) {
        await supabase.from('events').update({ gcal_event_id: gItem.id }).eq('id', match.id);
      }
      updatedCount++;
    } else {
      // Stale, duplicate, or dead event -> DELETE from GCal!
      try {
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: gItem.id,
        });
        deletedCount++;
      } catch (delErr) {
        console.error(`Failed to delete GCal event ${gItem.id}:`, delErr);
      }
    }
  }

  // 5. Insert any eligible events not yet present in GCal
  const toInsert = eligibleEvents.filter((e) => !matchedAppEventIds.has(e.id));
  for (const ins of toInsert) {
    const startDate = new Date(ins.startTime);
    const endDate = ins.endTime && !isNaN(new Date(ins.endTime).getTime())
      ? new Date(ins.endTime)
      : new Date(startDate.getTime() + 60 * 60 * 1000);

    const created = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: ins.title,
        location: ins.venue || 'Campus / Online',
        description: `Placement Assessment / Event tracked by NeoTrack.\nMode: ${ins.mode || 'Offline'}\nVenue: ${ins.venue || 'Campus / Online'}`,
        start: { dateTime: startDate.toISOString(), timeZone: 'Asia/Kolkata' },
        end: { dateTime: endDate.toISOString(), timeZone: 'Asia/Kolkata' },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'popup', minutes: 120 },
            { method: 'email', minutes: 1440 },
          ],
        },
      },
    });

    if (created.data.id) {
      await supabase.from('events').update({ gcal_event_id: created.data.id }).eq('id', ins.id);
      insertedCount++;
    }
  }

  return NextResponse.json({
    success: true,
    message: `Successfully synced Google Calendar: ${updatedCount} updated, ${insertedCount} inserted, ${deletedCount} stale events removed.`,
    updatedCount,
    insertedCount,
    deletedCount,
    totalEligible: eligibleEvents.length,
  });
}
