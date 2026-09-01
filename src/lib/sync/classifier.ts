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
  // --- NON-PLACEMENT / PROMOTIONAL SENDER FILTER ---
  {
    classification: 'irrelevant',
    confidence: 'high',
    match: (s, b, sender) =>
      /bookmyshow|pinterest|manutd|netflix|spotify|quora|chess\.com|myntra|plumgoodness|truecaller|dribbble|rockstargames|ifttt|openrouter|emergent\.sh|resumeworded|insideapple|mygate|newsgram\.hp|digital\.metamail|cron-job|vercel|onlinegdb/i.test(
        sender
      ) ||
      (/bookmyshow/i.test(s + ' ' + b) && !/placement|vitbhopal|cdc/i.test(sender)),
    reason: 'Non-placement marketing, entertainment, or personal newsletter sender',
  },

  // --- HIGH CONFIDENCE ---
  {
    classification: 'shortlist',
    confidence: 'high',
    match: (s, b) =>
      (/shortlist(ed)?/i.test(s) &&
        !/not\s+shortlist/i.test(s) &&
        !/un-?shortlist/i.test(s)) ||
      /(?:find\s+the\s+below\s+shortlist|below\s+is\s+the\s+shortlist|find\s+the\s+shortlist|shortlisted\s+candidates|shortlist\s+for\s+next\s+round)/i.test(b) ||
      /next\s+round\s+of\s+selection/i.test(s),
    reason: 'Email announces candidate shortlist or next round selection',
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
    match: (s, b) =>
      (/interview/i.test(s) &&
        (/(schedule|invite|call|round|panel|virtual|onsite)/i.test(s) ||
          /technical\s+interview|hr\s+interview|final\s+interview/i.test(s))) ||
      /selection\s+process\s+is\s+scheduled|next\s+round\s+of\s+selection\s+process/i.test(s),
    reason: 'Subject contains interview or selection process schedule',
  },
  {
    classification: 'test',
    confidence: 'high',
    match: (s) =>
      /(online\s+test|coding\s+test|online\s+assessment|aptitude\s+test|test\s+schedule|test\s+link|assessment\s+(?:test|link|scheduled|window))/i.test(s),
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
      /(venue\s*(change|update)|change\s*(of|in)\s*venue|revised\s*schedule|reschedule|date\s+change)/i.test(s),
    reason: 'Subject mentions venue change or reschedule',
  },

  // --- MEDIUM CONFIDENCE ---
  {
    classification: 'registration_confirmation',
    confidence: 'high',
    match: (s, b) =>
      /(successfully\s+registered|registration\s+confirmed|application\s+received|thank\s+you\s+for\s+(registering|applying)|confirmed:\s*(?:your\s+registration|.*placement\s+drive)|confirmation:\s*.*drive\s+registration)/i.test(s + ' ' + b),
    reason: 'Confirmation language detected',
  },
  {
    classification: 'registration',
    confidence: 'high',
    match: (s) =>
      /(?:eligible\s+for|eligibility\s+for|placement\s+drive|campus\s+drive|optional\s+form|drive\s+information|drive\s+registration|drive\s+update)/i.test(
        s
      ) &&
      !/course|assessment\s+course|mock\s+test|learning\s+contents|practice\s+assessment|nerd\s+season|codeathon/i.test(
        s
      ),
    reason: 'Subject announces placement drive eligibility, update, or registration',
  },
  {
    classification: 'registration',
    confidence: 'medium',
    match: (s) =>
      /(register|registration|apply\s+(now|here|for)|application\s+(open|link|form|deadline))/i.test(s),
    reason: 'Subject mentions registration or apply',
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
  const body = (email.bodySnippet || email.bodyPlain || '').toLowerCase().slice(0, 1000);
  const sender = email.senderEmail.toLowerCase();

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.match(subject, body, sender)) {
      return {
        classification: rule.classification,
        confidence: rule.confidence,
        companyName: extractCompanyName(
          email.subject,
          email.senderEmail,
          email.bodySnippet || email.bodyPlain,
          email.receivedAt
        ),
        reason: rule.reason,
      };
    }
  }

  return {
    classification: 'unclassified',
    confidence: 'low',
    companyName: extractCompanyName(
      email.subject,
      email.senderEmail,
      email.bodySnippet || email.bodyPlain,
      email.receivedAt
    ),
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
export const COMPANY_ALIASES: Record<string, string> = {
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
  'ey sap': 'EY SAP',
  'ey-sap': 'EY SAP',
  'ey gds': 'EY GDS',
  'ey global delivery services': 'EY GDS',
  'ey-gds': 'EY GDS',
  'ey': 'EY GDS',
  'ernst & young': 'EY GDS',
  'ey (ernst & young)': 'EY GDS',
  'pwc': 'PwC',
  'pricewaterhousecoopers': 'PwC',
  'apple sdet': 'Apple SDET',
  'apple-sdet': 'Apple SDET',
  'apple sre': 'Apple SRE',
  'apple-sre': 'Apple SRE',
  'apple': 'Apple SDET',
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
  'mitsubishi': 'MUFG',
  'epsilon': 'Epsilon',
  'zluri': 'Zluri',
  'nielsen': 'NielsenIQ',
  'nielseniq': 'NielsenIQ',
  'fischerjordan': 'FischerJordan',
  'fischer jordan': 'FischerJordan',
  'playsimple': 'PlaySimple Games',
  'playsimple games': 'PlaySimple Games',
  'play simple games': 'PlaySimple Games',
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
  'valuelabs': 'Value Labs',
  'value labs': 'Value Labs',
  'cummins': 'Cummins',
  'cummins india': 'Cummins',
  'tekion': 'Tekion',
  'tekion india': 'Tekion',
  'pocket fm': 'Pocket FM',
  'pocketfm': 'Pocket FM',
  'prodapt': 'Prodapt',
  'intel': 'Intel',
  'intel india': 'Intel',
  'toshiba': 'Toshiba',
  'lseg': 'London Stock Exchange Group (LSEG)',
  'ion': 'ION Group',
  'ion group': 'ION Group',
  'eulermotors': 'Euler Motors',
  'wakefit': 'Wakefit',
  'procdna': 'ProcDNA',
  'blubridge': 'BluBridge Technologies',
  'infosy': 'Infosys',
  'infosy 2027 batch': 'Infosys',
  'tredence': 'Tredence Analytics',
  'tredence super dream': 'Tredence Analytics',
  'tredence analytics': 'Tredence Analytics',
  'unilever industries': 'Unilever',
  'unilever': 'Unilever',
  'societe generale global solution centre': 'Societe Generale',
  'societe generale': 'Societe Generale',
  'sandisk device design centre': 'SanDisk',
  'sandisk': 'SanDisk',
  'american express': 'American Express',
  'amex': 'American Express',
  'chubb': 'Chubb',
  'colgate': 'Colgate-Palmolive',
  'colgate-palmolive': 'Colgate-Palmolive',
  'colgate palmolive': 'Colgate-Palmolive',
  'exxonmobil': 'ExxonMobil',
  'exxon mobil': 'ExxonMobil',
  'exxon': 'ExxonMobil',
  'foodhub': 'Foodhub',
  'fractal': 'Fractal Analytics',
  'fractal analytics': 'Fractal Analytics',
  'palo alto': 'Palo Alto Networks',
  'palo alto networks': 'Palo Alto Networks',
  'spense': 'Spense',
  'unthinkable': 'Unthinkable Solutions',
  'unthinkable solutions': 'Unthinkable Solutions',
  'veeva': 'Veeva Systems',
  'veeva systems': 'Veeva Systems',
  'whirlpool': 'Whirlpool',
  'zensar': 'Zensar',
  'zensar technologies': 'Zensar',
  'honeywell': 'Honeywell',
};

/**
 * Patterns commonly found in placement email subjects that help extract company names.
 * The company name is expected in the first capture group.
 */
const SUBJECT_COMPANY_PATTERNS: RegExp[] = [
  // NeoPAT Eligibility & Registration:
  // "Congratulations! You're Eligible for M/s.Value Labs Placement Drive"
  // "Confirmed: Your Registration for Sabre Placement Drive"
  /(?:congratulations!{1,3}\s*(?:you'?re\s+)?eligible\s+for\s+|confirmed:\s*(?:your\s+registration\s+for\s+)?)(?:m\/s\.?\s*)?([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s+placement\s+drive/i,
  // "Congratulations!! Zluri Super Dream Internship Selection List - 2027 Batch"
  // "Congratulations!! Flipkart Super Dream Internship Selection list 2027 Batch"
  /(?:congratulations!{1,3}\s*)(?:for\s+)?([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s+(?:super\s+dream|dream|regular|summer)?\s*(?:internship|placement|ppo)?\s*(?:selection\s+list|shortlist)/i,
  // "Important: Date Change for Value Labs Placement Drive"
  // "Important: Date Change for Infosy 2027 batch Placement Drive"
  // "Important : Date change : Sandisk Device Design Centre Placement Drive"
  /(?:important|urgent)\s*:\s*date\s+change\s*(?:for|:)\s*(?:m\/s\.?\s*)?([A-Za-z0-9&\s\-\.]+?)(?:\s+(?:2026|2027|2028)\s+batch|\s+placement|\s+drive|$)/i,
  // "Updated Optional Form Available - Value Labs Drive"
  // "Optional Form Available - Epsilon Drive"
  /(?:updated\s+)?optional\s+form\s+(?:available\s*)?[-–—:]\s*(?:m\/s\.?\s*)?([A-Za-z0-9&\s\-\.]+?)\s+drive/i,
  // "Confirmation: Euler Motors Drive Registration Update"
  // "Euler Motors Drive Registration Update"
  /(?:confirmation:\s*)?([A-Za-z0-9&\s\-\.]+?)\s+drive\s+registration\s*(?:update|$)/i,
  // "Company Name - Drive Registration"
  /^([A-Za-z0-9&\s\-\.]+?)\s*[-–—]\s*drive\s+registration/i,
  // "Zluri Super Dream Internship Selection List..."
  /^([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s+(?:super\s+dream|dream|regular)?\s*(?:internship|placement|ppo)?\s*(?:selection\s+list|shortlist)/i,
  // "M/s.Value Labs Placement Drive"
  /(?:m\/s\.?\s*)([A-Za-z0-9&\s\-\.]+?)\s+placement\s+drive/i,
  // "Company Name Placement Drive" / "Company Name Campus Drive"
  /^([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s+(?:placement\s+drive|campus\s+drive)\b/i,
  // "MUFG (Mitsubishi UFJ Financial Group) next round of selection process is scheduled on..."
  // "Euler Motors - Online test is scheduled on..."
  // "Amazon PPT & online test is scheduled on..."
  // "BluBridge Technologies Pvt. Ltd Physical selection process is scheduled on..."
  // "Wakefit next round of selection process is scheduled on..."
  /^([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s*[-–—]?\s*(?:online\s+test|assessment|coding\s+test|physical\s+selection|selection\s+process|next\s+round|ppt|interview|selection\s+list)/i,
  // "Company Name Super Dream Internship..."
  /^([A-Za-z0-9&\s\-\.]+?)\s+(?:super\s+dream|dream|regular)\s+(?:internship|placement)/i,
  // "Report Immediately : MUFG PPT"
  /report\s+immediately\s*:\s*([A-Za-z0-9&\s\-\.]+?)\s+(?:ppt|test|drive)/i,
  // "Reminder : ProcDNA Analytics Pvt. Ltd's Next round..."
  /reminder\s*:\s*([A-Za-z0-9&\s\-\.]+?)(?:'s|\s+next\s+round|\s+selection)/i,
  // "Urgent : MUFG (Mitsubishi UFJ Financial Group) : Registration..."
  /^(?:urgent\s*:\s*)?(?:kind\s+attention!!?\s*)?([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s*:\s*(?:registration|ppt|test|interview|shortlist|super\s+dream|dream|regular|placement|hiring|drive)/i,
  // "Urgent : Kind Attention!! MUFG Applied candidates!!"
  /^(?:urgent\s*:\s*)?(?:kind\s+attention!!?\s*)?([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s+(?:applied|shortlisted|registered|selected)\s+(?:candidates|students|list)/i,
  // "Fwd: MUFG (Mitsubishi UFJ Financial Group) Pre-placement talk..."
  /^(?:urgent\s*:\s*)?([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s+(?:pre-placement|ppt|online\s+test|coding\s+test|interview|placement\s+drive|next\s+round)/i,
  // "Campus Placement | Company Name | Role"
  /(?:campus\s+)?placement\s*(?:\||[-–—]|:)\s*([A-Za-z0-9&\s\-\.]+?)(?:\s*(?:\||[-–—]|:)\s*.+)?$/i,
  // "Registration: Company Name"
  /(?:registration|register)\s*(?:\||[-–—]|:|\s+for)\s*([A-Za-z0-9&\s\-\.]+?)(?:\s*(?:\||[-–—])\s*.+)?$/i,
  // "Eligible for Company Name"
  /(?:eligible|eligibility)\s*(?:for|:)\s*(?:m\/s\.?\s*)?([A-Za-z0-9&\s\-\.]+?)(?:\s+placement|\s+drive|$)/i,
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
 * Words and role titles that are never company names.
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
  'learning contents', 'reminder', 'q2', 'q2 software', '2027 batch', '2026 batch', 'batch',
  // Role titles / profiles that are never company names
  'ps associate software engineer', 'associate software engineer', 'ps associate engineer',
  'associate engineer', 'software engineer', 'software development engineer',
  'data scientist', 'data analyst', 'business analyst', 'graduate engineer trainee',
  'graduate trainee', 'system engineer', 'technical consultant', 'consultant',
  'full stack developer', 'backend developer', 'frontend developer', 'intern', 'internship',
];

/**
 * Extracts and normalizes a company name from the email subject.
 */
export function extractCompanyName(
  subject: string,
  _senderEmail: string,
  bodySnippet?: string,
  receivedAt?: Date | string
): string | null {
  // 0. Immediately reject non-placement / marketing / personal senders
  if (
    /bookmyshow|pinterest|manutd|netflix|spotify|quora|chess\.com|myntra|plumgoodness|truecaller|dribbble|rockstargames|ifttt|openrouter|emergent\.sh|resumeworded|insideapple|mygate|newsgram\.hp|digital\.metamail|cron-job|vercel|onlinegdb/i.test(
      _senderEmail || ''
    ) ||
    (/bookmyshow/i.test(subject + ' ' + (bodySnippet || '')) && !/placement|vitbhopal|cdc/i.test(_senderEmail || ''))
  ) {
    return null;
  }

  // 1. Ignore generic coursework, practice tests, mock tests, codeathons, portal invites
  if (
    /you\s+are\s+invited|invited\s+to\s+join|assessment\s+portal|mock\s+test|practice\s+(?:test|assessment)|codeathon|nerd\s+season|learning\s+contents|you\s+have\s+been\s+enrolled|complete\s+today/i.test(
      subject
    ) &&
    !/placement\s+drive|super\s+dream|dream\s+core|regular\s+internship/i.test(subject)
  ) {
    return null;
  }

  // Clean the subject to remove prefixes like "Confirmed: Your Registration for"
  const cleanedSubject = cleanSubjectNoise(subject);
  const lowerCleaned = cleanedSubject.toLowerCase();
  const lowerBody = (bodySnippet || '').toLowerCase();

  // Disambiguate EY SAP vs EY GDS
  const isEyEmail =
    /\b(?:ey|ernst\s*&\s*young|ernst\s+and\s+young)\b/i.test(lowerCleaned) ||
    /\b(?:ey\s+sap|ey\s+gds|ey\s*\(ernst\s*&\s*young\))\b/i.test(lowerBody);

  if (isEyEmail) {
    if (lowerCleaned.includes('sap') || lowerBody.includes('ey sap')) {
      return 'EY SAP';
    }
    if (lowerCleaned.includes('gds') || lowerBody.includes('ey gds') || lowerBody.includes('global delivery')) {
      return 'EY GDS';
    }
    // Date-based disambiguation for identical NeoPAT email subjects:
    // Aug 14-16, 2026 was the EY SAP drive
    // Aug 20+ 2026 was the EY GDS drive
    if (receivedAt) {
      const d = new Date(receivedAt);
      if (d < new Date('2026-08-18T00:00:00Z')) {
        return 'EY SAP';
      } else {
        return 'EY GDS';
      }
    }
    return 'EY GDS';
  }

  // Disambiguate Honeywell Aerospace vs Honeywell Technology Solutions Lab
  if (lowerCleaned.includes('honeywell')) {
    if (lowerCleaned.includes('aerospace') || lowerBody.includes('aerospace') || lowerBody.includes('1190')) {
      return 'Honeywell Aerospace';
    }
    if (
      lowerCleaned.includes('technology solutions') ||
      lowerCleaned.includes('tsl') ||
      lowerBody.includes('technology solutions') ||
      lowerBody.includes('1135')
    ) {
      return 'Honeywell Technology Solutions Lab';
    }
  }

  // Disambiguate Apple SDET vs Apple SRE
  // Must be an actual placement email about Apple (not just an app store link or marketing newsletter)
  const isApplePlacementSubject = /\bapple\b/i.test(lowerCleaned) && !/insideapple|apple\s+store|app\s+store/i.test(lowerCleaned);
  const isApplePlacementBody =
    /\bapple\b/i.test(lowerBody) &&
    /\b(?:super\s+dream|placement|internship|hiring|shortlist|sdet|sre|cdc|vitbhopal|neopat|coderpad)\b/i.test(lowerBody) &&
    !/bookmyshow|pinterest|insideapple|apple\s+store|app\s+store/i.test(_senderEmail || '');

  if (isApplePlacementSubject || isApplePlacementBody) {
    if (lowerCleaned.includes('sdet') || lowerBody.includes('sdet') || lowerBody.includes('lc102') || lowerBody.includes('lc 102')) {
      return 'Apple SDET';
    }
    if (lowerCleaned.includes('sre') || lowerBody.includes('sre') || lowerBody.includes('new role') || lowerBody.includes('lc101') || lowerBody.includes('lc 101')) {
      return 'Apple SRE';
    }
    // Date-based disambiguation for identical NeoPAT registration & eligibility emails:
    // Aug 21-23, 2026 was the Apple SDET drive
    // Aug 24+ 2026 was the Apple SRE drive (announced on Aug 24 as "New Role")
    if (receivedAt) {
      const d = new Date(receivedAt);
      if (d < new Date('2026-08-24T00:00:00Z')) {
        return 'Apple SDET';
      } else {
        return 'Apple SRE';
      }
    }
    return 'Apple SDET';
  }

  const sortedAliases = Object.keys(COMPANY_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    const canonical = COMPANY_ALIASES[alias];
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i');
    if (regex.test(lowerCleaned)) {
      return canonical;
    }
  }

  // Try regex subject patterns
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
        ) &&
        !/^(?:ps\s+)?(?:associate\s+)?(?:software\s+)?(?:engineer|developer|analyst|scientist|trainee|consultant|specialist)$/i.test(
          cleaned
        ) &&
        !/(?:software\s+engineer|associate\s+engineer|data\s+scientist|data\s+analyst|graduate\s+trainee)/i.test(
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

  // Check if any alias key is contained in the name (longest key first)
  const sortedAliases = Object.keys(COMPANY_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    const canonical = COMPANY_ALIASES[alias];
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i');
    if (regex.test(lower)) {
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
