# Phases — NeoPAT Placement Tracker

## Overview

The project is divided into **6 phases**, each building on the previous one. Each phase produces a working, testable increment. No phase should be started until the previous phase is complete and verified.

---

## Phase 1 — Foundation & Authentication

**Goal**: Set up the project skeleton, database, and Google OAuth.

### Deliverables

- [x] Project documentation (PRD, Architecture, Rules, Phases, Design)
- [ ] Next.js 15 project initialized with TypeScript, Tailwind CSS v4, shadcn/ui
- [ ] Supabase project created with initial schema
- [ ] Database migrations for all tables (users, gmail_accounts, companies, applications, emails, attachments, candidate_matches, events, documents)
- [ ] Google Cloud project with OAuth 2.0 credentials
- [ ] Google OAuth sign-in flow (connect personal + college Gmail)
- [ ] Token encryption and secure storage
- [ ] Basic app shell (sidebar, topbar, protected routes)
- [ ] Settings page with account management (connect/disconnect Gmail, Neo ID input)
- [ ] `.env.example` with all required variables

### Acceptance Criteria

- User can sign in with Google
- User can connect both Gmail accounts
- User can enter and save their Neo ID
- User can disconnect a Gmail account
- Tokens are encrypted in the database
- Protected pages redirect to login when unauthenticated

### Estimated Effort

~3-4 days

---

## Phase 2 — Email Sync & Classification

**Goal**: Fetch placement emails from Gmail and classify them.

### Deliverables

- [ ] Gmail API client wrapper (fetch emails, list messages, get message details)
- [ ] Placement email search queries (subject/sender filters)
- [ ] Email classification engine (deterministic rules-based)
  - Registration, Confirmation, Application Status, Withdrawal, Decline, Shortlist, PPT, Test, Interview, JD, Result, General
- [ ] Company name extraction from email subject/body/sender
- [ ] Company name normalization (aliases, suffix stripping)
- [ ] Email storage in database (with deduplication via `gmail_message_id`)
- [ ] Manual sync button on dashboard ("Sync Now")
- [ ] Sync progress indicator (emails processed / total)
- [ ] Basic company creation from detected emails
- [ ] Sync history log

### Acceptance Criteria

- Clicking "Sync" fetches emails from connected Gmail accounts
- Emails are classified into correct categories
- Companies are detected and created in the database
- Duplicate emails are not reprocessed
- Sync progress is visible to the user
- Sync can handle 100+ emails without timeout

### Estimated Effort

~4-5 days

---

## Phase 3 — Attachment Processing & Neo ID Matching

**Goal**: Parse XLSX/PDF/DOCX attachments and match Neo ID.

### Deliverables

- [ ] FastAPI microservice scaffolding (project setup, Dockerfile, health check)
- [ ] XLSX parser — reads all sheets/cells, searches for Neo ID
- [ ] PDF text extractor — extracts readable text from PDFs
- [ ] DOCX text extractor — extracts text from Word documents
- [ ] JD field extraction (company, role, CTC, stipend, location, eligibility, CGPA, branches, deadline)
- [ ] Neo ID matching engine — search Neo ID across all parsed content
- [ ] Attachment download from Gmail API → upload to Supabase Storage
- [ ] File deduplication via SHA-256 hash
- [ ] Candidate match recording in database (which attachment, which cell/location)
- [ ] Document storage and association with companies
- [ ] API key authentication for service-to-service calls

### Acceptance Criteria

- XLSX files are parsed and Neo ID is found when present
- PDF text is extracted (non-scanned PDFs)
- DOCX text is extracted
- JD fields are extracted with reasonable accuracy
- Attachments are stored in Supabase Storage
- Duplicate files are detected and not re-stored
- Neo ID matches are recorded with evidence

### Estimated Effort

~4-5 days

---

## Phase 4 — Status Engine & Event Extraction

**Goal**: Compute canonical application status and extract placement events.

### Deliverables

- [ ] Event extraction from emails (PPT, Test, Interview dates/times/venues)
- [ ] Date/time parser (supports multiple Indian date formats)
- [ ] Status resolution engine
  - Combines evidence from NeoPAT emails, VIT emails, candidate matches, events
  - Priority: Explicit latest status > Candidate evidence > Latest event > Registration > NeoPAT
  - Handles conflicts (e.g., NeoPAT says "Applied" but VIT email says "Withdrawn")
- [ ] Status history preservation (never delete old states)
- [ ] Manual override system (user can set status, role, company name)
  - Manual edits take precedence until explicitly reset
- [ ] Source evidence linking (every auto-generated field links to its source email/attachment)

### Acceptance Criteria

- Events are extracted with correct dates, times, and types
- Status engine produces correct canonical status for test scenarios:
  - Applied → Shortlisted → Test Scheduled → Interview Scheduled
  - Applied → Withdrawn (overrides NeoPAT "Applied")
  - Applied → Declined
- Manual override persists across syncs
- Source evidence is visible for every auto-generated field
- Status history is preserved

### Estimated Effort

~3-4 days

---

## Phase 5 — Dashboard & Company Detail UI

**Goal**: Build the complete dashboard and company detail views.

### Deliverables

- [ ] Dashboard summary cards (Total, Active, Shortlisted, Tests, Interviews, Rejected, Withdrawn)
- [ ] Upcoming events section (chronologically sorted)
- [ ] Company table (sortable, filterable columns)
  - Company, Role, Status, CTC, Location, Next Event, Neo ID Match, JD, Last Updated
- [ ] Company detail page
  - Company header (name, legal name, status badge)
  - Timeline view (chronological events with evidence)
  - Role/CTC/Location details
  - JD viewer/download
  - Source emails list (clickable links)
  - Neo ID match indicator with evidence
  - Manual edit controls (status, role, company name, notes)
- [ ] Search functionality (company, role, email subject, Neo ID)
- [ ] Filter panel (status, location, CTC range, event type)
- [ ] Calendar view (monthly calendar with event markers)
  - Color-coded by event type (PPT = blue, Test = orange, Interview = green, Deadline = red)
- [ ] Empty states for all views
- [ ] Loading skeletons for all data-fetching views
- [ ] Toast notifications for operations (sync complete, manual edit saved)

### Acceptance Criteria

- Dashboard shows accurate summary stats
- Company table displays all companies with correct data
- Company detail page shows full timeline with evidence
- Search returns relevant results
- Filters narrow down the company table correctly
- Calendar shows events on correct dates with correct types
- Manual edits work and persist
- UI is responsive (desktop + tablet + mobile)
- All loading states are handled

### Estimated Effort

~5-7 days

---

## Phase 6 — Polish, Notifications & Deployment

**Goal**: Production-ready polish, in-app notifications, and deployment.

### Deliverables

- [ ] In-app notification system
  - New company detected
  - Shortlist match found
  - Test/Interview scheduled
  - Deadline approaching (24h warning)
  - Status changed (rejected/selected/withdrawn)
- [ ] Notification bell with unread count
- [ ] Email sync optimization (incremental sync, skip unchanged)
- [ ] Error handling improvements (graceful Gmail failures, attachment errors)
- [ ] Performance optimization
  - Dashboard query optimization
  - Lazy loading for calendar and detail pages
  - Image/asset optimization
- [ ] Security audit
  - Token encryption verification
  - RLS policy testing
  - Input sanitization review
  - HTTPS enforcement
- [ ] SEO & meta tags for public pages
- [ ] Vercel deployment (Next.js)
- [ ] Railway deployment (FastAPI parser service)
- [ ] Supabase Cloud production database
- [ ] Environment variable configuration
- [ ] Production smoke testing
- [ ] `memory.md` updated with final state

### Acceptance Criteria

- Notifications appear for relevant events
- Sync is fast for incremental updates (< 30 seconds for 10 new emails)
- App loads in < 3 seconds
- No security vulnerabilities in token handling
- App is deployed and accessible via public URL
- All core features work in production

### Estimated Effort

~4-5 days

---

## Future Phases (Post-MVP)

### Phase 7 — Automatic Sync & Push Notifications

- Google Pub/Sub webhook for real-time Gmail notifications
- Web Push API notifications (browser)
- Background sync worker

### Phase 8 — Browser Extension

- Chrome extension that overlays NeoPAT with real statuses
- Shows dashboard data inline on the NeoPAT portal
- Quick actions (view timeline, check status)

### Phase 9 — Mobile PWA

- Progressive Web App with offline support
- Push notifications on mobile
- Installable from browser

### Phase 10 — AI Enhancements

- Gemini-powered email classification fallback
- AI-generated company preparation checklists
- Smart CTC comparison
- Interview preparation notes

### Phase 11 — Analytics

- Application success rate
- Average time per stage
- CTC distribution chart
- Company response time analytics

---

## Phase Summary

| Phase | Name                              | Est. Days | Cumulative |
|-------|-----------------------------------|-----------|------------|
| 1     | Foundation & Authentication       | 3-4       | 3-4        |
| 2     | Email Sync & Classification       | 4-5       | 7-9        |
| 3     | Attachment Processing & Neo ID    | 4-5       | 11-14      |
| 4     | Status Engine & Event Extraction  | 3-4       | 14-18      |
| 5     | Dashboard & Company Detail UI     | 5-7       | 19-25      |
| 6     | Polish, Notifications & Deploy    | 4-5       | 23-30      |

**Total estimated MVP timeline: ~4-5 weeks**
