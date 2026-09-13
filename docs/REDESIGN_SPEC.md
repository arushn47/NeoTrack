# Product & Design Specification: "Where's My Offer" (formerly NeoTrack)

---

## 1. Executive Summary & Brand Identity

- **Product Name**: **Where's My Offer**
- **Tagline**: *From chaotic CDC circulars to your final offer letter — tracked in real time.*
- **Core Mission**: Relieve the intense anxiety and cognitive overload of engineering campus placements by aggregating personal & college Gmail inboxes, parsing unstructured circulars and Excel shortlist attachments, and displaying every student's placement pipeline in one clean, actionable dashboard.
- **Brand Archetype & Inspiration**: The *"Where's My Train"* for campus placement season. Fast, reliable, utilitarian, built by students for students, cutting through administrative college noise.

---

## 2. Target User Persona

### Primary Persona: *"The Stressed Final-Year Engineering Student"*
- **Demographics**: 20–22 years old, 7th/8th-semester B.Tech/B.E. student (Tier 1/Tier 2 Indian university, e.g., VIT, SRM, Manipal, Thapar, etc.).
- **Environment**: Intense 3-month campus placement season (July to October). Hundreds of companies visiting in parallel.
- **Daily Behavioral Patterns**:
  - Wakes up to 30+ new unread emails across two different inboxes (Personal Gmail + Official College Gmail).
  - Constantly monitors college WhatsApp groups and Telegram channels where students scream: *"Shortlist out for Amazon! Check mail!"*
  - Panics downloading 15 MB Excel spreadsheets with 4,000 student registration IDs on their phone, squinting to search their roll number (`21BCE1234`).
  - Frequently misses crucial test links, PPT schedules, or 8:00 AM reporting times due to email clutter.
  - Anxious about status: *"Did I apply? Did my registration go through? Am I shortlisted? When is the interview? Where's my offer?"*
- **Psychological Drivers**:
  - High stakes: First job, career validation, peer pressure, parental expectations.
  - Time sensitivity: 12-hour windows to register or confirm attendance.
  - Trust deficit: Frustrated with clunky, ugly university portals and bureaucratic communication.

---

## 3. Core Problems & How the App Solves Them

| The Chaos Today | "Where's My Offer" Solution |
| :--- | :--- |
| **Dual Inbox Fragmentation**: Official CDC emails arrive on personal Gmail; drive schedules and test circulars arrive on college Gmail. | **Unified Dual Gmail Engine**: Connects both accounts securely and correlates them into one unified timeline. |
| **Excel Spreadsheet Agony**: Shortlists are sent as Excel attachments (`.xlsx`/`.xls`) containing thousands of candidate IDs. | **Automated Excel Scanner**: Extracts candidate tables, searches the user's Neo/Registration ID, and automatically flips their status to `Shortlisted`. |
| **Silent Missed Rounds**: Test links and interview calls get buried under general announcements. | **Smart Assessment Detection & Calendar Sync**: Highlights upcoming PPTs, test windows, and interviews, automatically syncing with Google Calendar. |
| **Uncertain Application State**: No single place to see what stage a student is in across 50+ company drives. | **Canonical Kanban/List Pipeline**: Tracks every company across clean states: `Not Applied` → `Applied` → `Shortlisted` → `Test Scheduled` → `Interview` → `Offer Received` / `Rejected` / `Withdrawn`. |

---

## 4. Key Application Views & Information Architecture

### 1. Landing / Onboarding Page (`/login`)
- **Purpose**: Fast, trustworthy Google OAuth login.
- **Key Elements**:
  - Hero section explaining the value proposition in 5 seconds.
  - Clear trust indicators: *"Read-Only Gmail Access"*, *"AES-256 Encrypted Tokens"*, *"Runs 100% locally or on secure personal cloud"*.
  - Step-by-step onboarding flow: Connect Personal Gmail → Connect College Gmail → Enter Student Roll/Registration ID.

### 2. Main Dashboard & Pipeline View (`/`)
- **Top Bar**:
  - Live Sync Status Pill (`Idle` / `Syncing Page X of Y...` / `Up to date`).
  - Global Search Bar (instant fuzzy lookup for company names, roles, CTCs).
  - Filter Bar (Status filters: *All, Applied, Shortlisted, In Progress, Offers, Archive*).
- **Placement Funnel Metrics**:
  - Quick summary cards: Total Drives, Active Applications, Upcoming Tests/Interviews, Shortlists, Offers Won.
- **Company Pipeline List / Cards**:
  - **Company Identity**: Logo/Avatar, Company Name, Category tag (*Super Dream, Dream, Regular*).
  - **Role & Compensation**: Role Title (*e.g., Software Engineer*), CTC (*e.g., ₹18 LPA*), Stipend (*e.g., ₹60k/month*).
  - **Status Chip**: High-contrast, color-coded badges (`Applied`, `Shortlisted`, `Test Scheduled`, `Interview`, `Offer`, `Withdrawn`).
  - **Next Event Preview**: Upcoming test time or venue with countdown badge (*e.g., "Online Test in 4 hours"*).
  - **Quick Actions**: View circular timeline, open original email, manual status override.

### 3. Company Detail & Timeline Drilldown (`/companies/[id]`)
- **Header**: Company metadata, CTC breakdown, role details, eligibility criteria, and work location.
- **Status Stepper**: Visual progression bar showing current stage in the company's recruitment cycle.
- **Email & Circular Timeline**:
  - Chronological history of every communication received for this company (JD announcements, test invites, shortlist Excel releases, interview links).
  - Expandable email snippets with one-click view of matched shortlist evidence.
- **Scheduled Rounds & Notes**:
  - Round breakdown (Round 1: Coding, Round 2: Technical Interview, etc.).
  - Travel/Reporting requirements extracted from circulars (*e.g., "Report to TT Lab 3 at 9:00 AM"*).

### 4. Placement Calendar & Schedule (`/calendar`)
- **View Modes**: Month, Week, and Agenda/List view.
- **Color-Coded Event Tags**:
  - 🔵 Pre-Placement Talks (PPT)
  - 🟡 Online / Offline Assessments (Tests)
  - 🟢 Technical & HR Interviews
- **Google Calendar Integration**: Instant toggle to synchronize with primary Google Calendar.

### 5. Analytics & Placement Insights (`/analytics`)
- Visual breakdown of placement season progress:
  - Application-to-Shortlist ratio.
  - CTC distribution histogram.
  - Timeline chart of company drive volume over the season.

### 6. Settings & Integrations (`/settings`)
- Connected Gmail accounts status (Personal & College).
- Student Neo/Registration ID configuration.
- Notification preferences (push alerts for shortlists, morning digest).
- Danger Zone: Re-sync archive, reset placement cache.

---

## 5. UI/UX Design Direction & Aesthetic Standards

### Core Aesthetic: *"Modern Mission-Control Utility"*
- **Theme**: Dark mode first (rich slate/zinc background `#09090b` or `#0e1117`), high contrast, sleek and distraction-free.
- **Typography**: Clean, tech-forward sans-serif (Inter, Outfit, or Geist Sans) with tabular numbers for dates, times, and CTC values.
- **Color Palette**:
  - Primary Accent: Electric Indigo / Cyan (`#6366f1` / `#06b6d4`)
  - Success / Offer: Emerald Green (`#10b981`)
  - Warning / Upcoming Test: Amber / Orange (`#f59e0b`)
  - Shortlisted: Vibrant Violet / Purple (`#8b5cf6`)
  - Terminal / Inactive: Muted Slate / Zinc (`#71717a`)
- **Components**:
  - **Micro-animations**: Subtle transitions on status updates, confetti on `Offer Received`.
  - **Information Density**: Compact yet breathable. Students want to see 10–15 companies per screen on desktop without excessive scrolling.
  - **Mobile Responsive**: Over 60% of students check this on their phone right before entering an exam hall — mobile view must be lightning-fast and thumb-friendly.
