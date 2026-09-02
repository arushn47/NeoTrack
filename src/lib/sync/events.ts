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

  // 1. Check DD-MM-YYYY, DD/MM/YYYY, or DD.MM.YYYY numeric format (e.g. "02.09.2026", "11-08-2026")
  const numMatch = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})/);
  if (numMatch) {
    day = parseInt(numMatch[1], 10);
    month = parseInt(numMatch[2], 10) - 1;
    year =
      numMatch[3].length === 2
        ? 2000 + parseInt(numMatch[3], 10)
        : parseInt(numMatch[3], 10);
  } else {
    // 2. Check Named Month format: "13th August 2026", "2nd Sep 2026", "1st september"
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

  // 3. Extract Time (e.g. "by 3.30 pm", "by 3.30 p", "at 11:30 AM", "by 7pm", "by 8 pm", "by 11.00 am sharp")
  let hours = 9;
  let minutes = 0;

  const timeMatch =
    text.match(/(?:by|at|@|from)?\s*(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.|p\b|a\b)/i) ||
    text.match(/(?:by|at|@|from)?\s*(\d{1,2})(?::|\.)(\d{2})\s*(?:hours|hrs|sharp)?/i);

  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const indicator = timeMatch[3] ? timeMatch[3].toLowerCase() : '';
    const isPm = indicator.startsWith('p');
    if (isPm && h < 12) h += 12;
    if (!isPm && indicator && h === 12) h = 0;
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
  if (!text) return null;

  // 1. Explicit lab / campus mentions in user commands or emails
  if (/\b(?:respective\s+labs?|computer\s+labs?|in\s+labs?|at\s+labs?|physical\s+at\s+labs?)\b/i.test(text)) {
    return 'Respective Labs (Offline)';
  }
  if (/\b(?:physical|offline)\s+(?:at|in)\s+([A-Za-z0-9\s,\-]{2,40})/i.test(text)) {
    const m = text.match(/\b(?:physical|offline)\s+(?:at|in)\s+([A-Za-z0-9\s,\-]{2,40})/i);
    if (m && m[1]) {
      const clean = m[1].replace(/\s*(?:not\s+online|online|and).*$/i, '').trim();
      return `${clean} (Offline)`;
    }
  }
  if (/\b(?:lab|computer\s+lab)\b/i.test(text)) {
    if (/physical|offline|in\s+person|not\s+online/i.test(text)) return 'Respective Labs (Offline)';
  }

  // 2. Explicit "venue: <place>" or "location: <place>"
  const venueMatch = text.match(
    /(?:venue|location|room|hall|place)\s*[:\-–—]\s*([^\r\n.,]+)/i
  );
  if (venueMatch && venueMatch[1]) {
    const raw = venueMatch[1].trim();
    if (raw.length > 0 && raw.length <= 50) return raw;
  }

  // 3. Check @ <place>
  const atMatch = text.match(/@\s*([A-Za-z0-9\s,\-]{3,45})(?:\r?\n|$|\.|\(|\b)/);
  if (atMatch && atMatch[1]) {
    const raw = atMatch[1].trim();
    if (/own\s+location/i.test(raw)) return 'Own Location';
    if (/pearl\s+research\s+park|prp/i.test(raw)) return 'Pearl Research Park (PRP)';
    if (/anna\s+auditorium/i.test(raw)) return 'Anna Auditorium';
    if (/channa\s+reddy/i.test(raw)) return 'Channa Reddy Auditorium';
    if (/sarojini\s+naidu/i.test(raw)) return 'Sarojini Naidu Gallery';
    if (/respective\s+campus/i.test(raw)) return 'Respective Campus Venues';
    if (/lab/i.test(raw)) return 'Respective Labs (Offline)';
    return raw;
  }

  // 4. "at <building/room>"
  const atPlaceMatch = text.match(/\bat\s+(SJT\s*\d+|PRP\s*\d+|TT\s*\d+|MB\s*\d+|SMV\s*\d+|CB\s*\d+|Sarojini\s+Naidu|Anna\s+Auditorium|Channa\s+Reddy|Pearl\s+Research\s+Park|CDC\s+Office)/i);
  if (atPlaceMatch && atPlaceMatch[1]) {
    return atPlaceMatch[1].trim();
  }

  if (/own\s+location/i.test(text) && !/not\s+own\s+location/i.test(text)) {
    return 'Own Location';
  }

  // 5. Check online vs offline
  const isExplicitOffline = /physical|offline|in[\s-]person|not\s+online/i.test(text);
  if (!isExplicitOffline && /online|virtual|teams|zoom|meet|google\s+meet/i.test(text)) {
    return 'Online / Virtual';
  }

  if (isExplicitOffline) {
    return 'Campus / Offline';
  }

  return null;
}

function determineMode(
  text: string,
  venue: string | null
): 'online' | 'offline' | 'hybrid' | 'unknown' {
  if (/not\s+online|physical|offline|in[\s-]person/i.test(text)) return 'offline';
  if (venue && /offline|lab|hall|room|building|prp|sjt|auditorium/i.test(venue)) return 'offline';
  if (venue && /online|virtual|teams|zoom|meet/i.test(venue)) return 'online';
  if (/online|virtual|teams|zoom|meet/i.test(text)) return 'online';
  if (venue || /campus|hall|lab|room|building/i.test(text)) return 'offline';
  return 'unknown';
}

export type TravelRequirement = 'vellore' | 'chennai' | 'bhopal_lab' | 'online' | null;

/**
 * Extracts campus travel requirement / Mode for VIT Bhopal students strictly from the main circular email.
 */
export function extractTravelRequirement(text: string): TravelRequirement {
  const clean = text
    .replace(/[*_`>#]/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');

  // 1. Isolate the "Date of Visit" / Process Schedule section if present
  const scheduleMatch = clean.match(/(?:Date\s+of\s+Visit|Process\s+details|Process\s+schedule|Hiring\s+process)[\s\S]{1,600}?(?=(?:Eligible|Eligibility|CTC|Stipend|Selection|Website|Last\s+date)|$)/i);
  const targetText = scheduleMatch ? scheduleMatch[0] : clean;

  // 2. Bhopal exemption check: e.g. "Virtual Interview : 31st August 2026 (AP & Bhopal Campus Students)"
  if (/virtual\s+interview[^(]*?\(\s*(?:ap\s*&?\s*)?bhopal/i.test(targetText)) {
    return 'online';
  }

  // 3. Explicit Travel to Vellore check (e.g. "Interview : @ Physical VIT Vellore campus", "Entire physical Process @ VIT Vellore")
  if (
    /@\s*(?:physical\s+)?vit\s+vellore/i.test(targetText) ||
    /physical\s+interview[^.\n]*?(?:@\s*)?(?:physical\s+)?vit\s+vellore/i.test(targetText) ||
    /interview[^.\n]*?(?:@\s*)?(?:physical\s+)?vit\s+vellore/i.test(targetText) ||
    /interview[^.\n]*?at\s+vellore\s+campus/i.test(targetText) ||
    /bhopal[^.\n]*?have\s+to\s+travel.*vellore/i.test(targetText) ||
    /@\s*vit\s+vellore\s+campus\s*\(\s*entire\s+physical/i.test(targetText)
  ) {
    return 'vellore';
  }

  // 4. Explicit Travel to Chennai check
  if (
    /@\s*(?:physical\s+)?vit\s+chennai/i.test(targetText) ||
    /physical\s+interview[^.\n]*?(?:@\s*)?(?:physical\s+)?vit\s+chennai/i.test(targetText) ||
    /interview[^.\n]*?(?:@\s*)?(?:physical\s+)?vit\s+chennai/i.test(targetText) ||
    /interview[^.\n]*?at\s+chennai\s+campus/i.test(targetText)
  ) {
    return 'chennai';
  }

  // 5. Respective Campus Labs (All stages in campus labs / venues at Bhopal)
  if (
    /@\s*respective\s+campus\s+(?:labs|venues|lab)/i.test(targetText) ||
    /in\s+campus\s+lab\s+only/i.test(targetText) ||
    /report\s+to\s+lc\s*\d+/i.test(targetText) ||
    /@\s*lc\s*\d+/i.test(targetText)
  ) {
    return 'bhopal_lab';
  }

  // 6. Online / Virtual
  if (
    /\bvirtual\b/i.test(targetText) ||
    /@\s*own\s+location/i.test(targetText) ||
    /online\s+mode/i.test(targetText) ||
    /@\s*online/i.test(targetText)
  ) {
    return 'online';
  }

  return null;
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
  if (/other\s+than\s+(?:cse|computer)|(?:cse|computer|it)[^.\n]*?not\s+eligible|except\s+cse/i.test(cleanText)) {
    return { role: null, ctc: null, stipend: null, location: null, neoIdMatched: false, matchedNeoIdValue: null };
  }

  // 1. CTC Extraction — handles single LPA, ranges (e.g. "8.5 - 10 LPA", "30 _ 31 LPA"), PPO formulas, and additions ("14+1 LPA")
  const ctcBlockMatch = cleanText.match(/\b(?:CTC|Cost\s+to\s+Company|Salary|Package|Compensation|PPO\s+CTC|Gross\s+CTC|PPO)\b\s*[:\-–—\t]?\s*([\s\S]{1,500}?)(?:\b(?:Last date|Website|Location|Eligible|Eligibility|Stipend|Selection|Process|Registration)\b|$)/i);
  if (ctcBlockMatch && unannouncedPattern.test(ctcBlockMatch[1])) {
    ctc = null;
  } else {
    const ctcText = ctcBlockMatch ? ctcBlockMatch[1].trim() : cleanText;
    
    // 1. Remove all parentheses and bracket contents completely (e.g. "(RB -2+3+4)", "(If Converted)", "(10% Var)")
    const cleanCtc = ctcText
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ');

    const nums: number[] = [];

    // 2. Check for addition formulas: e.g. "14+1 LPA", "14 + 1"
    const addMatches = [...cleanCtc.matchAll(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)(?:\s*(?:LPA|L\s*PA|Lakhs?|Lacs?|Lac|\bL\b))?/gi)];
    for (const m of addMatches) {
      const sum = parseFloat(m[1]) + parseFloat(m[2]);
      if (sum >= 3 && sum < 200) nums.push(sum);
    }

    // 3. Match ranges like "12 - 15 LPA", "30 _ 31 LPA", "8.5 to 10 LPA"
    if (nums.length === 0) {
      const rangeMatches = [...cleanCtc.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|–|—|_|\bto\b)\s*(\d+(?:\.\d+)?)\s*(?:LPA|L\s*PA|Lakhs?|Lacs?|Lac|\bL\b)/gi)];
      for (const m of rangeMatches) {
        const v1 = parseFloat(m[1]);
        const v2 = parseFloat(m[2]);
        if (v1 >= 3 && v1 < 200) nums.push(v1);
        if (v2 >= 3 && v2 < 200) nums.push(v2);
      }
    }

    // 4. Match individual LPA numbers like "20 LPA", "20 L", "14.5 LPA", "10 Lakhs"
    if (nums.length === 0) {
      const baseMatches = [...cleanCtc.matchAll(/(?:INR|₹|Rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:LPA|L\s*PA|Lakhs?|Lacs?|Lac|\bL\b|Per\s+Annum|\/\s*annum)\b/gi)];
      for (const m of baseMatches) {
        const v = parseFloat(m[1]);
        if (v >= 3 && v < 200) nums.push(v);
      }
    }

    // 5. Match raw rupee amounts like "12,00,000" or "7,61,250"
    if (nums.length === 0) {
      const rupeeMatches = [...cleanCtc.matchAll(/(?:CTC|Package|Salary|Compensation|PPO|Research|Development|Growth)\s*[:\-–—\t]?\s*(?:INR|₹|Rs\.?)?\s*([\d,]+)(?:\s*(?:INR|₹|\/\-))?/gi)];
      for (const m of rupeeMatches) {
        const val = parseInt(m[1].replace(/,/g, ''), 10);
        if (val >= 300000 && val <= 20000000 && ![2024, 2025, 2026, 2027, 2028, 2029].includes(val)) {
          const lpa = Math.round((val / 100000) * 100) / 100;
          nums.push(lpa);
        }
      }
    }

    if (nums.length > 0) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      if (min === max) {
        ctc = `${min.toString().replace(/\.0$/, '')} LPA`;
      } else {
        ctc = `${min.toString().replace(/\.0$/, '')} - ${max.toString().replace(/\.0$/, '')} LPA`;
      }
    }
  }

  // 2. Stipend Extraction — handles single amounts, ranges (e.g. "₹75,000 - ₹1,00,000/month"), and multi-role tiers
  const stipendBlockMatch = cleanText.match(/\b(?:Stipend|Stipened|Internship\s+Stipend)\b\s*[:\-–—\t]?\s*([\s\S]{1,400}?)(?:\b(?:CTC|Last date|Website|Location|Eligible|Eligibility|Selection|Process|Registration)\b|$)/i);
  if (stipendBlockMatch && unannouncedPattern.test(stipendBlockMatch[1])) {
    stipend = null;
  } else if (stipendBlockMatch) {
    const stipendText = stipendBlockMatch[1];
    const stipendMatches = [...stipendText.matchAll(/(?:INR|₹|Rs\.?)?\s*([\d,]+(?:\.\d+)?)\s*(?:k|thousand)?(?:\s*(?:\/\s*month|\/\s*mo|pm|p\.?m\.?|per\s+month))?/gi)];
    const nums: number[] = [];
    for (const m of stipendMatches) {
      let rawNum = m[1].replace(/,/g, '');
      let val = parseFloat(rawNum);
      if (/k\b/i.test(m[0]) && val < 500) {
        val = val * 1000;
      }
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

  // 4. Job Location Extraction (extracts clean cities, states, and countries without internship/drive noise)
  const locMatch = cleanText.match(/(?:Job\s+)?Location\s*[:\-–—\t]?\s*([^\n\r*<>{}_]{2,80})/i);
  if (locMatch) {
    let rawLoc = locMatch[1]
      .replace(/^[:\-–—\s*\(s\)]+/, '')
      .replace(/[:\-–—\s*]+$/, '')
      .replace(/\s*(?:Note|Eligibility|Registration|CTC|Stipend|Internship|Placement|Offer|Process|Website|Warm|Kind|Selection|Designation|Role|Job|JD|Position|Skills|Service|All\s+the|Joining|Work\s+Mode|Economy|On\s+Wed|For\s+more|PPO|About|Mandatory|depending\s+on).*$/i, '')
      .replace(/\b(?:internship|placement|drive|hiring|offer|job|role|any\s+honeywell\s+site)\b/gi, '')
      .replace(/^\s*(?:\(Core\):?|Core\):?)\s*/i, '')
      .replace(/[\.\,\:\-\(\)\–—]+$/, '')
      .replace(/^[\.\,\:\-\(\)\–—]+/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);

    if (
      rawLoc &&
      rawLoc.length >= 2 &&
      !/nonsense|come at|assistance|applicable|candidate|round\s+\d+|results|lab|service agreement|forwarded message|scheduled on|online test|@|own location|pearl research|anna auditorium|students with|clash|will be|tba|tbd|^[>,\.\*\s]+|those in|for you is|services interested|economy class|round\s+trip|will be subject|where we work|entities in|\bpre$|placement\s+office/i.test(rawLoc)
    ) {
      if (/remote/i.test(rawLoc)) location = 'Remote';
      else if (/pan\s+india/i.test(rawLoc)) location = 'Pan India';
      else location = rawLoc;
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
