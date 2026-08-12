# PRD — NeoPAT Placement Job Tracker

## 1. Product Overview

### Product Name
**NeoPAT Placement Tracker**

### Purpose
Build a personal placement/job tracking application that consolidates NeoPAT placement-drive information and VIT placement emails into one reliable, clean dashboard.

The main problem is that the NeoPAT portal can continue showing companies as **Applied** even after the student has been declined, withdrawn, or otherwise exited from the process. Meanwhile, important updates such as PPTs, tests, interviews, JDs, candidate shortlists, and registration updates arrive through two Gmail accounts.

The application will use Gmail as the primary source of truth and the student's **Neo ID** as a matching key to connect candidate-specific information from Excel/PDF attachments with company emails.

---

## 2. Problem Statement

Students participating in campus placements receive information across multiple systems:

1. **NeoPAT**
   - Shows placement drives.
   - Shows statuses such as Applied, Declined, Not Applied, etc.
   - Can become stale or confusing after a candidate leaves a process.

2. **Personal Gmail**
   - Receives NeoPAT notifications.
   - Receives application/withdrawal/registration updates.

3. **VIT Gmail**
   - Receives placement-cell announcements.
   - Contains PPT/test/interview schedules.
   - Contains JDs and other attachments.
   - May contain candidate shortlists in XLSX/PDF files.

Because the information is distributed across these sources, it is difficult to know the student's actual current placement status.

### Goal

Create a single dashboard that answers:

> **What companies am I currently in, what happened with each company, and what do I need to do next?**

---

# 3. Goals

## Primary Goals

- Connect the user's Gmail accounts through Google OAuth.
- Read relevant NeoPAT and VIT placement emails.
- Identify companies and roles.
- Track the student's application status.
- Use the student's Neo ID to detect whether they appear in candidate lists.
- Parse placement Excel/PDF attachments.
- Extract PPT, test, and interview schedules.
- Extract JD documents and associate them with companies.
- Maintain a normalized placement database.
- Display an easy-to-understand dashboard.
- Allow manual correction/override when automatic parsing is wrong.

## Secondary Goals

- Automatically detect new placement emails.
- Avoid duplicate companies/emails/events.
- Provide upcoming placement deadlines and events.
- Preserve source emails for traceability.
- Provide search/filter/sort functionality.
- Eventually support automatic Gmail push notifications.

---

# 4. Non-Goals

The initial version will NOT:

- Scrape or automate interactions with NeoPAT.
- Apply to companies automatically.
- Withdraw applications automatically.
- Send emails on behalf of the user.
- Automatically make career decisions.
- Share Gmail data with third parties.
- Require AI for every email.

AI should only be used when deterministic parsing is insufficient.

---

# 5. Target User

### Primary User
A VIT student participating in campus placement drives.

### Example User Workflow

The user receives:

> "MUFG Pre-placement talk and Online test..."

The application detects:

- Company: MUFG
- PPT: 11 Aug 2026, 11:30 AM
- Test: 13 Aug 2026, 2:30 PM
- Interview: 14 Aug 2026, 10:00 AM

The application then searches for the student's Neo ID.

If the Neo ID appears in the MUFG shortlist Excel file, the application records:

> Candidate confirmed in shortlist.

The dashboard then shows:

> MUFG — Shortlisted → PPT → Test → Interview

---

# 6. Data Sources

## 6.1 Personal Gmail

Purpose:
- NeoPAT notifications
- Registration confirmations
- Application status
- Withdrawals
- Declines
- Other NeoPAT updates

Examples of useful messages:

- Placement Drive Invitation
- Registration Confirmed
- Registration Status Update
- Applied Candidates
- Withdrawn
- Declined

---

## 6.2 VIT Gmail

Purpose:
- Placement-cell announcements
- PPT schedules
- Online test schedules
- Interview schedules
- JDs
- Candidate shortlists
- Eligibility information
- Company registration information

Attachments may include:

- XLSX
- XLS
- PDF
- DOC/DOCX
- Other common document formats

---

## 6.3 Neo ID

The user provides their NeoPAT ID once.

Example:

`A6S2A7G9`

The system searches relevant emails and attachments for this identifier.

This is the primary candidate-specific matching mechanism.

---

# 7. Core Features

## 7.1 Google OAuth

Allow the user to connect:

- Personal Gmail
- VIT Gmail

Each account should be represented separately.

### Requirements

- Google OAuth 2.0
- Least-privilege Gmail scopes wherever possible
- Secure token storage
- Token refresh handling
- Disconnect/revoke account option

---

# 7.2 Email Synchronization

The application should retrieve relevant emails.

### Initial Sync

On first connection:

1. Search historical emails.
2. Identify placement-related messages.
3. Process messages.
4. Process relevant attachments.
5. Create/update companies and events.

### Incremental Sync

After initial sync:

- Fetch only new/changed relevant emails.
- Avoid reprocessing unchanged messages.
- Store Gmail message IDs.

---

# 7.3 Placement Email Classification

Emails should be classified into categories such as:

- Registration
- Registration Confirmation
- Application Status
- Withdrawal
- Decline
- Shortlist
- PPT
- Test
- Interview
- JD
- Venue Update
- Result
- General Placement Information

Classification should first use deterministic rules/keywords.

AI may be used as a fallback for ambiguous emails.

---

# 7.4 Company Detection

Extract company name from:

- Email subject
- Email body
- Sender
- Attachments
- Known company aliases

Example:

`MUFG (Mitsubishi UFJ Financial Group)`

should normalize to:

**MUFG**

while retaining:

**Mitsubishi UFJ Financial Group**

as the legal/full company name.

---

# 7.5 Candidate Matching

The system should search for the user's Neo ID in:

- Email body
- Email subject
- XLSX/XLS attachments
- PDF attachments
- Extracted text
- DOC/DOCX attachments where supported

### Example

Neo ID:

`A6S2A7G9`

If the MUFG shortlist contains:

```text
Neo ID
A6S2A7G9
N4N6U8K1
Z1F9S6E0
...
```

the system marks the user as present in that candidate list.

---

# 7.6 Excel Processing

The application must support candidate-list spreadsheets.

### Processing

1. Download attachment.
2. Detect spreadsheet format.
3. Read worksheets.
4. Search all cells for Neo ID.
5. Identify relevant company/context.
6. Record matching evidence.
7. Store a reference to the source attachment.

### Result

```text
MUFG
Neo ID: A6S2A7G9
Candidate list: FOUND
Source: MUFG Initial Shortlist.xlsx
```

---

# 7.7 PDF/JD Processing

For JDs and placement documents:

Extract:

- Company
- Role
- CTC
- Internship stipend
- Full-time package
- Location
- Eligibility
- Branches
- CGPA requirements
- Backlog requirements
- Registration deadline
- Job description

The original file should remain accessible.

---

# 7.8 Event Extraction

Extract placement events from emails.

Supported event types:

- Registration Deadline
- PPT
- Online Test
- Coding Test
- Technical Interview
- HR Interview
- Final Interview
- Result
- Joining Date

Each event should contain:

```text
event_type
company_id
date
start_time
end_time
venue
mode
source_email_id
confidence
```

Example:

```text
MUFG
PPT
11 Aug 2026
11:30 AM
Campus venue
```

---

# 7.9 Status Engine

The application should maintain a canonical status separate from NeoPAT's displayed status.

### Suggested statuses

- Not Applied
- Applied
- Shortlisted
- PPT Scheduled
- Test Scheduled
- Interview Scheduled
- Selected
- Rejected
- Withdrawn
- Declined
- Offer Received
- Unknown

### Status Priority

More recent and stronger evidence should override weaker/older evidence.

Example:

```text
NeoPAT:
Applied

Later VIT email:
Registration Withdrawn

Canonical status:
Withdrawn
```

---

# 7.10 Source Evidence

Every automatically generated piece of information should retain its source.

Example:

```text
Status: Withdrawn

Source:
VIT Gmail
"Euler Motors Drive Registration Update"
4 Aug 2026
```

This is important because automated extraction can occasionally be wrong.

Users should be able to open the source email/attachment.

---

# 7.11 Dashboard

Main dashboard should display:

### Summary

```text
Total Companies       28
Active Applications   10
Shortlisted            6
Upcoming Tests         3
Upcoming Interviews    2
Rejected               8
Withdrawn              5
```

### Upcoming Events

Sorted chronologically.

Example:

```text
MUFG
Test
13 Aug · 2:30 PM

MUFG
Interview
14 Aug · 10:00 AM
```

### Company Table

Columns:

- Company
- Role
- Status
- CTC
- Location
- Next Event
- Neo ID Match
- JD
- Last Updated

---

# 8. Company Detail Page

Clicking a company should open a complete timeline.

Example:

```text
MUFG
Mitsubishi UFJ Financial Group

Status: Interview Scheduled

Neo ID: A6S2A7G9
Candidate List: ✓ Found

────────────────────────

Timeline

7 Aug
Registration

10 Aug
Candidate shortlist

11 Aug
PPT — 11:30 AM

13 Aug
Test — 2:30 PM

14 Aug
Interview — 10:00 AM

────────────────────────

Role
Software / Data / Cybersecurity etc.

CTC
...

JD
[Open Document]

Source Emails
[View Registration Email]
[View PPT Email]
[View Shortlist]
```

---

# 9. Manual Controls

Automatic extraction should never lock the user out of making corrections.

Users should be able to:

- Change company status.
- Edit company name.
- Edit role.
- Add/remove events.
- Add notes.
- Upload a JD manually.
- Mark an email as relevant/irrelevant.
- Correct an incorrectly detected Neo ID match.
- Ignore a company permanently.

Manual edits should take precedence over automated updates unless explicitly reset.

---

# 10. Database Design

Suggested PostgreSQL/Supabase schema.

## users

```text
id
name
neo_id
created_at
updated_at
```

## gmail_accounts

```text
id
user_id
email
account_type
google_account_id
access_token
refresh_token
token_expiry
created_at
updated_at
```

`account_type`:

- personal
- college

Tokens must be encrypted/securely stored.

---

## companies

```text
id
name
legal_name
aliases
status
role
ctc
stipend
location
manual_override
created_at
updated_at
```

---

## applications

```text
id
user_id
company_id
neo_id
status
status_source
status_confidence
applied_at
last_updated
notes
```

---

## emails

```text
id
gmail_account_id
gmail_message_id
thread_id
sender
subject
received_at
body_text
classification
processed_at
created_at
```

Do not store unnecessary email content indefinitely.

---

## attachments

```text
id
email_id
filename
mime_type
storage_path
file_hash
processed
created_at
```

---

## candidate_matches

```text
id
application_id
attachment_id
neo_id
match_type
matched_value
confidence
created_at
```

---

## events

```text
id
company_id
application_id
event_type
start_time
end_time
venue
mode
source_email_id
confidence
manual_override
created_at
updated_at
```

---

## documents

```text
id
company_id
application_id
document_type
filename
storage_path
source_email_id
created_at
```

Document types:

- JD
- shortlist
- company_info
- other

---

# 11. Status Resolution Logic

The status engine should combine multiple evidence sources.

### Example

```text
NeoPAT:
Applied

VIT email:
Candidate shortlisted

VIT email:
Test scheduled

Result:
Test Scheduled
```

Later:

```text
VIT email:
Registration withdrawn
```

Result:

```text
Withdrawn
```

### General Rule

Use:

1. Explicit latest status
2. Candidate-specific evidence
3. Latest event
4. Older registration status
5. NeoPAT status

The system should preserve all historical evidence rather than deleting old states.

---

# 12. Sync Architecture

## Phase 1

Manual:

```text
User clicks Sync
        ↓
Gmail API
        ↓
Fetch relevant emails
        ↓
Parse
        ↓
Process attachments
        ↓
Update PostgreSQL
        ↓
Dashboard refresh
```

## Phase 2

Automatic:

```text
Gmail
  ↓
Google Pub/Sub
  ↓
Webhook
  ↓
Sync Worker
  ↓
Parser
  ↓
Database
  ↓
Dashboard
```

---

# 13. Recommended Tech Stack

### Frontend

- Next.js 15+
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend

Option A:

- Next.js API routes/server actions

Option B:

- FastAPI

Prefer Option A for the first version unless document processing becomes complex.

### Database

- Supabase PostgreSQL

### Authentication

- Google OAuth

### Email

- Gmail API

### File Processing

- `openpyxl` for XLSX
- `pandas` where useful
- PDF text extraction library
- DOCX parser

### AI

Optional:

- Gemini API

Use AI primarily for:
- ambiguous company detection
- extracting poorly structured placement details
- classifying unusual emails

---

# 14. Security & Privacy

This application handles highly sensitive email data.

Requirements:

- Never expose Gmail tokens to the frontend.
- Encrypt sensitive credentials.
- Use HTTPS.
- Use least-privilege OAuth scopes.
- Do not send email contents to an AI provider unless necessary and explicitly allowed.
- Allow account disconnect/revocation.
- Allow deletion of stored email/document data.
- Do not expose private emails in logs.
- Do not commit credentials or OAuth secrets to Git.
- Use environment variables for secrets.
- Implement proper authorization on every database request.

---

# 15. Error Handling

The system should gracefully handle:

### Gmail errors

- Expired token
- Revoked permission
- API rate limits
- Temporary API failures

### Attachment errors

- Unsupported format
- Corrupted file
- Password-protected file
- Empty spreadsheet
- Scanned PDF

### Parsing errors

- Unknown company
- Ambiguous date
- Multiple dates
- Missing Neo ID
- Different date formats

When uncertain, mark the field:

```text
Unknown
```

rather than inventing a value.

---

# 16. Duplicate Detection

The system must prevent duplicates.

### Email

Use:

```text
gmail_message_id
```

### Attachment

Use:

```text
SHA-256 file hash
```

### Company

Normalize:

```text
MUFG
Mitsubishi UFJ Financial Group
MUFG (Mitsubishi UFJ Financial Group)
```

into one company record.

---

# 17. Search & Filtering

Dashboard filters:

- Status
- Company
- Role
- Location
- CTC
- Upcoming event
- Applied/Not Applied
- Shortlisted
- Interview
- Rejected
- Withdrawn

Search should support:

- Company
- Neo ID
- Role
- Email subject
- Event

---

# 18. Calendar View

Provide a calendar showing:

- PPTs
- Tests
- Interviews
- Registration deadlines

Use different visual indicators for event types.

Optional future feature:

- Google Calendar integration.

---

# 19. Notifications

Future feature.

Notify the user when:

- A new company is detected.
- The user appears in a shortlist.
- A test is scheduled.
- An interview is scheduled.
- A deadline is approaching.
- Status changes to rejected/withdrawn/selected.

Initial implementation can simply display notifications inside the dashboard.

---

# 20. MVP Scope

The first working version should contain only:

### Must Have

- Google OAuth
- Connect both Gmail accounts
- Neo ID input
- Manual Sync
- Placement email detection
- Company extraction
- Status tracking
- Neo ID search
- XLSX candidate-list matching
- Basic event extraction
- JD attachment storage
- Dashboard
- Company detail page
- Source email references

### Should Have

- PDF extraction
- Manual overrides
- Search/filter
- Timeline
- Calendar
- Duplicate detection

### Later

- Gmail push notifications
- AI extraction fallback
- Google Calendar
- Browser extension
- Mobile/PWA
- Advanced analytics

---

# 21. MVP Acceptance Criteria

The MVP is successful if the application can:

1. Connect to both Gmail accounts.
2. Retrieve relevant placement emails.
3. Identify MUFG from the provided example emails.
4. Identify the student's Neo ID.
5. Find the Neo ID inside the MUFG shortlist XLSX.
6. Mark the candidate as present in the shortlist.
7. Extract MUFG PPT/test/interview dates from the VIT email.
8. Store the MUFG JD attachment.
9. Display MUFG as one company instead of multiple duplicate records.
10. Display the current canonical status.
11. Show the source email/document for extracted information.
12. Allow the user to manually correct incorrect data.
13. Sync new emails without creating duplicates.

---

# 22. Example End-to-End Flow

### Step 1

User signs in with Google.

### Step 2

User connects:

```text
Personal Gmail
arushn.2005@gmail.com

College Gmail
arush.23bce10472@vitbhopal.ac.in
```

### Step 3

User enters:

```text
Neo ID: A6S2A7G9
```

### Step 4

Application performs initial sync.

### Step 5

It discovers MUFG emails.

### Step 6

It finds:

```text
MUFG Initial Shortlist.xlsx
```

### Step 7

It searches the spreadsheet.

```text
A6S2A7G9 → FOUND
```

### Step 8

It processes the VIT schedule email.

```text
PPT       → 11 Aug, 11:30 AM
Test      → 13 Aug, 2:30 PM
Interview → 14 Aug, 10:00 AM
```

### Step 9

Dashboard becomes:

```text
MUFG
────────────────────────
Status: Interview Scheduled
Neo ID: A6S2A7G9 ✓

PPT        11 Aug · 11:30
Test       13 Aug · 14:30
Interview  14 Aug · 10:00

JD ✓
Shortlist ✓
```

---

# 23. Future Enhancements

- Automatic Gmail synchronization.
- Google Calendar integration.
- Browser extension for NeoPAT.
- NeoPAT status comparison.
- Placement analytics.
- CTC comparison.
- Application success-rate statistics.
- Interview preparation notes per company.
- AI-generated company preparation checklist.
- Resume version tracking.
- Offer comparison.
- Multi-user support.

---

# 24. Success Metric

The product succeeds if the user can open one dashboard and immediately answer:

> **Which companies am I actually active in?**

> **Which companies have rejected/withdrawn me?**

> **Which tests/interviews are coming up?**

> **Was I shortlisted?**

> **Where is the JD?**

> **What happened with this company, and which email proves it?**

without manually searching NeoPAT and two Gmail inboxes.
