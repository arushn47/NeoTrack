import type { ParsedEmail } from '@/lib/gmail/client';
import { extractDriveNumber } from '@/lib/sync/events';

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
  | 'unclassified_placement_notice'
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
  {
    classification: 'general',
    confidence: 'high',
    match: (s) => /new learning contents?|practice.*tests?\s+added/i.test(s),
    reason: 'Generic LMS / NeoPAT practice course update (non-placement drive)',
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
      /(online\s+test|coding\s+test|online\s+assessment|aptitude\s+test|test\s+schedule|test\s+link|assessment\s+(?:test|link|scheduled|window)|thanks\s+for\s+taking\s+(?:the\s+)?assessment)/i.test(s),
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
    match: (s, b) => {
      const full = s + ' ' + b;
      if (
        /who\s+(?:wish|want)\s+to\s+opt|if\s+you\s+(?:wish|want)\s+to\s+opt|opt[\s-]*out\s+(?:form|link|google|portal)|voluntary\s+withdrawal\s+only|forms\.gle/i.test(
          full
        )
      ) {
        return false;
      }
      return (
        /registration.*has been withdrawn|drive.*has been withdrawn|status:\s*withdrawn/i.test(full) ||
        (/confirmation.*drive\s+registration\s+update/i.test(s) && /withdrawn/i.test(full)) ||
        /your\s+registration\s+for\s+the\s+following\s+placement\s+drive\s+has\s+been\s+withdrawn/i.test(full)
      );
    },
    reason: 'Email confirms registration withdrawal',
  },
  {
    classification: 'decline',
    confidence: 'high',
    match: (s, b) => {
      const full = s + ' ' + b;
      if (
        /who\s+(?:wish|want)\s+to\s+opt|if\s+you\s+(?:wish|want)\s+to\s+opt|opt[\s-]*out\s+(?:form|link|google|portal)|voluntary\s+withdrawal\s+only|forms\.gle/i.test(
          full
        )
      ) {
        return false;
      }
      return (
        /confirmation.*drive\s+registration\s+update.*withdrawn/i.test(full) ||
        /your\s+registration\s+for\s+the\s+following\s+placement\s+drive\s+has\s+been\s+withdrawn/i.test(full) ||
        /you\s+have\s+(?:successfully\s+)?(?:declined|opted\s*out)/i.test(full) ||
        /declined\s+(?:the\s+)?(?:placement\s+)?drive/i.test(full) ||
        /status:\s*(?:declined|opted\s*out|withdrawn)/i.test(full)
      );
    },
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

  // --- COHORT / PROGRAM ANNOUNCEMENTS (before general catchall) ---
  // Subjects like: "Capgemini Exceller 2027: Introducing Our Cohorts & Career Opportunities"
  //                "TCS NQT 2027: Registration Open" / "Infosys Springboard Hiring"
  // These are always placement-relevant registrations, never 'general' junk.
  {
    classification: 'registration',
    confidence: 'high',
    match: (s) =>
      /^[A-Za-z0-9\s&]+?\s+(?:exceller|nqt|springboard|ignite|codevita|hackwithinfy|genc|genplorer|launchpad|catalyst)\b/i.test(s) ||
      /(?:exceller|nqt|springboard|ignite|codevita|hackwithinfy|genc|genplorer|launchpad|catalyst)\s+\d{4}/i.test(s),
    reason: 'Known campus program/cohort name detected in subject (Capgemini Exceller, TCS NQT, Infosys Springboard, etc.)',
  },
  {
    classification: 'registration',
    confidence: 'medium',
    match: (s, b, sender) =>
      /vitlions2027|vitbhopal|vitstudent|cdc|placementoffice/i.test(sender) &&
      /(?:introducing\s+(?:our\s+)?cohorts|flagship\s+hiring|campus\s+hiring\s+season|apply\s+in\s+the\s+neo\s*pat|career\s+opportunities|cohort.*career|campus\s+recruitment)/i.test(b),
    reason: 'Trusted CDC sender + cohort/flagship program announcement in body',
  },

  // --- TRUSTED CDC UNCLASSIFIED NOTICES ---
  // Emails from official placement offices or student placement mailing lists that did not match
  // a specific round rule (e.g. general circulars, cohort announcements, student briefings).
  // These are NEVER discarded as irrelevant; they remain visible as placement notices.
  {
    classification: 'unclassified_placement_notice',
    confidence: 'medium',
    match: (_s, _b, sender) =>
      /vitlions2027|vitbhopal|vitstudent|cdc|placementoffice|noreply\.cdc/i.test(sender),
    reason: 'Email from trusted placement office/cell with general circular content',
  },

  // --- LOW CONFIDENCE CATCHALLS (Non-trusted senders) ---
  {
    classification: 'general',
    confidence: 'low',
    match: (s, _b, _sender) =>
      /(placement|campus|recruit|career|hiring|drive)/i.test(s),
    reason: 'General placement-related keywords from non-trusted sender',
  },
];

// ============================================
// Classify Email
// ============================================

/**
 * Classifies a parsed email into a placement category using deterministic rules.
 * Rules are evaluated in priority order — first match wins.
 */
export function classifyEmail(
  email: ParsedEmail,
  knownDriveResolutions?: Map<string, string>
): ClassificationResult {
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
          email.receivedAt,
          knownDriveResolutions
        ),
        reason: rule.reason,
      };
    }
  }

  const isTrustedSender = /vitlions2027|vitbhopal|vitstudent|cdc|placementoffice|noreply\.cdc/i.test(sender);
  return {
    classification: isTrustedSender ? 'unclassified_placement_notice' : 'unclassified',
    confidence: isTrustedSender ? 'medium' : 'low',
    companyName: extractCompanyName(
      email.subject,
      email.senderEmail,
      email.bodySnippet || email.bodyPlain,
      email.receivedAt
    ),
    reason: isTrustedSender
      ? 'Trusted placement sender with unclassified content'
      : 'No classification rule matched',
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
  'infosys bpm': 'Infosys',
  'hcl': 'HCL Technologies',
  'hcl tech': 'HCL Technologies',
  'kpmg': 'KPMG',
  'ey sap': 'EY SAP',
  'ey-sap': 'EY SAP',
  'ey gds': 'EY GDS',
  'ey global delivery services': 'EY GDS',
  'ey-gds': 'EY GDS',
  'ernst & young': 'EY GDS',
  'ey (ernst & young)': 'EY GDS',
  'pwc': 'PwC',
  'pricewaterhousecoopers': 'PwC',
  'apple sdet': 'Apple SDET',
  'apple-sdet': 'Apple SDET',
  'apple sre': 'Apple SRE',
  'apple-sre': 'Apple SRE',
  'eternal': 'Zomato',
  'eternal (zomato)': 'Zomato',
  'eternal zomato': 'Zomato',
  'valuelabs llp': 'Value Labs',
  'value labs llp': 'Value Labs',
  'zluri sdet': 'Zluri SDET',
  'cred': 'CRED',
  'phonepe': 'PhonePe',
  'ibm': 'IBM',
  'byju': 'BYJU\'S',
  'byjus': 'BYJU\'S',
  'l&t': 'L&T',
  'larsen': 'L&T',
  'larsen & toubro': 'L&T',
  'reliance jio': 'Jio',
  'mindtree': 'LTIMindtree',
  'ltimindtree': 'LTIMindtree',
  'lti': 'LTIMindtree',
  'mufg': 'MUFG',
  'mitsubishi ufj': 'MUFG',
  'mitsubishi ufj financial group': 'MUFG',
  'mitsubishi': 'MUFG',
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
  'zs': 'ZS Associates',
  'zs associates': 'ZS Associates',
  'london stock exchange': 'London Stock Exchange Group (LSEG)',
  'honeywell': 'Honeywell Technologies',
  'honeywell technologies': 'Honeywell Technologies',
  'honeywell aerospace': 'Honeywell Aerospace',
  'honeywell technology solutions': 'Honeywell Technology Solutions Lab',
  'honeywell technology solutions lab': 'Honeywell Technology Solutions Lab',
  'valuelabs': 'Value Labs',
  'cummins india': 'Cummins',
  'tekion india': 'Tekion',
  'pocket fm': 'Pocket FM',
  'pocketfm': 'Pocket FM',
  'intel india': 'Intel',
  'lseg': 'London Stock Exchange Group (LSEG)',
  'ion': 'ION Group',
  'ion group': 'ION Group',
  'eulermotors': 'Euler Motors',
  'procdna': 'ProcDNA',
  'blubridge': 'BluBridge Technologies',
  'infosy': 'Infosys',
  'infosy 2027 batch': 'Infosys',
  'tredence': 'Tredence Analytics',
  'tredence super dream': 'Tredence Analytics',
  'unilever industries': 'Unilever',
  'societe generale global solution centre': 'Societe Generale',
  'sandisk device design centre': 'SanDisk',
  'sandisk': 'SanDisk',
  'amex': 'American Express',
  'superjoin': 'Superjoin Finance',
  'ethos': 'Ethos Technologies',
  'ethos life': 'Ethos Technologies',
  'futuresfirst': 'Futures First',
  'jpmorgan': 'JPMorgan Chase',
  'jpmorganchase': 'JPMorgan Chase',
  'jpmorgan chase': 'JPMorgan Chase',
  'jpmc': 'JPMorgan Chase',
  'colgate': 'Colgate-Palmolive',
  'colgate-palmolive': 'Colgate-Palmolive',
  'colgate palmolive': 'Colgate-Palmolive',
  'exxonmobil': 'ExxonMobil',
  'exxon mobil': 'ExxonMobil',
  'exxon': 'ExxonMobil',
  'fractal': 'Fractal Analytics',
  'palo alto': 'Palo Alto Networks',
  'unthinkable': 'Unthinkable Solutions',
  'unthikable': 'Unthinkable Solutions',
  'veeva': 'Veeva Systems',
  'winwire technologies': 'Winwire',
  'workindia': 'WorkIndia',
  'work india': 'WorkIndia',
  'bottomline technologies': 'Bottomline',
  'zensar technologies': 'Zensar',
  'tresvista financial': 'Tresvista',
  'tresvista financial services': 'Tresvista',
  'rfpio': 'Responsive',
  'rfpio india': 'Responsive',
  'rfpio india pvt ltd': 'Responsive',
  'rfp software': 'Responsive',
  'responsive (rfp software)': 'Responsive',
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
  // "Goldman sachs application registration link & test link"
  /^([A-Za-z0-9&\s\-\.]+?)\s*(?:\([^)]+\))?\s*[-–—]?\s*(?:online\s+test|assessment|coding\s+test|physical\s+selection|selection\s+process|next\s+round|ppt|interview|selection\s+list|application\s+registration|test\s+link|registration\s+link)/i,
  // "Thanks for taking the Assessment Goldman Sachs UG Summer Internship 2027 - Pooled STEM"
  /(?:thanks\s+for\s+taking\s+(?:the\s+)?assessment|assessment\s+completed)\s+([A-Za-z0-9&\s\-\.]+?)\s+(?:ug|summer|internship|placement|drive|pooled)/i,
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
  /^(?:extended\s+deadline|extension\s+of\s+deadline|deadline\s+extended)\s*(?:[-:]\s*)?/i,
  /^(?:updated|update|revised|revision)\s*(?:regarding|on|for)?\s*(?:[-:]\s*)?/i,
  /^(?:urgent|immediately|immediate|important|critical)\s*(?:[-:]\s*)?/i,
  /^(?:kind\s+attention!!?|attention!!?)\s*(?:[-:]\s*)?/i,
  /^confirmed\s*:\s*(?:your\s+registration\s+for\s+)?/i,
  /^confirmation\s*:\s*/i,
  /^congratulations!{1,3}\s*(?:you'?re\s+)?(?:eligible\s+for\s+)?/i,
  /^(?:important|urgent|update|reminder)?\s*[-:]?\s*date\s+change\s+(?:for|:)\s*/i,
  /^(?:date\s+change|rescheduled|schedule\s+change|time\s+change|venue\s+change)\s*(?:for|:)\s*/i,
  /^(?:placement\s+drive\s+date\s+update|drive\s+date\s+update)\s*(?:[-:]\s*)?/i,
  /^updated\s+optional\s+form\s+available\s*(?:[-–—:]\s*)?/i,
  /^venue\s+update\s*:\s*/i,
  /^registration\s*(?:for)?\s*(?:[-:]\s*)?/i,
  /^reminder\s*:\s*/i,
  /^report\s+immediately\s*:\s*/i,
  /^shortlist(?:ed)?\s+(?:candidates|students)?\s*(?:for|of)?\s*(?:[-:]\s*)?/i,
  /^selection\s+(?:list|process)\s+(?:for|of)?\s*(?:[-:]\s*)?/i,
  /^(?:corrigendum|addendum|rescheduled)\s*(?:[-:]\s*)?/i,
  /^(?:registration\s+extended|last\s+date\s+extended)\s*(?:[-:]\s*)?/i,
];

/**
 * Common suffixes to strip from company names.
 */
const SUBJECT_SUFFIXES = [
  /\s+(?:super\s+dream|dream|regular)\s+(?:internship|placement|drive|offer).*$/i,
  /\s+(?:super\s+dream|dream|regular)$/i,
  /\s+(?:placement\s+drive|campus\s+drive|internship\s+drive|drive).*$/i,
  /\s+\d+\s*[-]?\s*months?\b.*$/i,      // "6 months", "6-month"
  /\s+\d+\s*moths?\b.*$/i,              // "6moths"
  /\s+\d+\s*mo\b.*$/i,                  // "6mo", "6 mo"
  /\s+ect\b.*$/i,                       // "ECT" (Early Career Talent style suffixes)
  /\s+\d{4}\s*(?:batch)?.*$/i,          // trailing bare years like "2027", "2027 batch"
  /\s+(?:internship|intern|offer|placement)$/i,
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
  'date change', 'date change for sabre', 'date change for squadstack', 'schedule change', 'venue change',
  // Role titles / profiles that are never company names
  'ps associate software engineer', 'associate software engineer', 'ps associate engineer',
  'associate engineer', 'software engineer', 'software development engineer',
  'data scientist', 'data analyst', 'business analyst', 'graduate engineer trainee',
  'graduate trainee', 'system engineer', 'technical consultant', 'consultant',
  'full stack developer', 'backend developer', 'frontend developer', 'intern', 'internship',
];

/**
 * Common English stopwords, determiners, pronouns, prepositions, and generic placement terms
 * that can NEVER be treated as company names or fuzzy match anchors.
 */
export const ENGLISH_STOPWORDS = new Set([
  // Articles & Determiners
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'each', 'every', 'all', 'any', 'some', 'no', 'none', 'both', 'either', 'neither', 'not', 'never',
  // Pronouns
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
  // Prepositions & Conjunctions
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'at', 'before', 'behind', 'below', 'beneath',
  'beside', 'between', 'beyond', 'by', 'down', 'during', 'except', 'for', 'from', 'in', 'inside', 'into', 'near', 'of',
  'off', 'on', 'onto', 'out', 'outside', 'over', 'past', 'regarding', 'since', 'through', 'throughout', 'to', 'toward',
  'under', 'underneath', 'until', 'up', 'upon', 'with', 'within', 'without', 'and', 'but', 'or', 'nor', 'so', 'yet', 'if',
  // Auxiliary & Common Verbs
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'get', 'got', 'give', 'given', 'take', 'taken',
  // Common College & Placement Non-Company Entities
  'dear', 'student', 'students', 'candidate', 'candidates', 'batch', 'campus', 'college', 'university', 'department',
  'office', 'notice', 'circular', 'announcement', 'update', 'link', 'form', 'registration', 'placement', 'drive',
  'internship', 'process', 'selection', 'shortlist', 'shortlisted', 'eligible', 'eligibility', 'urgent', 'important',
  'reminder', 'invitation', 'congratulations', 'details', 'information', 'schedule', 'venue', 'timing', 'dates',
  'morning', 'afternoon', 'evening', 'today', 'tomorrow', 'yesterday', 'passout', 'prelims', 'portal', 'day', 'slots',
  'week', 'month', 'year', 'thanks', 'thank', 'regards', 'team', 'attend', 'attended', 'attending', 'report', 'reported',
  'test', 'tests', 'interview', 'interviews', 'assessment', 'assessments', 're', 'fwd', 'fw',
]);

/**
 * Validates whether a candidate string is NOT a legitimate company name.
 * Centrally blocks stopwords, articles, numbers, and generic non-company phrases.
 */
export function isInvalidCompanyName(name: string): boolean {
  if (!name) return true;
  const clean = name.trim().toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  if (clean.length < 2) return true;
  if (/^\d+$/.test(clean)) return true; // Purely numbers

  // Exact match in NON_COMPANY_WORDS
  if (NON_COMPANY_WORDS.includes(clean)) return true;

  // Single word is a stopword
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1 && ENGLISH_STOPWORDS.has(words[0])) {
    return true;
  }

  // If every word in the phrase is a stopword or noise word, reject it
  // e.g. "Students Who Got The Link But Not In", "Batch 2 Of"
  const substantiveWords = words.filter(
    (w) => !ENGLISH_STOPWORDS.has(w) && !COMPANY_NOISE_WORDS.includes(w) && w.length >= 2
  );
  if (substantiveWords.length === 0) {
    return true;
  }

  return false;
}

/**
 * Extracts and normalizes a company name from the email subject.
 */
export function extractCompanyName(
  subject: string,
  _senderEmail: string,
  bodySnippet?: string,
  receivedAt?: Date | string,
  knownDriveResolutions?: Map<string, string>
): string | null {
  const fullEmailText = `${subject}\n${bodySnippet || ''}`;
  const driveNumber = extractDriveNumber(fullEmailText);

  // If this email carries a drive_number that has already been resolved by timing correlation, use it
  if (driveNumber && knownDriveResolutions?.has(driveNumber)) {
    return knownDriveResolutions.get(driveNumber)!;
  }

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

  // 1.5. Direct High-Precision Extraction from standard College Placement Circular body:
  // e.g. "Super Dream Internship - 2027 Batch Name of the Company Kinaxis Category Super Dream Internship"
  // e.g. "Placement Drive Date Update ... Drive Name: Sabre Drive Number: pat-PL-2026-1108"
  if (bodySnippet) {
    const candidates: Array<{ raw: string; cleaned: string; normalized: string; score: number }> = [];

    const addCandidate = (raw: string | undefined, sourceWeight: number) => {
      if (!raw) return;

      // Pre-strip duration/batch/year noise on raw candidate string before scoring
      const preCleaned = raw
        .replace(/\s+\d+\s*[-]?\s*months?\b.*$/i, '')
        .replace(/\s+\d+\s*moths?\b.*$/i, '')
        .replace(/\s+\d+\s*mo\b.*$/i, '')
        .replace(/\s+ect\b.*$/i, '')
        .replace(/\s+\d{4}\s*(?:batch)?.*$/i, '');

      const cleaned = cleanCompanyName(preCleaned);
      if (!cleaned || isInvalidCompanyName(cleaned)) {
        return;
      }

      let candidateClean = cleaned;
      if (/^honeywell$/i.test(cleaned)) {
        if (/aerospace/i.test(bodySnippet)) candidateClean = 'Honeywell Aerospace';
        else if (/technology\s+solutions/i.test(bodySnippet)) candidateClean = 'Honeywell Technology Solutions Lab';
      }

      const normalized = normalizeCompanyName(candidateClean);
      const lowerNorm = normalized.toLowerCase();
      const lowerClean = candidateClean.toLowerCase();

      if (isInvalidCompanyName(normalized) || ['super', 'dream', 'internship', 'placement', 'drive', 'finance'].includes(lowerNorm)) {
        return;
      }

      let score = sourceWeight;

      // 1. Direct match in COMPANY_ALIASES (+100)
      // e.g. "ey sap" or "ey gds" matches alias directly, beating bare "ey"
      if (COMPANY_ALIASES[lowerClean] || COMPANY_ALIASES[lowerNorm]) {
        score += 100;
      }

      // 2. Track / specialization tokens (+50)
      if (/\b(?:sdet|sre|sap|gds|aerospace|technology\s+solutions|analytics|bpm)\b/i.test(lowerNorm)) {
        score += 50;
      }

      // Penalize generic single-word abbreviations that have known specializations
      if (['ey'].includes(lowerNorm)) {
        score -= 20;
      }

      candidates.push({ raw, cleaned: candidateClean, normalized, score });
    };

    // 1. Company: <Name>
    const companyMatch = bodySnippet.match(
      /(?:^|\s|\n|\r)company\s*[:\-–—]\s*([A-Za-z0-9&\s\-\.()]+?)(?:\s+(?:drive\s+name|drive\s+number|new\s+drive\s+date|category|date\s+of\s+visit|eligibility|eligible|ctc|role|stipend|\n|\r|\*))/i
    );
    if (companyMatch && companyMatch[1]) {
      addCandidate(companyMatch[1], 10);
    }

    // 2. Drive Name: <Name>
    const driveNameMatch = bodySnippet.match(
      /(?:drive\s+name|name\s+of\s+the\s+drive)\s*[:\-*]*\s*([A-Za-z0-9&\s\-\.()]+?)(?:\s+(?:drive\s+number|new\s+drive\s+date|category|date\s+of\s+visit|eligibility|eligible|ctc|role|stipend|\n|\r|\*))/i
    );
    if (driveNameMatch && driveNameMatch[1]) {
      addCandidate(driveNameMatch[1], 15);
    }

    // 3. Name of the Company / Company Name: <Name>
    const bodyCompMatch = bodySnippet.match(
      /(?:name\s+of\s+the\s+company|company\s+name)\s*[:\-*]*\s*([A-Za-z0-9&\s\-\.()]+?)(?:\s+(?:category|date\s+of\s+visit|eligibility|eligible|ctc|role|stipend|\n|\r|\*))/i
    );
    if (bodyCompMatch && bodyCompMatch[1]) {
      addCandidate(bodyCompMatch[1], 10);
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0].normalized;
    }

    // 4. Greeting / Body opening pattern: "Greetings from <Company>!"
    // Used by Capgemini, Infosys and other direct company circulars forwarded via CDC
    const greetingMatch = bodySnippet.match(
      /greetings\s+from\s+(?:the\s+)?([A-Za-z0-9&\s\-\.]+?)\s*[!,\.\n]/i
    );
    if (greetingMatch && greetingMatch[1]) {
      const gc = cleanCompanyName(greetingMatch[1]);
      if (gc && !isInvalidCompanyName(gc)) {
        return normalizeCompanyName(gc);
      }
    }

    // 5. "details about <Company [Program]>" — e.g. "share more details about Capgemini Exceller"
    const detailsMatch = bodySnippet.match(
      /(?:details|information)\s+about\s+(?:the\s+)?([A-Z][A-Za-z0-9&]+(?:\s+[A-Za-z]+)?)/
    );
    if (detailsMatch && detailsMatch[1]) {
      const dc = cleanCompanyName(detailsMatch[1]);
      if (dc && !isInvalidCompanyName(dc)) {
        return normalizeCompanyName(dc);
      }
    }
  }

  // Clean the subject to remove prefixes like "Confirmed: Your Registration for"
  const cleanedSubject = cleanSubjectNoise(subject);
  const lowerCleaned = cleanedSubject.toLowerCase();
  const lowerBody = (bodySnippet || '').toLowerCase();

  // Check subject for program-name patterns:
  // "Capgemini Exceller 2027: Introducing...", "TCS NQT 2027...", "Infosys Springboard..."
  const programSubjectMatch = cleanedSubject.match(
    /^([A-Za-z0-9&\s\-\.]+?)\s+(?:exceller|nqt|springboard|ignite|codevita|hackwithinfy|genc|genplorer|launchpad|catalyst)\b/i
  );
  if (programSubjectMatch && programSubjectMatch[1]) {
    const pc = cleanCompanyName(programSubjectMatch[1]);
    if (pc && !isInvalidCompanyName(pc)) {
      return normalizeCompanyName(pc);
    }
  }

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
    return 'EY GDS';
  }

  // Disambiguate Honeywell Aerospace vs Honeywell Technology Solutions Lab vs Honeywell Technologies
  if (lowerCleaned.includes('honeywell') || lowerBody.includes('honeywell')) {
    if (lowerCleaned.includes('aerospace') || lowerBody.includes('aerospace')) {
      return 'Honeywell Aerospace';
    }
    if (
      lowerCleaned.includes('technology solutions') ||
      lowerCleaned.includes('solutions lab') ||
      lowerBody.includes('technology solutions') ||
      lowerBody.includes('solutions lab') ||
      /pat-pl-2026-1135/i.test(lowerCleaned) ||
      /pat-pl-2026-1135/i.test(lowerBody)
    ) {
      return 'Honeywell Technology Solutions Lab';
    }
    // July 27 - August 11 Super Dream Internship cycle is Honeywell Technology Solutions Lab
    if (
      (/super\s*dream/i.test(lowerCleaned) && !lowerCleaned.includes('aerospace')) ||
      /ppt.*online\s+test.*sjt|next\s+round.*sjt717|alumni\s+mock/i.test(lowerCleaned) ||
      /sarojini\s+naidu\s+gallery/i.test(lowerBody)
    ) {
      return 'Honeywell Technology Solutions Lab';
    }
    if (lowerCleaned.includes('technologies') || lowerBody.includes('technologies')) {
      return 'Honeywell Technologies';
    }
    if (lowerCleaned.includes('dream internship')) {
      return 'Honeywell Technologies';
    }
    return 'Honeywell Technologies';
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
    if (
      lowerCleaned.includes('sre') ||
      lowerBody.includes('sre') ||
      lowerBody.includes('site reliability') ||
      lowerBody.includes('reliability') ||
      lowerCleaned.includes('new role') ||
      lowerBody.includes('new role') ||
      lowerBody.includes('lc101') ||
      lowerBody.includes('lc 101')
    ) {
      return 'Apple SRE';
    }
    // If drive resolution was resolved via timing correlation, use it
    if (driveNumber && knownDriveResolutions?.has(driveNumber)) {
      return knownDriveResolutions.get(driveNumber)!;
    }
    // Generic fallback: timing correlation engine will resolve the drive_number
    return 'Apple';
  }

  // Disambiguate Zluri SWE vs Zluri SDET
  if (lowerCleaned.includes('zluri') || lowerBody.includes('zluri')) {
    if (lowerCleaned.includes('sdet') || lowerBody.includes('sdet')) {
      return 'Zluri SDET';
    }
    return 'Zluri';
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
        !isInvalidCompanyName(cleaned) &&
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

  // If no pattern matched, but the cleaned subject is short (1-4 words) and looks like a company name
  if (cleanedSubject && cleanedSubject.split(/\s+/).length <= 4) {
    const cleaned = cleanCompanyName(cleanedSubject);
    if (
      cleaned &&
      !isInvalidCompanyName(cleaned) &&
      !/^(?:portal|webinar|survey|assessment|feedback|cdc|vit|profile|course|day\s+\d+|session|prelims|passout\s+batch|complete|reminder|shortlist)/i.test(cleaned) &&
      !/^(?:ps\s+)?(?:associate\s+)?(?:software\s+)?(?:engineer|developer|analyst|scientist|trainee|consultant|specialist)$/i.test(cleaned) &&
      !/(?:software\s+engineer|associate\s+engineer|data\s+scientist|data\s+analyst|graduate\s+trainee)/i.test(cleaned)
    ) {
      return normalizeCompanyName(cleaned);
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
    // Also strip standalone leading punctuation and "urgent -" noise
    const leadingNoise = /^[-–—:\s]*(?:urgent|important|reminder|updated|extended\s+deadline)?[-–—:\s]*/i;
    const cleaned = str.replace(leadingNoise, '').trim();
    if (cleaned.length > 0 && cleaned !== str) {
      str = cleaned;
      changed = true;
    }
  }
  return str;
}

/**
 * Cleans a raw company name by removing noise words, prefixes, and suffixes.
 */
export function cleanCompanyName(name: string): string {
  let str = cleanSubjectNoise(name);

  // Strip leading date change / update noise if any slipped through
  str = str.replace(/^(?:date\s+change\s+(?:for|:)?|rescheduled\s+(?:for|:)?)/i, '').trim();

  // Strip duration/batch/year noise before general suffixes
  str = str.replace(/\s+\d+\s*[-]?\s*months?\b.*$/i, '');
  str = str.replace(/\s+\d+\s*moths?\b.*$/i, '');
  str = str.replace(/\s+\d+\s*mo\b.*$/i, '');
  str = str.replace(/\s+ect\b.*$/i, '');
  str = str.replace(/\s+\d{4}\s*(?:batch)?.*$/i, '');

  // Strip trailing suffixes
  for (const s of SUBJECT_SUFFIXES) {
    str = str.replace(s, '').trim();
  }

  // 1. Check for trading brand names in parentheses: e.g. "RFPIO India Pvt Ltd (DBA Responsive)" -> "Responsive"
  const dbaMatch = str.match(/\((?:dba|d\/b\/a|doing\s+business\s+as|aka|a\.k\.a\.|now)\s+([A-Za-z0-9&\s\-\.]+?)\)/i);
  if (dbaMatch && dbaMatch[1]) {
    const brand = dbaMatch[1].trim();
    if (brand && !isInvalidCompanyName(brand)) {
      return brand;
    }
  }

  // 2. Remove parenthetical subsidiary / owner notes: e.g. "(A Siemens Company)"
  str = str.replace(/\((?:a|an|the)?\s*[^)]*?(?:company|group|subsidiary|division)[^)]*\)/gi, ' ').trim();

  // 3. Remove content in remaining parentheses e.g. "(Mitsubishi UFJ Financial Group)"
  str = str.replace(/\(.*?\)/g, '').trim();

  // Remove trailing noise legal words
  const words = str.split(/\s+/);
  const filteredWords = words.filter(
    (w) => !COMPANY_NOISE_WORDS.includes(w.toLowerCase().replace(/[.,]/g, ''))
  );
  str = filteredWords.join(' ').trim();

  // Remove leading/trailing punctuation
  str = str.replace(/^[:\-\s\|,.\/]+|[:\-\s\|,.\/]+$/g, '').trim();

  if (isInvalidCompanyName(str)) {
    return '';
  }

  return str;
}

/**
 * Normalizes a company name using the known aliases map.
 */
export function normalizeCompanyName(name: string): string {
  if (!name || isInvalidCompanyName(name)) {
    return '';
  }

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
