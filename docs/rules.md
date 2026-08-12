# Rules — NeoPAT Placement Tracker

## 1. General AI Coding Rules

### DO

- Always follow the architecture defined in `architecture.md`.
- Always follow the phased approach in `phases.md`.
- Always check `memory.md` for the latest project state before making changes.
- Write TypeScript for all frontend/API code — no plain JavaScript.
- Write Python for all parser-service code.
- Use descriptive variable and function names.
- Add JSDoc/TSDoc comments for all exported functions and complex logic.
- Add Python docstrings for all public functions and classes.
- Handle errors explicitly — never silently swallow exceptions.
- Write small, focused functions (< 50 lines preferred).
- Use early returns to reduce nesting.
- Log important operations (sync, parsing, errors) for debugging.

### DON'T

- Don't create files outside the folder structure defined in `architecture.md` without asking.
- Don't install new packages without stating the reason and confirming it's necessary.
- Don't refactor existing working code unless asked.
- Don't add features from later phases — stick to the current phase.
- Don't use `any` type in TypeScript — use `unknown` and narrow types.
- Don't commit secrets, tokens, or API keys.
- Don't store unencrypted OAuth tokens.
- Don't expose server-side environment variables to the client.
- Don't use `console.log` for production code — use a structured logger.
- Don't make assumptions about email format — always handle edge cases.

---

## 2. Frontend Rules (Next.js / React)

### Framework

- Use **Next.js 15+ App Router** — no Pages Router.
- Use **Server Components** by default; only use `"use client"` when interactive state is needed.
- Use **Server Actions** for form mutations where applicable.
- Use **React 19** features (use, useFormStatus, useOptimistic) where beneficial.

### Styling

- Use **Tailwind CSS v4** for all styling.
- Use **shadcn/ui** components as the base UI library.
- Do NOT use inline `style={{}}` attributes.
- Do NOT use CSS modules or styled-components.
- Keep custom CSS minimal — prefer Tailwind utility classes.
- Follow the design system defined in `design.md` for colors, fonts, spacing.

### Components

- One component per file.
- Component files use PascalCase: `StatsCards.tsx` → export `StatsCards`.
- Keep components small and focused (< 150 lines).
- Extract reusable UI into `components/shared/`.
- Use `components/ui/` only for shadcn/ui generated components — don't manually edit them.

### State Management

- Use **React Server Components** for data fetching (preferred).
- Use **Zustand** for global client state (sync status, UI state).
- Use **React Query / SWR** for client-side data caching (if needed beyond server components).
- Avoid prop drilling > 2 levels — use context or Zustand.

### Forms & Validation

- Use **React Hook Form** + **Zod** for form validation.
- Validate on both client and server.
- Display inline error messages, not alerts.

### Error Handling (Frontend)

- Use Next.js `error.tsx` boundary files for page-level errors.
- Use `loading.tsx` for page-level loading states.
- Use skeleton loaders (not spinners) for content loading.
- Show toast notifications for async operation results (sync success/failure).

---

## 3. Backend Rules (Next.js API Routes)

### API Design

- Use RESTful conventions: `GET` for reads, `POST` for creates, `PATCH` for updates, `DELETE` for deletes.
- Return consistent JSON response shapes:
  ```json
  { "data": ..., "error": null }
  { "data": null, "error": { "message": "...", "code": "..." } }
  ```
- Use proper HTTP status codes (200, 201, 400, 401, 403, 404, 500).
- Validate all incoming request bodies with Zod.
- Rate limit sync endpoints to prevent Gmail API abuse.

### Authentication

- Verify user session on every protected API route.
- Never trust client-side auth state alone.
- Use HTTP-only cookies for session management.
- Encrypt OAuth tokens before storing in database.
- Decrypt tokens only when needed for Gmail API calls.

### Gmail API

- Use `googleapis` npm package.
- Use `gmail.readonly` scope only — never request write access.
- Implement exponential backoff for rate limit errors (429).
- Handle token expiry gracefully — auto-refresh before API calls.
- Page through results (Gmail API returns max 100 per request).
- Store `gmail_message_id` to prevent reprocessing.

### Database Access

- Always use Supabase server client (`createClient` with service role for sync operations).
- Use parameterized queries — never concatenate user input into SQL.
- Use RLS policies as a second layer of defense (don't rely solely on RLS).
- Use transactions for multi-table operations during sync.

---

## 4. Parser Service Rules (FastAPI / Python)

### Framework

- Use **FastAPI** with **Pydantic v2** models.
- Use async handlers where possible.
- Use **uvicorn** as the ASGI server.

### Security

- Require API key header (`X-API-Key`) on all endpoints.
- Validate file types before processing — reject unexpected MIME types.
- Set maximum file size limits (10MB per attachment).
- Run in a container with minimal permissions.

### Document Processing

- **XLSX**: Use `openpyxl` for reading. Iterate all sheets and cells for Neo ID search.
- **PDF**: Use `pdfplumber` for text extraction. Fall back to OCR warning (don't implement OCR in MVP).
- **DOCX**: Use `python-docx` for text extraction.
- **Hashing**: Use SHA-256 to hash every attachment for deduplication.

### Error Handling (Parser)

- Never crash on malformed files — return a structured error response.
- Log the filename and error type for debugging.
- Return `confidence` scores with extracted data.
- If a file can't be parsed, return `{ "success": false, "error": "...", "partial_data": ... }`.

### AI Fallback (Gemini)

- Use Gemini API **only** when deterministic parsing fails.
- Always mark AI-extracted data with `confidence: "ai"` or similar.
- Include the prompt used and response received in logs.
- Don't send entire email bodies to Gemini — extract relevant sections first.
- Cache AI results — don't re-query for the same content.

---

## 5. Database Rules

### Migrations

- All schema changes go through Supabase migration files.
- Migration files are numbered sequentially: `001_`, `002_`, etc.
- Never modify existing migration files — create new ones for changes.
- Every migration should be reversible (include `DOWN` migration).

### Data Integrity

- Use foreign keys for all relationships.
- Use `ON DELETE CASCADE` for child records (e.g., emails → attachments).
- Use `ON DELETE SET NULL` where orphaning is acceptable.
- Use ENUM types or CHECK constraints for status fields.
- Use `UNIQUE` constraints on `gmail_message_id`, `file_hash`, etc.

### Naming Conventions

- Tables: `snake_case`, plural (e.g., `companies`, `applications`).
- Columns: `snake_case` (e.g., `company_id`, `created_at`).
- Indexes: `idx_{table}_{column}` (e.g., `idx_emails_gmail_message_id`).
- Constraints: `{table}_{column}_{type}` (e.g., `applications_status_check`).

---

## 6. Email Processing Rules

### Classification Priority

1. **Subject line keywords** (highest priority — most reliable).
2. **Sender address patterns** (e.g., `noreply@neopat.com`, `placement@vitbhopal.ac.in`).
3. **Body keywords** (secondary).
4. **Gemini AI** (last resort, only for truly ambiguous emails).

### Company Name Normalization

- Strip common suffixes: "Pvt Ltd", "Private Limited", "Inc", "Corp", "Ltd", "LLP".
- Normalize whitespace and casing.
- Maintain an alias table for known abbreviations (e.g., MUFG = Mitsubishi UFJ Financial Group).
- If a company can't be confidently identified, mark it as `Unknown` — never guess.

### Date Parsing

- Support common Indian date formats: `DD/MM/YYYY`, `DD-MM-YYYY`, `DD Mon YYYY`, `Month DD, YYYY`.
- Always store dates in UTC with timezone info.
- If time is missing, store as `00:00:00` and mark `time_confidence: "low"`.
- If date is ambiguous (e.g., `02/03/2026`), prefer DD/MM/YYYY (Indian format) but flag for review.

### Neo ID Matching

- Neo ID format: 8 alphanumeric characters (e.g., `A6S2A7G9`).
- Search case-insensitively.
- Match exact string — no partial matches.
- Search across all cells in XLSX, all text in PDF/DOCX.
- Record the exact cell/location where the match was found.

---

## 7. Testing Rules

### Unit Tests

- Test all utility functions (parsers, classifiers, extractors).
- Test status engine with various evidence combinations.
- Test company name normalization with edge cases.
- Use Jest for TypeScript tests, pytest for Python tests.

### Integration Tests

- Test OAuth flow with mock Google responses.
- Test sync pipeline with sample emails.
- Test attachment processing with sample files.

### Manual Testing

- Test with real Gmail accounts before deploying.
- Verify dashboard displays correctly with 0, 1, 10, and 50+ companies.
- Test sync with duplicate emails.
- Test manual override persistence.

---

## 8. Git Rules

- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Branch naming: `feature/`, `fix/`, `refactor/`.
- Don't commit `.env.local`, `node_modules/`, `__pycache__/`, `.next/`.
- Include `.env.example` with all required variables (no values).
- PR descriptions should reference the phase and feature being implemented.

---

## 9. Performance Rules

- Keep initial page load under 3 seconds.
- Use React Suspense boundaries for progressive loading.
- Lazy load the calendar view and company detail timeline.
- Paginate company table (20 per page).
- Use database indexes for all frequently queried columns.
- Don't fetch full email bodies for the dashboard — only metadata.
- Cache parsed attachment results — never re-parse unchanged files.

---

## 10. Accessibility Rules

- All interactive elements must be keyboard accessible.
- Use semantic HTML (`<main>`, `<nav>`, `<section>`, `<article>`).
- All images must have `alt` text.
- Use ARIA labels for icon-only buttons.
- Maintain sufficient color contrast (WCAG AA minimum).
- Focus indicators must be visible.
