import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSync } from '@/lib/sync/engine';

interface PubSubPayload {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

interface GmailPushData {
  emailAddress?: string;
  historyId?: string;
}

/**
 * POST /api/webhooks/gmail
 *
 * Webhook receiver for Google Cloud Pub/Sub push notifications.
 * Automatically triggers incremental sync when a new email arrives in Gmail.
 */
export async function POST(req: NextRequest) {
  try {
    const body: PubSubPayload = await req.json();

    if (!body.message?.data) {
      return NextResponse.json({ message: 'No data in Pub/Sub payload' }, { status: 200 });
    }

    // Decode base64 Pub/Sub payload
    const decodedStr = Buffer.from(body.message.data, 'base64').toString('utf-8');
    let pushData: GmailPushData;

    try {
      pushData = JSON.parse(decodedStr);
    } catch {
      console.warn('Malformed Pub/Sub message data:', decodedStr);
      return NextResponse.json({ message: 'Invalid payload format' }, { status: 200 });
    }

    const { emailAddress, historyId } = pushData;

    if (!emailAddress) {
      return NextResponse.json({ message: 'Missing emailAddress' }, { status: 200 });
    }

    const supabase = createAdminClient();

    // Find the user who owns this Gmail account
    const { data: account, error } = await supabase
      .from('gmail_accounts')
      .select('id, user_id, last_history_id')
      .eq('email', emailAddress)
      .eq('is_connected', true)
      .single();

    if (error || !account) {
      console.warn(`No connected account found for email ${emailAddress}`);
      return NextResponse.json({ message: 'Account not found' }, { status: 200 });
    }

    // Execute background sync for this user
    console.log(`[Pub/Sub] Triggering background sync for user ${account.user_id} (${emailAddress}) at historyId ${historyId}`);
    
    // We execute sync asynchronously and return 200 immediately to prevent Pub/Sub retries
    runSync(account.user_id).catch((syncErr) => {
      console.error(`[Pub/Sub] Background sync failed for user ${account.user_id}:`, syncErr);
    });

    return NextResponse.json({
      success: true,
      message: `Sync queued for ${emailAddress}`,
    }, { status: 200 });

  } catch (err) {
    console.error('Error handling Gmail Pub/Sub webhook:', err);
    // Always return 200 to acknowledge Pub/Sub, preventing continuous retry loops on bad messages
    return NextResponse.json({ error: 'Internal handler error' }, { status: 200 });
  }
}
