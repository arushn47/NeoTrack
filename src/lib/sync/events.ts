import type { ParsedEmail } from '@/lib/gmail/client';

export interface ExtractedEvent {
  eventType:
    | 'registration_deadline'
    | 'ppt'
    | 'online_test'
    | 'coding_test'
    | 'technical_interview'
    | 'hr_interview'
    | 'final_interview'
    | 'result'
    | 'joining_date'
    | 'other';
  title: string;
  startTime: Date | null;
  endTime: Date | null;
  venue: string | null;
  mode: 'online' | 'offline' | 'hybrid' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
}

export interface ExtractedJobDetails {
  role: string | null;
  ctc: string | null;
  stipend: string | null;
  location: string | null;
  neoIdMatched: boolean;
  matchedNeoIdValue: string | null;
}

// ============================================
// Indian Date & Time Parser
// ============================================

/**
 * Month names and abbreviations map.
 */
const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Regex patterns for Indian email date/time formats:
 * - "11th August 2026 by 11:30 AM"
 * - "13th Aug 2026 @ 2.30 Pm"
 * - "14th Aug 2026 10 AM onwards"
 * - "10th August 2026 (6 PM)"
 * - "11/08/2026 at 10:00 AM"
 */
const MONTH_PATTERN =
  'january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec';

/**
 * Parses a date/time string from Indian placement emails.
 * Handles formats like:
 * - "13th August 2026 by 02:30 PM"
 * - "11-08-2026 by 7pm"
 * - "13th August 2026 by 11.00 am sharp"
 * - "14th Aug 2026 by 9.30 am"
 */
export function parseDateTime(text: string): Date | null {
  if (!text) return null;

  let day: number | null = null;
  let month: number | null = null;
  let year = new Date().getFullYear();

  // 1. Check DD-MM-YYYY or DD/MM/YYYY numeric format
  const numMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/);
  if (numMatch) {
    day = parseInt(numMatch[1], 10);
    month = parseInt(numMatch[2], 10) - 1;
    year =
      numMatch[3].length === 2
        ? 2000 + parseInt(numMatch[3], 10)
        : parseInt(numMatch[3], 10);
  } else {
    // 2. Check Named Month format: "13th August 2026" or "August 13, 2026"
    const nameMatch =
      text.match(
        new RegExp(
          `(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?`,
          'i'
        )
      ) ||
      text.match(
        new RegExp(
          `(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,\\s*(\\d{4}))?`,
          'i'
        )
      );

    if (nameMatch) {
      if (MONTHS[nameMatch[2]?.toLowerCase()] !== undefined) {
        day = parseInt(nameMatch[1], 10);
        month = MONTHS[nameMatch[2].toLowerCase()];
        if (nameMatch[3]) year = parseInt(nameMatch[3], 10);
      } else if (MONTHS[nameMatch[1]?.toLowerCase()] !== undefined) {
        month = MONTHS[nameMatch[1].toLowerCase()];
        day = parseInt(nameMatch[2], 10);
        if (nameMatch[3]) year = parseInt(nameMatch[3], 10);
      }
    }
  }

  if (day === null || month === null) return null;

  // 3. Extract Time (e.g. "by 02:30 PM", "by 7pm", "by 11.00 am", "at 9:30 am", "14:30")
  let hours = 9;
  let minutes = 0;

  const timeMatch =
    text.match(/(?:by|at|@|from)?\s*(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)/i) ||
    text.match(/(?:by|at|@|from)?\s*(\d{1,2})(?::|\.)(\d{2})\s*(?:hours|hrs|sharp)?/i);

  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const isPm = timeMatch[3] && timeMatch[3].toLowerCase().startsWith('p');
    if (isPm && h < 12) h += 12;
    if (!isPm && timeMatch[3] && h === 12) h = 0;
    hours = h;
    if (timeMatch[2]) minutes = parseInt(timeMatch[2], 10);
  }

  // Construct explicitly in Indian Standard Time (IST, UTC+05:30)
  // This prevents UTC servers (e.g. Vercel) from shifting 2:30 PM IST into 8:00 PM IST!
  const monthStr = String(month + 1).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  const hourStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');
  const isoWithIstOffset = `${year}-${monthStr}-${dayStr}T${hourStr}:${minStr}:00+05:30`;

  const date = new Date(isoWithIstOffset);
  return isNaN(date.getTime()) ? null : date;
}

// ============================================
// Event Extractor
// ============================================

/**
 * Extracts placement events (PPT, Test, Interview) from an email.
 */
export function extractEvents(email: ParsedEmail): ExtractedEvent[] {
  const events: ExtractedEvent[] = [];
  const fullText = `${email.subject}\n${email.bodyPlain || email.bodySnippet}`;

  // 1. Check for Pre-Placement Talk (PPT)
  if (/ppt|pre[\s-]*placement\s*talk/i.test(fullText)) {
    const pptMatch = fullText.match(/(?:ppt|pre[\s-]*placement\s*talk)\s*[:\-–—]?\s*(.{1,100})/i);
    const date = parseDateTime(pptMatch ? pptMatch[0] : fullText);
    const venue = extractVenue(fullText);

    events.push({
      eventType: 'ppt',
      title: 'Pre-Placement Talk (PPT)',
      startTime: date,
      endTime: date ? new Date(date.getTime() + 60 * 60 * 1000) : null, // +1 hour
      venue,
      mode: determineMode(fullText, venue),
      confidence: date ? 'high' : 'medium',
    });
  }

  // 2. Check for Online / Coding Test
  if (/(?:online|coding|aptitude|assessment)\s*test|hackerrank|hackerearth|mettl|amcat/i.test(fullText)) {
    const testMatch = fullText.match(/(?:online|coding|aptitude|assessment)\s*test\s*[:\-–—]?\s*(.{1,100})/i);
    const date = parseDateTime(testMatch ? testMatch[0] : fullText);
    const venue = extractVenue(fullText);

    events.push({
      eventType: /coding/i.test(fullText) ? 'coding_test' : 'online_test',
      title: /coding/i.test(fullText) ? 'Coding Test' : 'Online Assessment',
      startTime: date,
      endTime: date ? new Date(date.getTime() + 90 * 60 * 1000) : null, // +1.5 hours
      venue: venue || 'Online Link / Mettl / HackerRank',
      mode: 'online',
      confidence: date ? 'high' : 'medium',
    });
  }

  // 3. Check for Interview
  if (/interview/i.test(fullText)) {
    const isTech = /technical/i.test(fullText);
    const isHr = /hr|human\s+resource/i.test(fullText);
    const interviewMatch = fullText.match(/interview\s*[:\-–—]?\s*(.{1,100})/i);
    const date = parseDateTime(interviewMatch ? interviewMatch[0] : fullText);
    const venue = extractVenue(fullText);

    events.push({
      eventType: isTech ? 'technical_interview' : isHr ? 'hr_interview' : 'technical_interview',
      title: isTech ? 'Technical Interview' : isHr ? 'HR Interview' : 'Interview Round',
      startTime: date,
      endTime: date ? new Date(date.getTime() + 45 * 60 * 1000) : null,
      venue,
      mode: determineMode(fullText, venue),
      confidence: date ? 'high' : 'medium',
    });
  }

  return events;
}

/**
 * Extracts venue / location details from email text.
 * Handles patterns like "@ Respective campus venues", "LC 202", "VIT Vellore campus".
 */
export function extractVenue(text: string): string | null {
  const venueMatch = text.match(
    /(?:venue|location|room|hall|lab|place)\s*[:\-–—]\s*(.+?)(?:\r?\n|$|\.)/i
  );
  if (venueMatch && venueMatch[1]) {
    return venueMatch[1].trim().slice(0, 100);
  }

  const atMatch = text.match(/@\s*([A-Za-z0-9\s,.\-]{5,60})/);
  if (atMatch && atMatch[1]) {
    return atMatch[1].trim();
  }

  if (/online|virtual|teams|zoom|meet|google\s+meet/i.test(text)) {
    return 'Online / Virtual';
  }

  return null;
}

function determineMode(
  text: string,
  venue: string | null
): 'online' | 'offline' | 'hybrid' | 'unknown' {
  if (venue && /online|virtual|teams|zoom|meet/i.test(venue)) return 'online';
  if (/online|virtual|teams|zoom|meet/i.test(text)) return 'online';
  if (venue || /campus|hall|lab|room|building/i.test(text)) return 'offline';
  return 'unknown';
}

/**
 * Extracts Job Details (Role, CTC, Stipend, Location) from email text.
 */
export function extractJobDetails(text: string): ExtractedJobDetails {
  let role: string | null = null;
  let ctc: string | null = null;
  let stipend: string | null = null;
  let location: string | null = null;

  // CTC extraction e.g. "9LPA+1.2 Lakh JB", "CTC: 22 Lakhs", "CTC: 22L PA", "22.0L PA", "INR 12 LPA"
  const tableCtcMatch = text.match(
    /(?:CTC|Package|Salary|Compensation)\s*[:\-–—\t]?\s*(?:Year\s*\d+\s*)?(?:\(?CTC\s*[:\-–—]?\s*)?(?:INR|Rs\.?)?\s*([₹\d\.]+(?:\s*-\s*[\d\.]+)?\s*(?:LPA|L\s*PA|Lakhs?|Lac|Cr|K)?(?:\s*\+\s*[\d\.]+\s*(?:Lakhs?|LPA|L|k)?\s*(?:JB|Bonus|Retention)?)?)/i
  );
  if (tableCtcMatch && tableCtcMatch[1]) {
    ctc = tableCtcMatch[1].trim();
    if (/^\d+(\.\d+)?$/.test(ctc)) {
      ctc = `${ctc} LPA`;
    }
  }

  if (!ctc) {
    const standaloneCtc = text.match(/\b([₹\d\.]+\s*(?:L|LPA)\s*PA)\b/i);
    if (standaloneCtc) ctc = standaloneCtc[1].trim();
  }

  // Stipend extraction e.g. "Stipend: 36000", "Stipend: 50,000 pm", "50k PM"
  const stipendMatch = text.match(
    /stipend\s*[:\-–—\t]?\s*(?:INR|Rs\.?)?\s*([₹\d,]+(?:\s*k)?(?:\s*\/\s*m(?:onth)?|p\.?m\.?|per\s*month)?)/i
  );
  if (stipendMatch && stipendMatch[1]) {
    stipend = stipendMatch[1].trim();
    const cleanNum = stipend.replace(/[^\d]/g, '');
    if (cleanNum && parseInt(cleanNum, 10) >= 1000) {
      const num = parseInt(cleanNum, 10);
      stipend = `₹${num.toLocaleString('en-IN')}/month`;
    }
  }

  // Role / Category extraction e.g. "Super Dream Internship", "Software Developer", "SDE"
  const roleMatch = text.match(
    /(?:role|profile|designation|position|category)\s*[:\-–—\t]?\s*(.+?)(?:\r?\n|$|,|\.)/i
  );
  if (roleMatch) {
    role = roleMatch[1].trim().slice(0, 60);
  }

  // Location extraction
  const locationMatch = text.match(
    /(?:job\s+)?location\s*[:\-–—\t]?\s*(.+?)(?:\r?\n|$|,|\.)/i
  );
  if (locationMatch) {
    location = locationMatch[1].trim().slice(0, 60);
  }

  return {
    role,
    ctc,
    stipend,
    location,
    neoIdMatched: false,
    matchedNeoIdValue: null,
  };
}
