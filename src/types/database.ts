/**
 * TypeScript types matching the Supabase database schema.
 * These are the raw database row types.
 */

export interface DbUser {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  neo_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbGmailAccount {
  id: string;
  user_id: string;
  email: string;
  account_type: 'personal' | 'college';
  google_account_id: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expiry: string | null;
  last_sync_at: string | null;
  last_history_id: string | null;
  is_connected: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbCompany {
  id: string;
  user_id: string;
  name: string;
  legal_name: string | null;
  aliases: string[];
  created_at: string;
  updated_at: string;
}

export interface DbApplication {
  id: string;
  user_id: string;
  company_id: string;
  status: string;
  status_source: string | null;
  status_confidence: 'high' | 'medium' | 'low' | 'ai' | 'manual';
  role: string | null;
  ctc: string | null;
  stipend: string | null;
  location: string | null;
  eligibility: string | null;
  branches: string[] | null;
  cgpa_requirement: string | null;
  backlog_requirement: string | null;
  registration_deadline: string | null;
  job_description: string | null;
  manual_override: boolean;
  notes: string | null;
  applied_at: string | null;
  last_updated: string;
  created_at: string;
}

export interface DbEmail {
  id: string;
  gmail_account_id: string;
  user_id: string;
  gmail_message_id: string;
  thread_id: string | null;
  sender: string | null;
  subject: string | null;
  received_at: string | null;
  body_snippet: string | null;
  classification: string | null;
  company_id: string | null;
  is_processed: boolean;
  is_relevant: boolean;
  processed_at: string | null;
  created_at: string;
}

export interface DbAttachment {
  id: string;
  email_id: string;
  user_id: string;
  filename: string;
  mime_type: string | null;
  storage_path: string | null;
  file_hash: string | null;
  file_size_bytes: number | null;
  is_processed: boolean;
  created_at: string;
}

export interface DbCandidateMatch {
  id: string;
  user_id: string;
  application_id: string | null;
  attachment_id: string | null;
  email_id: string | null;
  neo_id: string;
  match_type: 'xlsx_cell' | 'pdf_text' | 'docx_text' | 'email_body' | 'email_subject';
  matched_value: string | null;
  match_location: string | null;
  confidence: 'high' | 'medium' | 'low';
  created_at: string;
}

export interface DbEvent {
  id: string;
  user_id: string;
  company_id: string;
  application_id: string | null;
  event_type: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  mode: 'online' | 'offline' | 'hybrid' | 'unknown' | null;
  source_email_id: string | null;
  confidence: 'high' | 'medium' | 'low' | 'ai';
  manual_override: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbDocument {
  id: string;
  user_id: string;
  company_id: string | null;
  application_id: string | null;
  document_type: 'jd' | 'shortlist' | 'company_info' | 'offer_letter' | 'other';
  filename: string;
  storage_path: string;
  source_email_id: string | null;
  created_at: string;
}

export interface DbStatusHistory {
  id: string;
  application_id: string;
  old_status: string | null;
  new_status: string;
  source: string | null;
  source_email_id: string | null;
  changed_at: string;
}

export interface DbNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  company_id: string | null;
  is_read: boolean;
  created_at: string;
}
