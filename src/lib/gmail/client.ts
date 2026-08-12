import { google, gmail_v1 } from 'googleapis';
import { decrypt } from '@/lib/crypto/tokens';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Represents a connected Gmail account's credentials and metadata.
 */
export interface GmailAccount {
  id: string;
  email: string;
  account_type: 'personal' | 'college';
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expiry: string | null;
  last_sync_at: string | null;
  last_history_id: string | null;
}

/**
 * A normalized email message parsed from Gmail API response.
 */
export interface ParsedEmail {
  gmailMessageId: string;
  threadId: string | null;
  sender: string;
  senderEmail: string;
  subject: string;
  receivedAt: Date;
  bodySnippet: string;
  bodyPlain: string;
  bodyHtml: string;
  hasAttachments: boolean;
  attachments: ParsedAttachment[];
  labels: string[];
}

export interface ParsedAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

// ============================================
// Placement-focused Gmail search queries
// ============================================

/**
 * Returns a Gmail search query optimized for placement emails.
 * For college accounts, we cast a wider net since most emails are placement-related.
 * For personal accounts, we use tighter filters.
 */
export function getPlacementSearchQuery(
  accountType: 'personal' | 'college',
  afterDate?: Date
): string {
  if (accountType === 'college') {
    const collegeDateFilter = afterDate
      ? ` after:${afterDate.toISOString().split('T')[0].replace(/-/g, '/')}`
      : ' newer_than:2m';

    // College accounts — STRICTLY official CDC senders with placement keywords only
    return `(from:vitlions2027@vitbhopal.ac.in OR from:placementoffice@vitbhopal.ac.in OR from:noreply.cdcinfo@vitstudent.ac.in) (shortlist OR shortlisted OR "online test" OR "coding test" OR PPT OR assessment OR interview OR "selection list" OR "super dream" OR "dream core")${collegeDateFilter} -category:promotions -category:social`;
  }

  // Personal accounts — STRICTLY official NeoPAT / CDC emails from vitstudent.ac.in
  const personalDateFilter = afterDate
    ? ` after:${afterDate.toISOString().split('T')[0].replace(/-/g, '/')}`
    : ' newer_than:1y';

  return `from:noreply.cdcinfo@vitstudent.ac.in${personalDateFilter}`;
}

// ============================================
// OAuth Client Factory
// ============================================

/**
 * Creates an authenticated Gmail client for a specific account.
 * Decrypts the stored tokens and handles token refresh.
 */
export async function createGmailClient(
  account: GmailAccount
): Promise<{ gmail: gmail_v1.Gmail; refreshed: boolean }> {
  if (!account.access_token_encrypted || !account.refresh_token_encrypted) {
    throw new Error(`Account ${account.email} has no stored tokens`);
  }

  const accessToken = decrypt(account.access_token_encrypted);
  const refreshToken = decrypt(account.refresh_token_encrypted);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.token_expiry
      ? new Date(account.token_expiry).getTime()
      : undefined,
  });

  // Check if token is expired or about to expire (within 5 minutes)
  let refreshed = false;
  const expiryDate = account.token_expiry
    ? new Date(account.token_expiry).getTime()
    : 0;
  const isExpired = expiryDate < Date.now() + 5 * 60 * 1000;

  if (isExpired) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      refreshed = true;

      // Persist the new tokens
      const { encrypt: enc } = await import('@/lib/crypto/tokens');
      const supabase = createAdminClient();
      await supabase
        .from('gmail_accounts')
        .update({
          access_token_encrypted: credentials.access_token
            ? enc(credentials.access_token)
            : account.access_token_encrypted,
          refresh_token_encrypted: credentials.refresh_token
            ? enc(credentials.refresh_token)
            : account.refresh_token_encrypted,
          token_expiry: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : account.token_expiry,
        })
        .eq('id', account.id);
    } catch (err) {
      console.error(
        `Failed to refresh token for ${account.email}:`,
        err
      );
      // Mark account as disconnected
      const supabase = createAdminClient();
      await supabase
        .from('gmail_accounts')
        .update({ is_connected: false })
        .eq('id', account.id);
      throw new Error(
        `Token expired and refresh failed for ${account.email}. Please reconnect.`
      );
    }
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  return { gmail, refreshed };
}

// ============================================
// Email Fetching
// ============================================

/**
 * Fetches a list of message IDs matching the placement search query.
 */
export async function fetchMessageIds(
  gmail: gmail_v1.Gmail,
  query: string,
  maxResults: number = 200
): Promise<string[]> {
  const messageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults - messageIds.length, 100),
      pageToken,
    });

    if (response.data.messages) {
      for (const msg of response.data.messages) {
        if (msg.id) {
          messageIds.push(msg.id);
        }
      }
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken && messageIds.length < maxResults);

  return messageIds;
}

export interface MessageMetadata {
  id: string;
  threadId: string | null;
  sender: string;
  senderEmail: string;
  subject: string;
  receivedAt: Date;
  snippet: string;
}

/**
 * Fetches lightweight metadata of a single message (Subject, From, Date, Snippet)
 * for cheap inspection without downloading the full body or attachments.
 */
export async function fetchMessageMetadata(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<MessageMetadata> {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Date'],
  });

  const message = response.data;
  const headers = message.payload?.headers || [];

  const getHeader = (name: string): string => {
    const header = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase()
    );
    return header?.value || '';
  };

  const sender = getHeader('From');
  const senderEmail = extractEmailAddress(sender);
  const subject = getHeader('Subject');
  const dateStr = getHeader('Date');
  const receivedAt = dateStr ? new Date(dateStr) : new Date();

  return {
    id: message.id || messageId,
    threadId: message.threadId || null,
    sender,
    senderEmail,
    subject,
    receivedAt,
    snippet: message.snippet || '',
  };
}

/**
 * Fetches the full details of a single message and parses it into a clean format.
 */
export async function fetchMessageDetail(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<ParsedEmail> {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const message = response.data;
  const headers = message.payload?.headers || [];

  const getHeader = (name: string): string => {
    const header = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase()
    );
    return header?.value || '';
  };

  const sender = getHeader('From');
  const senderEmail = extractEmailAddress(sender);
  const subject = getHeader('Subject');
  const dateStr = getHeader('Date');
  const receivedAt = dateStr ? new Date(dateStr) : new Date();

  // Extract body
  const { plain, html } = extractBody(message.payload);

  // Extract attachments info
  const attachments = extractAttachmentInfo(message.payload);

  return {
    gmailMessageId: message.id || messageId,
    threadId: message.threadId || null,
    sender,
    senderEmail,
    subject,
    receivedAt,
    bodySnippet: message.snippet || '',
    bodyPlain: plain,
    bodyHtml: html,
    hasAttachments: attachments.length > 0,
    attachments,
    labels: (message.labelIds as string[]) || [],
  };
}

// ============================================
// Helpers
// ============================================

/**
 * Extracts the email address from a "Name <email>" formatted string.
 */
function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader;
}

/**
 * Recursively extracts plain and HTML body from a Gmail message payload.
 */
function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined
): { plain: string; html: string } {
  let plain = '';
  let html = '';

  if (!payload) return { plain, html };

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    plain = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  if (payload.mimeType === 'text/html' && payload.body?.data) {
    html = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  // Recurse into parts (multipart messages)
  if (payload.parts) {
    for (const part of payload.parts) {
      const sub = extractBody(part);
      if (!plain && sub.plain) plain = sub.plain;
      if (!html && sub.html) html = sub.html;
    }
  }

  return { plain, html };
}

/**
 * Extracts attachment metadata from a message payload.
 */
function extractAttachmentInfo(
  payload: gmail_v1.Schema$MessagePart | undefined
): ParsedAttachment[] {
  const attachments: ParsedAttachment[] = [];

  if (!payload) return attachments;

  if (payload.filename && payload.body?.attachmentId) {
    attachments.push({
      attachmentId: payload.body.attachmentId,
      filename: payload.filename,
      mimeType: payload.mimeType || 'application/octet-stream',
      size: payload.body.size || 0,
    });
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      attachments.push(...extractAttachmentInfo(part));
    }
  }

  return attachments;
}
