-- ============================================
-- NeoPAT Placement Tracker — Full Database Schema
-- ============================================
-- Run this in Supabase SQL Editor to set up all tables

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  neo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. gmail_accounts
-- ============================================
CREATE TABLE IF NOT EXISTS gmail_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('personal', 'college')),
  google_account_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expiry TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_history_id TEXT,
  is_connected BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- ============================================
-- 3. companies
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  legal_name TEXT,
  aliases TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ============================================
-- 4. applications
-- ============================================
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN (
    'not_applied', 'applied', 'shortlisted', 'ppt_scheduled',
    'test_scheduled', 'interview_scheduled', 'selected',
    'rejected', 'withdrawn', 'declined', 'offer_received', 'unknown'
  )),
  status_source TEXT,
  status_confidence TEXT DEFAULT 'low' CHECK (status_confidence IN ('high', 'medium', 'low', 'ai', 'manual')),
  role TEXT,
  ctc TEXT,
  stipend TEXT,
  location TEXT,
  eligibility TEXT,
  branches TEXT[],
  cgpa_requirement TEXT,
  backlog_requirement TEXT,
  registration_deadline TIMESTAMPTZ,
  job_description TEXT,
  manual_override BOOLEAN DEFAULT FALSE,
  notes TEXT,
  applied_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- ============================================
-- 5. emails
-- ============================================
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gmail_account_id UUID NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT,
  sender TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ,
  body_snippet TEXT,
  classification TEXT CHECK (classification IN (
    'registration', 'registration_confirmation', 'application_status',
    'withdrawal', 'decline', 'shortlist', 'ppt', 'test', 'interview',
    'jd', 'venue_update', 'result', 'general', 'irrelevant', 'unclassified'
  )),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  is_processed BOOLEAN DEFAULT FALSE,
  is_relevant BOOLEAN DEFAULT TRUE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gmail_account_id, gmail_message_id)
);

-- ============================================
-- 6. attachments
-- ============================================
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT,
  storage_path TEXT,
  file_hash TEXT,
  file_size_bytes INTEGER,
  is_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_id, file_hash)
);

-- ============================================
-- 7. candidate_matches
-- ============================================
CREATE TABLE IF NOT EXISTS candidate_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  attachment_id UUID REFERENCES attachments(id) ON DELETE SET NULL,
  email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  neo_id TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('xlsx_cell', 'pdf_text', 'docx_text', 'email_body', 'email_subject')),
  matched_value TEXT,
  match_location TEXT,
  confidence TEXT DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. events
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'registration_deadline', 'ppt', 'online_test', 'coding_test',
    'technical_interview', 'hr_interview', 'final_interview',
    'result', 'joining_date', 'other'
  )),
  title TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  venue TEXT,
  mode TEXT CHECK (mode IN ('online', 'offline', 'hybrid', 'unknown')),
  source_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  confidence TEXT DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low', 'ai')),
  manual_override BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. documents
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('jd', 'shortlist', 'company_info', 'offer_letter', 'other')),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  source_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. status_history (for audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  source TEXT,
  source_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'new_company', 'shortlist_match', 'test_scheduled', 'interview_scheduled',
    'ppt_scheduled', 'deadline_approaching', 'status_change', 'sync_complete', 'general'
  )),
  title TEXT NOT NULL,
  message TEXT,
  body TEXT,
  link TEXT,
  dedupe_key TEXT UNIQUE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. push_subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. notification_preferences
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  browser_push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  notify_status_change BOOLEAN DEFAULT TRUE,
  notify_shortlist BOOLEAN DEFAULT TRUE,
  notify_tests BOOLEAN DEFAULT TRUE,
  notify_interviews BOOLEAN DEFAULT TRUE,
  notify_ppt BOOLEAN DEFAULT TRUE,
  notify_new_jds BOOLEAN DEFAULT TRUE,
  notify_reminders BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_neo_id ON users(neo_id);

-- Gmail accounts
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_user ON gmail_accounts(user_id);

-- Companies
CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(user_id, name);

-- Applications
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(company_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(user_id, status);

-- Emails
CREATE INDEX IF NOT EXISTS idx_emails_gmail_message ON emails(gmail_account_id, gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_classification ON emails(classification);
CREATE INDEX IF NOT EXISTS idx_emails_company ON emails(company_id);

-- Attachments
CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_attachments_hash ON attachments(file_hash);

-- Candidate matches
CREATE INDEX IF NOT EXISTS idx_candidate_matches_neo ON candidate_matches(neo_id);
CREATE INDEX IF NOT EXISTS idx_candidate_matches_app ON candidate_matches(application_id);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- Status history
CREATE INDEX IF NOT EXISTS idx_status_history_app ON status_history(application_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "users_own_data" ON users FOR ALL USING (id = auth.uid());
CREATE POLICY "gmail_own_data" ON gmail_accounts FOR ALL USING (user_id = auth.uid());
CREATE POLICY "companies_own_data" ON companies FOR ALL USING (user_id = auth.uid());
CREATE POLICY "applications_own_data" ON applications FOR ALL USING (user_id = auth.uid());
CREATE POLICY "emails_own_data" ON emails FOR ALL USING (user_id = auth.uid());
CREATE POLICY "attachments_own_data" ON attachments FOR ALL USING (user_id = auth.uid());
CREATE POLICY "candidate_matches_own_data" ON candidate_matches FOR ALL USING (user_id = auth.uid());
CREATE POLICY "events_own_data" ON events FOR ALL USING (user_id = auth.uid());
CREATE POLICY "documents_own_data" ON documents FOR ALL USING (user_id = auth.uid());
CREATE POLICY "status_history_own_data" ON status_history FOR ALL USING (
  application_id IN (SELECT id FROM applications WHERE user_id = auth.uid())
);
CREATE POLICY "notifications_own_data" ON notifications FOR ALL USING (user_id = auth.uid());

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gmail_accounts_updated_at BEFORE UPDATE ON gmail_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
