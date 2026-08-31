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
  // Guard: exclude ".ppt" file attachment mentions (e.g. "find the attached PPT file")
  if (/ppt|pre[\s-]*placement\s*talk/i.test(fullText) && !/ppt\s*file|\.ppt\b/i.test(fullText)) {
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

  // 3. Check for Interview / Next Selection Round
  // GUARD: If we already extracted a test event from this email, only create an interview
  // event if the SUBJECT explicitly mentions "interview". This prevents phantom interview
  // events when the body casually mentions "selection process" or similar language.
  const alreadyHasTestEvent = events.some((e) =>
    ['online_test', 'coding_test'].includes(e.eventType)
  );
  const subjectMentionsInterview = /interview/i.test(email.subject);

  if (
    /interview|next\s+round|selection\s+process/i.test(fullText) &&
    (!alreadyHasTestEvent || subjectMentionsInterview)
  ) {
    const isTech = /technical/i.test(fullText);
    // Word-boundary \b prevents matching "hr" inside words like "through", "share", "shortlisted"
    const isHr = /\bhr\b|human\s+resource/i.test(fullText);
    const interviewMatch = fullText.match(
      /(?:interview|next\s+round(?:\s+of\s+selection\s+process)?|selection\s+process)\s*(?:is\s+scheduled)?\s*[:\-–—]?\s*(?:on\s+)?\(?(.{1,120})/i
    );
    const date = parseDateTime(interviewMatch ? interviewMatch[0] : fullText);
    const venue = extractVenue(fullText);

    events.push({
      eventType: isTech ? 'technical_interview' : isHr ? 'hr_interview' : 'technical_interview',
      title: isTech
        ? 'Technical Interview'
        : isHr
        ? 'HR Interview'
        : /next\s+round|selection\s+process/i.test(email.subject)
        ? 'Next Round of Selection'
        : 'Interview Round',
      startTime: date,
      endTime: date ? new Date(date.getTime() + 60 * 60 * 1000) : null,
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

  // Clean markdown formatting, HTML entities, and excess whitespace
  const cleanText = text
    .replace(/[*_`>#]/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');

  const unannouncedPattern = /will be (?:announced|informed|shared) later|tba|tbd|to be (?:announced|disclosed)|not disclosed/i;

  // 0. CSE Branch Eligibility Guard
  // If email explicitly excludes CSE (e.g. "other than CSE", "CSE are not eligible"), ignore job details for B.Tech CSE Core student
  if (/other\s+than\s+(?:cse|computer)|(?:cse|computer|it)[^.\n]*?not\s+eligible|except\s+cse/i.test(cleanText)) {
    return { role: null, ctc: null, stipend: null, location: null, neoIdMatched: false, matchedNeoIdValue: null };
  }

  // 1. CTC Extraction — only the base LPA number (e.g. "14 LPA"), JB/variable ignored
  const ctcBlockMatch = cleanText.match(/\bCTC\b\s*[:\-–—\t]?\s*([\s\S]{1,400}?)(?:\b(?:Last date|Website|Location|Eligible|Eligibility|Stipend|Selection|Process|Registration)\b|$)/i);
  if (ctcBlockMatch && unannouncedPattern.test(ctcBlockMatch[1])) {
    ctc = null;
  } else {
    const ctcText = ctcBlockMatch ? ctcBlockMatch[1].trim() : cleanText;

    // Match ALL occurrences of "Rs. X LPA" or "X LPA" — take the max (total/gross CTC)
    const baseMatches = [...ctcText.matchAll(/(?:INR|₹|Rs\.?)\s*(\d+(?:\.\d+)?)\s*(?:LPA|L\s*PA|Lakhs?|Lac)\b/gi)];
    if (baseMatches.length > 0) {
      const values = baseMatches
        .map(m => parseFloat(m[1]))
        .filter(v => v > 0 && v < 200);
      if (values.length > 0) {
        ctc = `${Math.max(...values)} LPA`;
      }
    }

    // Fallback: scan whole cleanText for CTC/Package label
    if (!ctc) {
      const fallbackMatches = [...cleanText.matchAll(
        /(?:CTC|Package|Salary|Compensation)\s*[:\-–—\t]?\s*(?:INR|₹|Rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:LPA|L\s*PA|Lakhs?|Lac)\b/gi
      )];
      if (fallbackMatches.length > 0) {
        const values = fallbackMatches
          .map(m => parseFloat(m[1]))
          .filter(v => v > 0 && v < 200);
        if (values.length > 0) ctc = `${Math.max(...values)} LPA`;
      }
    }
  }

  // 2. Stipend Extraction
  const stipendBlockMatch = cleanText.match(/\b(?:Stipend|Stipened)\b\s*[:\-–—\t]?\s*([\s\S]{1,300}?)(?:\b(?:CTC|Last date|Website|Location|Eligible|Eligibility|Selection|Process|Registration)\b|$)/i);
  if (stipendBlockMatch && unannouncedPattern.test(stipendBlockMatch[1])) {
    stipend = null;
  } else if (stipendBlockMatch) {
    const stipendText = stipendBlockMatch[1];
    // Also match bare numbers like "40000" without currency prefix
    const stipendMatches = [...stipendText.matchAll(/(?:INR|₹|Rs\.?)?\s*([\d,]+)(?:\s*(?:\/\s*month|\/\s*mo|pm|p\.?m\.?|k|thousand))?/gi)];
    const nums: number[] = [];
    for (const m of stipendMatches) {
      const rawNum = m[1].replace(/,/g, '');
      const val = parseInt(rawNum, 10);
      // Accept values 5000-500000, excluding years
      if (val >= 5000 && val < 500000 && ![2024, 2025, 2026, 2027, 2028, 2029].includes(val)) {
        nums.push(val);
      }
    }
    if (nums.length > 0) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      if (min === max) {
        stipend = `₹${min.toLocaleString('en-IN')}/month`;
      } else {
        stipend = `₹${min.toLocaleString('en-IN')} - ₹${max.toLocaleString('en-IN')}/month`;
      }
    }
  }

  // 3. Category & Job Role Extraction
  let category: string | null = null;
  const categoryMatch = cleanText.match(
    /\bCategory\b\s*[:\-–—\t]?\s*([A-Za-z0-9\s\/\-\,\&]+?)(?:\s+(?:Date|Visit|Eligible|Eligibility|CTC|Stipend|Selection|Website|Process|Last\s+date)|$|\.|\r?\n)/i
  );
  if (categoryMatch) {
    let rawCat = categoryMatch[1].replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim();
    // Normalize e.g. "Super Dream Internship Registration - 2027 Batch" -> "Super Dream Internship"
    rawCat = rawCat.replace(/\s*(?:Registration|Drive|Batch|\d{4}).*$/i, '').trim();
    if (rawCat && rawCat.length >= 3 && !/will be|tba|tbd/i.test(rawCat)) {
      category = rawCat;
    }
  }

  // Also check subject/body for common tier keywords if category not explicitly in table
  if (!category) {
    if (/super\s+dream\s+internship/i.test(cleanText)) category = 'Super Dream Internship';
    else if (/super\s+dream/i.test(cleanText)) category = 'Super Dream';
    else if (/dream\s+internship/i.test(cleanText)) category = 'Dream Internship';
    else if (/\bdream\b/i.test(cleanText)) category = 'Dream';
    else if (/regular\s+offer/i.test(cleanText)) category = 'Regular';
  }

  const roleMatch = cleanText.match(
    /(?:Job\s+Role|Designation|Position|Profile)\s*[:\-–—\t]?\s*([A-Za-z0-9\s\/\-\,\&]+?)(?:\s+(?:Service|Greetings|About|Campus|Eligible|Selection|Location|CTC|Stipend|Process|Note|Date)|$|\.|\r?\n)/i
  );
  if (roleMatch) {
    const rawRole = roleMatch[1].replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim().slice(0, 40);
    if (
      rawRole &&
      rawRole.length >= 2 &&
      !/\byou\b|\bwe\b|\bi\b|dear\s|greetings|hi\s+|hello\s|upcoming|forwarded|scheduled|not japanese|eligible|please|kindly|hereby|inform|congratulat|registr|passout|batch|drive|internship\s+registration|^[>,\.\*\s]+$/i.test(rawRole)
    ) {
      role = rawRole;
    }
  }

  // If no specific technical role was extracted, use the clean placement category (e.g. "Super Dream Internship")
  if (!role && category) {
    role = category;
  }

  // 4. Job Location Extraction
  const locMatch = cleanText.match(
    /(?:Job\s+)?Location\s*[:\-–—\t]?\s*([A-Za-z0-9\s\/\-]+?)(?:\s+(?:Eligibility|Designation|Role|Process|CTC|Stipend|Note|Kind|Website|Selection)|$|\.|\r?\n)/i
  );
  if (locMatch) {
    const rawLoc = locMatch[1].replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim().slice(0, 40);
    if (
      rawLoc &&
      rawLoc.length >= 2 &&
      !/nonsense|come at|assistance|applicable|candidate|round\s+\d+|results|lab|service agreement|forwarded message|scheduled on|online test|@|own location|pearl research|anna auditorium|will be|tba|tbd|^[>,\.\*\s]+$/i.test(rawLoc)
    ) {
      location = rawLoc;
    }
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
