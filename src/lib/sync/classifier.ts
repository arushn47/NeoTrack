import type { ParsedEmail } from '@/lib/gmail/client';

// ============================================
// Email Classification Types
// ============================================

export type EmailClassification =
  | 'registration'
  | 'registration_confirmation'
  | 'application_status'
  | 'withdrawal'
  | 'decline'
  | 'shortlist'
  | 'ppt'
  | 'test'
  | 'interview'
  | 'jd'
  | 'venue_update'
  | 'result'
  | 'general'
  | 'irrelevant'
  | 'unclassified';

export interface ClassificationResult {
  classification: EmailClassification;
  confidence: 'high' | 'medium' | 'low';
  companyName: string | null;
  reason: string;
}

// ============================================
// Classification Rules
// ============================================

interface ClassificationRule {
  classification: EmailClassification;
  confidence: 'high' | 'medium' | 'low';
  /** Returns true if the rule matches. Checked against lowercase subject + body snippet. */
  match: (subject: string, body: string, sender: string) => boolean;
  reason: string;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // --- HIGH CONFIDENCE ---
  {
    classification: 'shortlist',
    confidence: 'high',
    match: (s, b) =>
      /shortlist(ed)?/i.test(s) &&
      !/not\s+shortlist/i.test(s) &&
      !/un-?shortlist/i.test(s),
    reason: 'Subject contains "shortlisted"',
  },
  {
    classification: 'result',
    confidence: 'high',
    match: (s, b) =>
      /(result|selected|final\s*selection|offer\s*(letter|release))/i.test(s) &&
      !/not\s+selected/i.test(s),
    reason: 'Subject mentions results or selection',
  },
  {
    classification: 'result',
    confidence: 'high',
    match: (s, b) =>
      /not\s+selected|regret\s+to\s+inform|unfortunately|could\s+not\s+be\s+selected/i.test(s + ' ' + b),
    reason: 'Rejection language detected',
  },
  {
    classification: 'interview',
    confidence: 'high',
    match: (s) =>
      /interview/i.test(s) &&
      (/(schedule|invite|call|round|panel|virtual|onsite)/i.test(s) ||
        /technical\s+interview|hr\s+interview|final\s+interview/i.test(s)),
    reason: 'Subject contains interview schedule/invite',
  },
  {
    classification: 'test',
    confidence: 'high',
    match: (s) =>
      /(online\s+test|coding\s+test|assessment|aptitude\s+test|test\s+schedule|test\s+link)/i.test(s),
    reason: 'Subject mentions online test or assessment',
  },
  {
    classification: 'ppt',
    confidence: 'high',
    match: (s) =>
      /pre[\s-]*placement\s*talk|ppt\b/i.test(s) &&
      !/ppt\s*file|\.ppt/i.test(s),
    reason: 'Subject mentions pre-placement talk (PPT)',
  },
  {
    classification: 'withdrawal',
    confidence: 'high',
    match: (s, b) =>
      /withdraw(al|n)?/i.test(s) ||
      /registration.*has been withdrawn|drive.*has been withdrawn|status:\s*withdrawn/i.test(s + ' ' + b),
    reason: 'Email confirms registration withdrawal',
  },
  {
    classification: 'decline',
    confidence: 'high',
    match: (s, b) =>
      /decline(d)?|opt(\s|-)?out/i.test(s + ' ' + b),
    reason: 'Email confirms decline or opt-out',
  },
  {
    classification: 'jd',
    confidence: 'high',
    match: (s) =>
      /(job\s*description|jd\s*(attached|enclosed|herewith|for)|jd\s*-\s*\w)/i.test(s),
    reason: 'Subject mentions job description',
  },
  {
    classification: 'venue_update',
    confidence: 'high',
    match: (s) =>
      /(venue\s*(change|update)|change\s*(of|in)\s*venue|revised\s*schedule|reschedule)/i.test(s),
    reason: 'Subject mentions venue change or reschedule',
  },

  // --- MEDIUM CONFIDENCE ---
  {
    classification: 'registration',
    confidence: 'medium',
    match: (s) =>
      /(register|registration|apply\s+(now|here|for)|application\s+(open|link|form|deadline))/i.test(s),
    reason: 'Subject mentions registration or apply',
  },
  {
    classification: 'registration_confirmation',
    confidence: 'medium',
    match: (s, b) =>
      /(successfully\s+registered|registration\s+confirmed|application\s+received|thank\s+you\s+for\s+(registering|applying))/i.test(s + ' ' + b),
    reason: 'Confirmation language detected',
  },
  {
    classification: 'application_status',
    confidence: 'medium',
    match: (s) =>
      /application\s+status|status\s+update|update\s+on\s+your\s+application/i.test(s),
    reason: 'Subject mentions application status update',
  },
  {
    classification: 'test',
    confidence: 'medium',
    match: (s) =>
      /(hackerrank|hackerearth|codility|mettl|amcat|cocubes)/i.test(s),
    reason: 'Subject mentions a known test platform',
  },
  {
    classification: 'interview',
    confidence: 'medium',
    match: (s, b) =>
      /interview/i.test(s) && !/(schedule|invite|call)/i.test(s),
    reason: 'Subject mentions interview (no schedule keyword)',
  },

  // --- LOW CONFIDENCE CATCHALLS ---
  {
    classification: 'general',
    confidence: 'low',
    match: (s, _b, sender) =>
      /(placement|campus|recruit|career|hiring|drive)/i.test(s) ||
      /(placement|cdc|career|neopat)/i.test(sender),
    reason: 'General placement-related keywords detected',
  },
];

// ============================================
// Classify Email
// ============================================

/**
 * Classifies a parsed email into a placement category using deterministic rules.
 * Rules are evaluated in priority order — first match wins.
 */
export function classifyEmail(email: ParsedEmail): ClassificationResult {
  const subject = email.subject.toLowerCase();
  const body = (email.bodySnippet || email.bodyPlain || '').toLowerCase().slice(0, 500);
  const sender = email.senderEmail.toLowerCase();

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.match(subject, body, sender)) {
      return {
        classification: rule.classification,
        confidence: rule.confidence,
        companyName: extractCompanyName(email.subject, email.senderEmail),
        reason: rule.reason,
      };
    }
  }

  return {
    classification: 'unclassified',
    confidence: 'low',
    companyName: extractCompanyName(email.subject, email.senderEmail),
    reason: 'No classification rule matched',
  };
}

// ============================================
// Company Name Extraction
// ============================================

/**
 * Common suffixes/noise words to strip from company names.
 */
const COMPANY_NOISE_WORDS = [
  'pvt', 'ltd', 'limited', 'private', 'inc', 'corp', 'corporation',
  'co', 'company', 'llc', 'llp', 'solutions', 'services', 'technologies',
  'technology', 'tech', 'group', 'india', 'global', 'international',
  'systems', 'consulting', 'software', 'infotech', 'infosystems',
];

/**
 * Known company aliases to normalize different names to a single canonical name.
 */
const COMPANY_ALIASES: Record<string, string> = {
  'tcs': 'TCS',
  'tata consultancy': 'TCS',
  'tata consultancy services': 'TCS',
  'infosys': 'Infosys',
  'infosys bpm': 'Infosys',
  'wipro': 'Wipro',
  'hcl': 'HCL Technologies',
  'hcl tech': 'HCL Technologies',
  'cognizant': 'Cognizant',
  'accenture': 'Accenture',
  'capgemini': 'Capgemini',
  'deloitte': 'Deloitte',
  'kpmg': 'KPMG',
  'ey': 'EY',
  'ernst & young': 'EY',
  'pwc': 'PwC',
  'pricewaterhousecoopers': 'PwC',
  'google': 'Google',
  'microsoft': 'Microsoft',
  'amazon': 'Amazon',
  'flipkart': 'Flipkart',
  'walmart': 'Walmart',
  'paytm': 'Paytm',
  'zomato': 'Zomato',
  'swiggy': 'Swiggy',
  'razorpay': 'Razorpay',
  'cred': 'CRED',
  'meesho': 'Meesho',
  'phonepe': 'PhonePe',
  'juspay': 'Juspay',
  'oracle': 'Oracle',
  'ibm': 'IBM',
  'samsung': 'Samsung',
  'adobe': 'Adobe',
  'salesforce': 'Salesforce',
  'uber': 'Uber',
  'ola': 'Ola',
  'byju': 'BYJU\'S',
  'byjus': 'BYJU\'S',
  'l&t': 'L&T',
  'larsen': 'L&T',
  'larsen & toubro': 'L&T',
  'mu sigma': 'Mu Sigma',
  'delhivery': 'Delhivery',
  'vedanta': 'Vedanta',
  'reliance': 'Reliance',
  'jio': 'Jio',
  'reliance jio': 'Jio',
  'tech mahindra': 'Tech Mahindra',
  'mindtree': 'LTIMindtree',
  'ltimindtree': 'LTIMindtree',
  'lti': 'LTIMindtree',
  'mufg': 'MUFG',
  'mitsubishi ufj': 'MUFG',
  'mitsubishi ufj financial group': 'MUFG',
  'nielsen': 'NielsenIQ',
  'nielseniq': 'NielsenIQ',
  'fischerjordan': 'FischerJordan',
  'fischer jordan': 'FischerJordan',
  'playsimple': 'PlaySimple Games',
  'playsimple games': 'PlaySimple Games',
  'idfc': 'IDFC First Bank',
  'idfc bank': 'IDFC First Bank',
  'idfc first bank': 'IDFC First Bank',
  'ubs': 'UBS',
  'blackrock': 'BlackRock',
  'pallav': 'Pallav Technologies',
  'pallav tech': 'Pallav Technologies',
  'pallav technologies': 'Pallav Technologies',
  'zs': 'ZS Associates',
  'zs associates': 'ZS Associates',
  'london stock exchange': 'London Stock Exchange Group (LSEG)',
  'honeywell aerospace': 'Honeywell Aerospace',
  'honeywell technology solutions': 'Honeywell Technology Solutions Lab',
  'honeywell technology solutions lab': 'Honeywell Technology Solutions Lab',
  'q2': 'Q2 Software',
  'q2 software': 'Q2 Software',
  'ion': 'ION Group',
  'ion group': 'ION Group',
};

/**
 * Patterns commonly found in placement email subjects that help extract company names.
 * The company name is expected in the first capture group.
 */
const SUBJECT_COMPANY_PATTERNS: RegExp[] = [
  // NeoPAT Eligibility & Registration:
  // "Congratulations! You're Eligible for M/s.Value Labs Placement Drive"
  // "Confirmed: Your Registration for Sabre Placement Drive"
  /(?:congratulations!{1,3}\s*(?:you'?re\s+)?eligible\s+for\s+|confirmed:\s*(?:your\s+registration\s+for\s+)?)(?:m\/s\.?\s*)?([A-Za-z0-9&\s\-\.]+?)\s+placement\s+drive/i,
  // "Congratulations!! Zluri Super Dream Internship Selection List - 2027 Batch"
  // "Congratulations!! Flipkart Super Dream Internship Selection list 2027 Batch"
  /(?:congratulations!{1,3}\s*)(?:for\s+)?([A-Za-z0-9&\s\-\.]+?)\s+(?:super\s+dream|dream|regular|summer)?\s*(?:internship|placement|ppo)?\s*(?:selection\s+list|shortlist)/i,
  // "Important: Date Change for Value Labs Placement Drive"
  // "Important: Date Change for Infosy 2027 batch Placement Drive"
  /date\s+change\s+for\s+(?:m\/s\.?\s*)?([A-Za-z0-9&\s\-\.]+?)(?:\s+(?:2026|2027|2028)\s+batch|\s+placement|\s+drive|$)/i,
  // "Updated Optional Form Available - Value Labs Drive"
  /updated\s+optional\s+form\s+available\s*[-–—]\s*(?:m\/s\.?\s*)?([A-Za-z0-9&\s\-\.]+?)\s+drive/i,
  // "Confirmation: Euler Motors Drive Registration Update"
  /(?:confirmation:\s*)?([A-Za-z0-9&\s\-\.]+?)\s+drive\s+registration\s+update/i,
  // "Zluri Super Dream Internship Selection List..."
  /^([A-Za-z0-9&\s\-\.]+?)\s+(?:super\s+dream|dream|regular)?\s*(?:internship|placement|ppo)?\s*(?:selection\s+list|shortlist)/i,
  // "M/s.Value Labs Placement Drive"
  /(?:m\/s\.?\s*)([A-Za-z0-9&\s\-\.]+?)\s+placement\s+drive/i,
  // "Company Name Placement Drive" / "Company Name Campus Drive"
  /^([A-Za-z0-9&\s\-\.]+?)\s+(?:placement\s+drive|campus\s+drive)\b/i,
  // "Euler Motors - Online test is scheduled on..."
  // "Amazon PPT & online test is scheduled on..."
  // "BluBridge Technologies Pvt. Ltd Physical selection process is scheduled on..."
  // "Wakefit next round of selection process is scheduled on..."
  /^([A-Za-z0-9&\s\-\.]+?)\s*[-–—]?\s*(?:online\s+test|assessment|coding\s+test|physical\s+selection|selection\s+process|next\s+round|ppt)/i,
  // "Company Name Super Dream Internship..."
  /^([A-Za-z0-9&\s\-\.]+?)\s+(?:super\s+dream|dream|regular)\s+(?:internship|placement)/i,
  // "Report Immediately : MUFG PPT"
  /report\s+immediately\s*:\s*([A-Za-z0-9&\s\-\.]+?)\s+(?:ppt|test|drive)/i,
  // "Reminder : ProcDNA Analytics Pvt. Ltd's Next round..."
  /reminder\s*:\s*([A-Za-z0-9&\s\-\.]+?)(?:'s|\s+next\s+round|\s+selection)/i,
  // "Urgent : MUFG (Mitsubishi UFJ Financial Group) : Registration..."
  /^(?:urgent\s*:\s*)?(?:kind\s+attention!!?\s*)?([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s*:\s*(?:registration|ppt|test|interview|shortlist|super\s+dream|dream|regular|placement|hiring|drive)/i,
  // "Urgent : Kind Attention!! MUFG Applied candidates!!"
  /^(?:urgent\s*:\s*)?(?:kind\s+attention!!?\s*)?([A-Za-z0-9&\s\-\.]+?)\s+(?:applied|shortlisted|registered|selected)\s+(?:candidates|students|list)/i,
  // "Fwd: MUFG (Mitsubishi UFJ Financial Group) Pre-placement talk..."
  /^(?:urgent\s*:\s*)?([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s+(?:pre-placement|ppt|online\s+test|coding\s+test|interview|placement\s+drive)/i,
  // "Campus Placement | Company Name | Role"
  /(?:campus\s+)?placement\s*(?:\||[-–—]|:)\s*([A-Za-z0-9&\s\-\.]+?)(?:\s*(?:\||[-–—]|:)\s*.+)?$/i,
  // "Registration: Company Name"
  /(?:registration|register)\s*(?:\||[-–—]|:|\s+for)\s*([A-Za-z0-9&\s\-\.]+?)(?:\s*(?:\||[-–—])\s*.+)?$/i,
];

/**
 * Common prefixes in email subjects that obscure company names.
 */
const SUBJECT_PREFIXES = [
  /^(?:fwd|re|fw)\s*:\s*/i,
  /^urgent\s*:\s*/i,
  /^kind\s+attention!!?\s*/i,
  /^confirmed\s*:\s*(?:your\s+registration\s+for\s+)?/i,
  /^confirmation\s*:\s*/i,
  /^congratulations!{1,3}\s*(?:you'?re\s+)?(?:eligible\s+for\s+)?/i,
  /^important\s*:\s*date\s+change\s+for\s+/i,
  /^updated\s+optional\s+form\s+available\s*[-–—]\s*/i,
  /^venue\s+update\s*:\s*/i,
  /^registration\s*:\s*/i,
  /^reminder\s*:\s*/i,
  /^report\s+immediately\s*:\s*/i,
  /^shortlist\s+(?:for|of)?\s*/i,
];

/**
 * Common suffixes to strip from company names.
 */
const SUBJECT_SUFFIXES = [
  /\s+(?:super\s+dream|dream|regular)\s+(?:internship|placement|drive).*$/i,
  /\s+placement\s+drive.*$/i,
  /\s+campus\s+drive.*$/i,
  /\s+2027\s+batch.*$/i,
  /\s+2026\s+batch.*$/i,
  /\s+pre[\s-]*placement.*$/i,
  /\s+applied\s+candidates.*$/i,
  /\s+shortlist.*$/i,
];

/**
 * Words that are never company names.
 */
const NON_COMPANY_WORDS = [
  'email', 'match', 'hr', 'github', 'linkedin', 'supabase', 'vitstudent',
  'accountprotection', 'mycareernet', 'takeuforward', 'codeforces',
  '10 new tools for', 'complete before 05', 'super dream internship',
  'portal', 'cdc portal', 'vit cdc portal', 'vit', 'your vit cdc portal',
  'soft skill assessments', 'soft skills', 'cdc info', 'placement office',
  'congratulations', 'invitation', 'registration update', 'optional form',
  'complete today', 'complete', 'practice test', 'practice assessment',
  'mock test', 'top coders', 'nerd season', 'codeathon', 'course',
  'learning contents', 'reminder',
];

/**
 * Extracts and normalizes a company name from the email subject.
 */
export function extractCompanyName(
  subject: string,
  _senderEmail: string
): string | null {
  // 1. Ignore generic coursework, practice tests, mock tests, codeathons, portal invites
  if (
    /you\s+are\s+invited|invited\s+to\s+join|assessment\s+portal|mock\s+test|practice\s+(?:test|assessment)|codeathon|nerd\s+season|learning\s+contents|you\s+have\s+been\s+enrolled|complete\s+today/i.test(
      subject
    ) &&
    !/placement\s+drive|super\s+dream|dream\s+core|regular\s+internship/i.test(subject)
  ) {
    return null;
  }

  // First clean the subject to remove prefixes like "Confirmed: Your Registration for"
  const cleanedSubject = cleanSubjectNoise(subject);

  // Try subject patterns
  for (const pattern of SUBJECT_COMPANY_PATTERNS) {
    const match = cleanedSubject.match(pattern);
    if (match && match[1]) {
      const cleaned = cleanCompanyName(match[1]);
      if (
        cleaned &&
        cleaned.length >= 2 &&
        cleaned.length < 50 &&
        !NON_COMPANY_WORDS.includes(cleaned.toLowerCase()) &&
        !/^(?:portal|webinar|survey|assessment|feedback|cdc|vit|profile|course|day\s+\d+|session|prelims|passout\s+batch|complete|reminder)/i.test(
          cleaned
        )
      ) {
        return normalizeCompanyName(cleaned);
      }
    }
  }

  return null;
}

/**
 * Strips noise prefixes from subject line.
 */
function cleanSubjectNoise(subject: string): string {
  let str = subject.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of SUBJECT_PREFIXES) {
      if (p.test(str)) {
        str = str.replace(p, '').trim();
        changed = true;
      }
    }
  }
  return str;
}

/**
 * Cleans a raw company name by removing noise words, prefixes, and suffixes.
 */
export function cleanCompanyName(name: string): string {
  let str = cleanSubjectNoise(name);

  // Strip trailing suffixes
  for (const s of SUBJECT_SUFFIXES) {
    str = str.replace(s, '').trim();
  }

  // Remove content in parentheses e.g. "(Mitsubishi UFJ Financial Group)"
  str = str.replace(/\(.*?\)/g, '').trim();

  // Remove trailing noise legal words
  const words = str.split(/\s+/);
  const filteredWords = words.filter(
    (w) => !COMPANY_NOISE_WORDS.includes(w.toLowerCase().replace(/[.,]/g, ''))
  );
  str = filteredWords.join(' ').trim();

  // Remove leading/trailing punctuation
  str = str.replace(/^[:\-\s\|,.\/]+|[:\-\s\|,.\/]+$/g, '').trim();

  return str;
}

/**
 * Normalizes a company name using the known aliases map.
 */
export function normalizeCompanyName(name: string): string {
  const lower = name.toLowerCase().trim();

  // Check exact alias match
  if (COMPANY_ALIASES[lower]) {
    return COMPANY_ALIASES[lower];
  }

  // Check if any alias key is contained in the name
  for (const [alias, canonical] of Object.entries(COMPANY_ALIASES)) {
    if (lower.includes(alias)) {
      return canonical;
    }
  }

  // Title-case the name if no alias found
  return name
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 2 && word === word.toUpperCase()) return word; // Keep abbreviations
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
