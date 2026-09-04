import type { ApplicationStatus } from './statuses';
import type { EventType } from './event-types';

export { APPLICATION_STATUSES, STATUS_LABELS, STATUS_COLORS, STATUS_PRIORITY } from './statuses';
export type { ApplicationStatus } from './statuses';

export { EVENT_TYPES, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, EVENT_TYPE_ICONS } from './event-types';
export type { EventType } from './event-types';

/** Email classification categories */
export const EMAIL_CLASSIFICATIONS = {
  REGISTRATION: 'registration',
  REGISTRATION_CONFIRMATION: 'registration_confirmation',
  APPLICATION_STATUS: 'application_status',
  WITHDRAWAL: 'withdrawal',
  DECLINE: 'decline',
  SHORTLIST: 'shortlist',
  PPT: 'ppt',
  TEST: 'test',
  INTERVIEW: 'interview',
  JD: 'jd',
  VENUE_UPDATE: 'venue_update',
  RESULT: 'result',
  GENERAL: 'general',
  UNCLASSIFIED_PLACEMENT_NOTICE: 'unclassified_placement_notice',
  IRRELEVANT: 'irrelevant',
  UNCLASSIFIED: 'unclassified',
} as const;

export type EmailClassification = typeof EMAIL_CLASSIFICATIONS[keyof typeof EMAIL_CLASSIFICATIONS];

/** Gmail account types */
export const ACCOUNT_TYPES = {
  PERSONAL: 'personal',
  COLLEGE: 'college',
} as const;

export type AccountType = typeof ACCOUNT_TYPES[keyof typeof ACCOUNT_TYPES];

/** Notification types */
export const NOTIFICATION_TYPES = {
  NEW_COMPANY: 'new_company',
  SHORTLIST_MATCH: 'shortlist_match',
  TEST_SCHEDULED: 'test_scheduled',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  DEADLINE_APPROACHING: 'deadline_approaching',
  STATUS_CHANGE: 'status_change',
  SYNC_COMPLETE: 'sync_complete',
  GENERAL: 'general',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

/** Navigation items for sidebar */
export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: 'LayoutDashboard' },
  { label: 'Companies', href: '/companies', icon: 'Building2' },
  { label: 'Calendar', href: '/calendar', icon: 'Calendar' },
  { label: 'Search', href: '/search', icon: 'Search' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const;
