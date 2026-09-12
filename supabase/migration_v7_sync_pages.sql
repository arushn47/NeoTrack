-- ============================================
-- Migration v7: Count-Based Resumable Sync Pages & Recency Guard
-- ============================================
-- Run this in the Supabase SQL Editor.

-- 1. Create sync_pages table for resumable, chunked email synchronization
CREATE TABLE IF NOT EXISTS sync_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  gmail_account_id UUID REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,            -- 0 = most recent page (Page 0)
  message_ids JSONB NOT NULL,             -- Array of Gmail message IDs in this slice, newest-first
  next_offset INTEGER DEFAULT 0,          -- Resume checkpoint within this page (index into reversed chronological slice)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'complete')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gmail_account_id, page_index)
);

-- Index for fast lookup by account and status
CREATE INDEX IF NOT EXISTS idx_sync_pages_account_status ON sync_pages(gmail_account_id, status, page_index);
CREATE INDEX IF NOT EXISTS idx_sync_pages_user_status ON sync_pages(user_id, status);

-- Enable RLS
ALTER TABLE sync_pages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sync_pages' AND policyname = 'sync_pages_own_data'
  ) THEN
    CREATE POLICY "sync_pages_own_data" ON sync_pages FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

-- 2. Add status_source_email_at to applications table for recency protection against out-of-order writes
ALTER TABLE applications ADD COLUMN IF NOT EXISTS status_source_email_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_applications_source_email_at ON applications(user_id, status_source_email_at);

-- 3. Add page tracking to sync_state for frontend progress
ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS current_page_index INTEGER DEFAULT 0;
ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 1;

