# NeoTrack Agent Context & Core Architecture Rules

## ⚠️ CRITICAL KNOWLEDGE: External Background Cron Job
- **Provider**: [cron-job.org](https://console.cron-job.org/jobs/8265126)
- **Job Title**: `NeoTrack 2-Hour Email Sync` (formerly `NeoTrack 15 Min Email Sync`)
- **Target URL**: `https://neopat-tracker.vercel.app/api/cron/sync`
- **Execution Schedule**: **Every 2 hours** (`0 */2 * * *`)
- **Status**: **ALWAYS ACTIVE IN THE BACKGROUND** (running 24/7 independently of local dev, Vercel cron, or browser sessions).

### Architectural Implications (DO NOT VIOLATE):
1. **Never Run Unlocked Syncs**: Because cron-job.org triggers `/api/cron/sync` every 15 minutes, long-running syncs (especially initial scans of 2,000+ emails) WILL overlap with the cron if concurrency locks are not enforced.
2. **Per-User Concurrency Locking**:
   - `runSync(userId)` MUST check if a sync is already active for that user before doing any work.
   - If `is_syncing === true` and the lock has not expired/gone stale, subsequent cron or manual requests MUST cleanly skip without crashing, interrupting, or corrupting state.
3. **No Unchecked Browser Auto-Sync Loops**: The client topbar MUST NOT blindly fire silent syncs on a short interval (e.g. 5 mins) while a sync is already running in background or from cron.
4. **State Persistence**: Sync progress must be stored in the database (`sync_state` table) and cached, so reloads or browser restarts can seamlessly restore and inspect progress without losing context.

---

## Placement Architecture & Sync Pipeline
- **Personal Gmail**: Official NeoPAT announcements (`noreply.cdcinfo@vitstudent.ac.in`). These are the master records for company creation and registration status.
- **College Gmail**: CDC circulars, eligibility sheets, CTC tables, test/interview schedules.
- **Onboarding Requirements**: Personal Gmail + College Gmail + NeoPAT Registration ID are mandatory before sync is unlocked.
