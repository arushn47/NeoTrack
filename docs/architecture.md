# Architecture — NeoPAT Placement Tracker

## 1. System Overview

NeoPAT Placement Tracker is a **hybrid fullstack application** consisting of:

1. **Next.js 15+ Frontend & API Layer** — Dashboard UI, Google OAuth, Gmail API integration, and lightweight API routes.
2. **FastAPI Microservice** — Document processing engine for XLSX/PDF/DOCX parsing, Neo ID matching, and AI-assisted extraction.
3. **Supabase** — Managed PostgreSQL database, file storage (for attachments/JDs), and Row Level Security.
4. **External Services** — Gmail API, Google OAuth 2.0, Gemini API (optional).

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                               │
│  Next.js 15 App Router (React 19, TypeScript)               │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │Dashboard│ │ Company  │ │Calendar  │ │   Settings    │   │
│  │  Page   │ │  Detail  │ │  View    │ │  & Accounts   │   │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘   │
│       └───────────┴────────────┴───────────────┘            │
│                         │                                    │
│              Server Components + Actions                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────────┐
│  Next.js    │  │   FastAPI    │  │    Supabase      │
│  API Routes │  │  Microservice│  │  (PostgreSQL +   │
│             │  │              │  │   Storage)        │
│ • OAuth     │  │ • XLSX parse │  │                   │
│ • Gmail API │  │ • PDF parse  │  │ • companies       │
│ • Sync      │  │ • DOCX parse │  │ • applications    │
│ • Dashboard │  │ • Neo ID     │  │ • emails          │
│   queries   │  │   matching   │  │ • events          │
│             │  │ • AI fallback│  │ • attachments     │
│             │  │   (Gemini)   │  │ • documents       │
└──────┬──────┘  └──────┬───────┘  │ • candidate_match │
       │                │          └────────┬──────────┘
       │                │                   │
       └────────────────┴───────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼                           ▼
   ┌─────────────┐            ┌─────────────┐
   │  Gmail API  │            │ Gemini API  │
   │  (Google)   │            │ (Optional)  │
   └─────────────┘            └─────────────┘
```

---

## 3. Data Flow

### 3.1 Authentication Flow

```
User → "Sign in with Google" → Google OAuth 2.0 Consent Screen
     → Access Token + Refresh Token returned
     → Tokens encrypted and stored in Supabase (gmail_accounts)
     → User redirected to Dashboard
```

### 3.2 Email Sync Flow (Manual — Phase 1)

```
User clicks "Sync"
     │
     ▼
Next.js API Route: /api/sync
     │
     ├─→ Fetch emails via Gmail API (search queries for placement keywords)
     │   └─→ Store raw email metadata in `emails` table
     │
     ├─→ For each email:
     │   ├─→ Classify email (deterministic rules first)
     │   ├─→ Extract company name
     │   ├─→ Extract events (dates, times, venues)
     │   └─→ Upsert into `companies`, `applications`, `events`
     │
     ├─→ For attachments:
     │   ├─→ Download attachment via Gmail API
     │   ├─→ Upload to Supabase Storage
     │   ├─→ Send to FastAPI for processing
     │   │   ├─→ XLSX → Parse cells → Search for Neo ID
     │   │   ├─→ PDF → Extract text → Parse JD fields / Search Neo ID
     │   │   └─→ DOCX → Extract text → Parse JD fields
     │   └─→ Store results in `candidate_matches`, `documents`
     │
     └─→ Run Status Engine → Compute canonical status per company
```

### 3.3 Email Sync Flow (Automatic — Phase 2)

```
Gmail → Google Pub/Sub → Webhook (Next.js API Route)
     → Same processing pipeline as above
     → Push notification to client (WebSocket or polling)
```

---

## 4. Tech Stack

### Frontend

| Technology       | Version  | Purpose                        |
|------------------|----------|--------------------------------|
| Next.js          | 15+      | React framework, App Router    |
| React            | 19+      | UI library                     |
| TypeScript       | 5.x      | Type safety                    |
| Tailwind CSS     | 4.x      | Styling framework              |
| shadcn/ui        | latest   | Component library (Radix-based)|
| Lucide Icons     | latest   | Icon set                       |
| date-fns         | latest   | Date formatting/manipulation   |
| Recharts         | latest   | Charts/analytics (later)       |
| Zustand          | latest   | Client state management        |

### Backend — Next.js API Layer

| Technology         | Purpose                              |
|--------------------|--------------------------------------|
| Next.js API Routes | REST endpoints                       |
| Server Actions     | Form submissions, mutations          |
| googleapis         | Gmail API client                     |
| @supabase/supabase-js | Database client                  |
| jose               | JWT handling                         |
| crypto (Node)      | Token encryption                     |

### Backend — FastAPI Microservice

| Technology       | Purpose                              |
|------------------|--------------------------------------|
| FastAPI          | Python HTTP framework                |
| openpyxl         | XLSX parsing                         |
| pandas           | Tabular data processing              |
| pdfplumber       | PDF text extraction                  |
| python-docx      | DOCX parsing                         |
| google-generativeai | Gemini API (optional AI fallback) |
| pydantic         | Request/response validation          |
| uvicorn          | ASGI server                          |

### Database & Storage

| Technology       | Purpose                              |
|------------------|--------------------------------------|
| Supabase         | Managed PostgreSQL + Storage         |
| Supabase Auth    | OAuth token management (optional)    |
| Supabase Storage | Attachment/JD file storage           |

### Deployment

| Service          | Component                            |
|------------------|--------------------------------------|
| Vercel           | Next.js frontend + API routes        |
| Railway / Render | FastAPI microservice                  |
| Supabase Cloud   | Database + Storage                   |

---

## 5. Folder Structure

```
job-tracker/
├── .env.local                    # Environment variables (gitignored)
├── .env.example                  # Template for environment variables
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout (fonts, providers, theme)
│   │   ├── page.tsx              # Landing / Auth page
│   │   ├── globals.css           # Global styles + Tailwind imports
│   │   │
│   │   ├── (auth)/               # Auth route group
│   │   │   ├── login/page.tsx
│   │   │   └── callback/page.tsx # OAuth callback handler
│   │   │
│   │   ├── (dashboard)/          # Dashboard route group (protected)
│   │   │   ├── layout.tsx        # Dashboard shell (sidebar, topbar)
│   │   │   ├── page.tsx          # Main dashboard
│   │   │   ├── companies/
│   │   │   │   ├── page.tsx      # All companies list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx  # Company detail + timeline
│   │   │   ├── calendar/
│   │   │   │   └── page.tsx      # Calendar view
│   │   │   ├── search/
│   │   │   │   └── page.tsx      # Search & filter
│   │   │   └── settings/
│   │   │       └── page.tsx      # Accounts, Neo ID, preferences
│   │   │
│   │   └── api/                  # API Routes
│   │       ├── auth/
│   │       │   ├── google/route.ts       # Initiate OAuth
│   │       │   ├── callback/route.ts     # Handle OAuth callback
│   │       │   └── disconnect/route.ts   # Revoke account
│   │       ├── sync/
│   │       │   ├── route.ts              # Trigger manual sync
│   │       │   └── status/route.ts       # Sync progress
│   │       ├── companies/
│   │       │   ├── route.ts              # List/create companies
│   │       │   └── [id]/route.ts         # Get/update company
│   │       ├── applications/
│   │       │   └── [id]/route.ts         # Update application
│   │       ├── events/
│   │       │   └── route.ts              # List events
│   │       └── documents/
│   │           └── [id]/route.ts         # Download document
│   │
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui components (auto-generated)
│   │   ├── dashboard/
│   │   │   ├── stats-cards.tsx
│   │   │   ├── upcoming-events.tsx
│   │   │   ├── company-table.tsx
│   │   │   └── sync-button.tsx
│   │   ├── company/
│   │   │   ├── company-header.tsx
│   │   │   ├── company-timeline.tsx
│   │   │   ├── company-details.tsx
│   │   │   └── source-evidence.tsx
│   │   ├── calendar/
│   │   │   └── event-calendar.tsx
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   └── mobile-nav.tsx
│   │   └── shared/
│   │       ├── status-badge.tsx
│   │       ├── neo-id-badge.tsx
│   │       ├── loading-skeleton.tsx
│   │       └── empty-state.tsx
│   │
│   ├── lib/                      # Core utilities
│   │   ├── supabase/
│   │   │   ├── client.ts         # Browser Supabase client
│   │   │   ├── server.ts         # Server Supabase client
│   │   │   └── admin.ts          # Service-role client (for sync)
│   │   ├── gmail/
│   │   │   ├── client.ts         # Gmail API wrapper
│   │   │   ├── queries.ts        # Search queries for placement emails
│   │   │   └── parser.ts         # Email body parser
│   │   ├── sync/
│   │   │   ├── orchestrator.ts   # Main sync coordinator
│   │   │   ├── classifier.ts     # Email classification engine
│   │   │   ├── company-detector.ts # Company name extraction
│   │   │   ├── event-extractor.ts  # Date/time/venue extraction
│   │   │   └── status-engine.ts    # Canonical status resolution
│   │   ├── crypto/
│   │   │   └── tokens.ts         # Token encryption/decryption
│   │   └── utils.ts              # General helpers
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-sync.ts
│   │   ├── use-companies.ts
│   │   └── use-events.ts
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── database.ts           # Supabase generated types
│   │   ├── gmail.ts              # Gmail API types
│   │   ├── company.ts
│   │   ├── event.ts
│   │   └── sync.ts
│   │
│   └── constants/                # App constants
│       ├── statuses.ts           # Application status enum
│       ├── event-types.ts        # Event type enum
│       └── email-rules.ts        # Classification rules/keywords
│
├── supabase/                     # Supabase project config
│   ├── migrations/               # SQL migration files
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_gmail_accounts.sql
│   │   ├── 003_create_companies.sql
│   │   ├── 004_create_applications.sql
│   │   ├── 005_create_emails.sql
│   │   ├── 006_create_attachments.sql
│   │   ├── 007_create_candidate_matches.sql
│   │   ├── 008_create_events.sql
│   │   ├── 009_create_documents.sql
│   │   └── 010_create_rls_policies.sql
│   └── seed.sql                  # Optional seed data
│
├── parser-service/               # FastAPI microservice
│   ├── main.py                   # FastAPI app entry point
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── routers/
│   │   ├── xlsx.py               # XLSX parsing endpoints
│   │   ├── pdf.py                # PDF parsing endpoints
│   │   └── docx.py               # DOCX parsing endpoints
│   ├── services/
│   │   ├── xlsx_parser.py        # XLSX processing logic
│   │   ├── pdf_parser.py         # PDF text extraction + JD parsing
│   │   ├── docx_parser.py        # DOCX text extraction
│   │   ├── neo_id_matcher.py     # Neo ID search across all formats
│   │   └── ai_extractor.py       # Gemini API fallback
│   ├── models/
│   │   ├── requests.py           # Pydantic request models
│   │   └── responses.py          # Pydantic response models
│   └── utils/
│       └── file_utils.py         # File download/hash utilities
│
├── docs/                         # Project documentation
│   ├── prd.md
│   ├── architecture.md           # This file
│   ├── rules.md
│   ├── phases.md
│   ├── design.md
│   └── memory.md
│
└── public/                       # Static assets
    ├── logo.svg
    └── og-image.png
```

---

## 6. Database Schema (Supabase PostgreSQL)

> Detailed schema is in `prd.md` Section 10. Key additions for architecture:

### Indexes

```sql
-- Fast email lookup
CREATE INDEX idx_emails_gmail_message_id ON emails(gmail_message_id);
CREATE INDEX idx_emails_classification ON emails(classification);

-- Fast company queries
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_name ON companies(name);

-- Fast application lookups
CREATE INDEX idx_applications_user_company ON applications(user_id, company_id);
CREATE INDEX idx_applications_status ON applications(status);

-- Fast event queries (upcoming events)
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_company ON events(company_id);

-- Fast Neo ID matching
CREATE INDEX idx_candidate_matches_neo_id ON candidate_matches(neo_id);
```

### Row Level Security (RLS)

Every table will have RLS enabled. Users can only access their own data:

```sql
CREATE POLICY "Users can only view own applications"
  ON applications FOR SELECT
  USING (user_id = auth.uid());
```

---

## 7. API Design

### Next.js API Routes

| Method | Route                        | Purpose                      |
|--------|------------------------------|------------------------------|
| GET    | `/api/auth/google`           | Initiate OAuth flow          |
| GET    | `/api/auth/callback`         | Handle OAuth callback        |
| POST   | `/api/auth/disconnect`       | Revoke Gmail account         |
| POST   | `/api/sync`                  | Trigger manual sync          |
| GET    | `/api/sync/status`           | Get sync progress            |
| GET    | `/api/companies`             | List companies (with filters)|
| GET    | `/api/companies/[id]`        | Company detail + timeline    |
| PATCH  | `/api/companies/[id]`        | Manual override              |
| PATCH  | `/api/applications/[id]`     | Update application status    |
| GET    | `/api/events`                | List upcoming events         |
| GET    | `/api/documents/[id]`        | Download document/attachment |
| GET    | `/api/dashboard/stats`       | Dashboard summary stats      |

### FastAPI Microservice

| Method | Route                        | Purpose                          |
|--------|------------------------------|----------------------------------|
| POST   | `/parse/xlsx`                | Parse XLSX, search for Neo ID    |
| POST   | `/parse/pdf`                 | Extract text from PDF            |
| POST   | `/parse/docx`                | Extract text from DOCX           |
| POST   | `/parse/jd`                  | Extract structured JD fields     |
| POST   | `/match/neo-id`              | Search Neo ID in parsed content  |
| POST   | `/classify/email`            | AI-assisted email classification |
| GET    | `/health`                    | Health check                     |

---

## 8. Authentication & Security

### OAuth Flow

```
1. User clicks "Connect Gmail"
2. Redirect to Google OAuth consent screen
   - Scopes: gmail.readonly, userinfo.email, userinfo.profile
3. Google redirects to /api/auth/callback with authorization code
4. Server exchanges code for access_token + refresh_token
5. Encrypt tokens with AES-256-GCM using server-side key
6. Store encrypted tokens in gmail_accounts table
7. Set HTTP-only session cookie
```

### Token Management

- Access tokens expire in ~1 hour → auto-refresh using refresh_token
- Refresh tokens stored encrypted in Supabase
- Token decryption only happens server-side
- Failed refresh → prompt user to re-authenticate

---

## 9. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Encryption
TOKEN_ENCRYPTION_KEY=          # 32-byte hex key for AES-256

# FastAPI Parser Service
PARSER_SERVICE_URL=            # URL of the FastAPI microservice
PARSER_SERVICE_API_KEY=        # Shared secret for service-to-service auth

# Gemini (Optional)
GEMINI_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

---

## 10. Deployment Architecture

```
                    ┌──────────────┐
                    │   Vercel     │
                    │  (Next.js)   │
                    │              │
                    │ • Frontend   │
                    │ • API Routes │
                    │ • OAuth      │
                    │ • Gmail API  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
     ┌──────────────┐         ┌──────────────┐
     │   Railway    │         │   Supabase   │
     │  (FastAPI)   │         │   Cloud      │
     │              │         │              │
     │ • Doc Parser │         │ • PostgreSQL │
     │ • Neo Match  │         │ • Storage    │
     │ • AI Extract │         │ • RLS        │
     └──────────────┘         └──────────────┘
```

### Vercel Configuration

- **Framework**: Next.js (auto-detected)
- **Build Command**: `next build`
- **Node.js Version**: 20.x
- **Environment Variables**: All secrets configured in Vercel dashboard

### Railway Configuration

- **Dockerfile deployment**
- **Internal networking** for service-to-service communication
- **Auto-scaling** based on request volume
- **Health check** endpoint: `/health`

---

## 11. Key Architectural Decisions

### Why Hybrid (Next.js + FastAPI)?

- **Next.js** excels at UI rendering, OAuth flows, and lightweight API routes
- **FastAPI (Python)** has superior libraries for document processing (`openpyxl`, `pdfplumber`, `python-docx`, `pandas`)
- Keeps the Next.js deployment lightweight on Vercel (no heavy Python deps)
- Allows independent scaling of the parser service

### Why Supabase?

- Managed PostgreSQL with zero ops overhead
- Built-in Row Level Security
- Object storage for attachments
- Free tier is generous for a personal project
- Real-time subscriptions (useful for future push notifications)

### Why Server-Side Gmail API?

- Tokens never exposed to the client
- Rate limiting handled server-side
- Attachment downloads happen server-to-server
- Better security posture

---

## 12. Performance Considerations

- **Email Sync**: Paginated Gmail API queries (max 100 per request)
- **Attachment Processing**: Async queue pattern — sync endpoint returns immediately, processing happens in background
- **Dashboard Queries**: Materialized views or denormalized summary table for stats
- **Caching**: React Query / SWR for client-side caching with stale-while-revalidate
- **Neo ID Search**: Pre-indexed in candidate_matches table, not re-parsed on every dashboard load
