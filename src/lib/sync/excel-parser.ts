import type { gmail_v1 } from 'googleapis';
import * as XLSX from 'xlsx';
import type { ParsedAttachment } from '@/lib/gmail/client';

export interface ExcelMatchResult {
  matched: boolean;
  filename: string;
  matchedNeoId: string | null;
  details: string | null;
  venueOrRoom: string | null;
}

/**
 * Downloads and scans Excel/CSV attachments for a candidate's Neo ID or Registration No.
 *
 * @param gmail Gmail API client
 * @param messageId Gmail Message ID
 * @param attachments List of attachments on the email
 * @param userNeoId User's configured Neo ID (e.g. "I4W0P0K8")
 * @param userEmail User's email (e.g. "arush.23bce10472@vitbhopal.ac.in")
 */
export async function scanExcelAttachmentsForNeoId(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachments: ParsedAttachment[],
  userNeoId: string | null,
  userEmail: string
): Promise<ExcelMatchResult | null> {
  const excelAttachments = attachments.filter((att) =>
    /\.(xlsx|xls|csv)$/i.test(att.filename)
  );

  if (excelAttachments.length === 0) {
    return null;
  }

  // Identifiers to search for
  const searchTokens: string[] = [];
  if (userNeoId && userNeoId.length >= 4) {
    searchTokens.push(userNeoId.toUpperCase().trim());
  }

  // Extract reg number from email (e.g. "23BCE10472")
  const regMatch = userEmail.match(/([0-9]{2}[a-z]{3}[0-9]{4,5})/i);
  if (regMatch && regMatch[1]) {
    searchTokens.push(regMatch[1].toUpperCase().trim());
  }

  if (searchTokens.length === 0) {
    return null;
  }

  for (const att of excelAttachments) {
    try {
      // Download attachment data from Gmail API
      const res = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: att.attachmentId,
      });

      if (!res.data.data) continue;

      // Base64URL decode to Buffer
      const buffer = Buffer.from(res.data.data, 'base64url');

      // Parse with SheetJS
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // Convert sheet to array of rows (JSON)
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          defval: '',
        });

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          if (!Array.isArray(row)) continue;

          // Check each cell in the row
          for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const cellValue = String(row[colIndex] || '').toUpperCase().trim();

            for (const token of searchTokens) {
              if (cellValue === token || cellValue.includes(token)) {
                // MATCH FOUND!
                // Look for Room / Venue / Time in adjacent columns
                let roomOrVenue: string | null = null;
                for (let c = 0; c < row.length; c++) {
                  if (c === colIndex) continue;
                  const otherCell = String(row[c] || '').trim();
                  if (otherCell && (otherCell.length < 30 || /room|hall|lab|prp|sjt|mb|tt/i.test(otherCell))) {
                    roomOrVenue = otherCell;
                    break;
                  }
                }

                return {
                  matched: true,
                  filename: att.filename,
                  matchedNeoId: token,
                  details: `Matched in ${att.filename} (Sheet: ${sheetName}, Row: ${rowIndex + 1})${
                    roomOrVenue ? ` - Details: ${roomOrVenue}` : ''
                  }`,
                  venueOrRoom: roomOrVenue,
                };
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(`Failed to scan attachment ${att.filename}:`, err);
    }
  }

  return null;
}
