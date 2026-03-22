---
phase: 05-booking-system
plan: "05"
subsystem: infra
tags: [vercel-cron, notifications, n8n, next-js, supabase]

# Dependency graph
requires:
  - phase: 05-01
    provides: bookings table schema with reminder_sent, survey_sent, reminder_retry_count, survey_retry_count fields
  - phase: 05-03
    provides: dispatchNotification function in lib/booking/notifications.ts

provides:
  - Vercel Cron target GET /api/notifications/dispatch running every 15 minutes
  - Automated 24-hour reminder dispatch for confirmed bookings
  - Automated post-session survey dispatch for completed bookings
  - Retry tracking with 3-attempt cap per notification type
  - vercel.json cron schedule configuration

affects:
  - 05-booking-system (completes NOTIF-02, NOTIF-03, NOTIF-04)
  - production deployment (requires CRON_SECRET env var in Vercel)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Vercel Cron with CRON_SECRET Bearer header validation
    - Environment guard (VERCEL_ENV !== production) to prevent accidental dispatch in preview/dev
    - Fire-and-forget retry pattern with max-attempt cap via database column

key-files:
  created:
    - app/api/notifications/dispatch/route.ts
    - vercel.json
  modified: []

key-decisions:
  - "export const dynamic = 'force-dynamic' prevents Next.js caching the cron endpoint"
  - "Reminder window is 23-25h before session_start — 2h window ensures the 15-min cron interval catches the 24h mark"
  - "Survey query uses status IN (confirmed, walk_in) and session_start < now() — no separate completed status needed"
  - "Non-production guard uses VERCEL_ENV presence check — local dev has no VERCEL_ENV, preview has VERCEL_ENV=preview"

patterns-established:
  - "Vercel Cron route: force-dynamic + Bearer CRON_SECRET validation + VERCEL_ENV guard"
  - "Retry pattern: query with retry_count < 3 filter, increment on fail, set sent flag on success"

requirements-completed: [NOTIF-02, NOTIF-03, NOTIF-04, BOOK-15, BOOK-16]

# Metrics
duration: 1min
completed: 2026-03-22
---

# Phase 05 Plan 05: Notification Dispatch Cron Summary

**Vercel Cron runs every 15 minutes calling /api/notifications/dispatch to auto-send 24h reminders and post-session surveys via n8n webhook with 3-attempt retry tracking**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-22T09:32:38Z
- **Completed:** 2026-03-22T09:33:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Cron dispatch route validates CRON_SECRET and skips non-production environments
- Reminders queried for confirmed bookings 23-25h before session_start, dispatched via n8n
- Surveys queried for confirmed/walk_in bookings where session has already started
- Retry count tracked per notification type; capped at 3 to prevent endless retries
- vercel.json configured with `*/15 * * * *` schedule pointing at dispatch path

## Task Commits

Each task was committed atomically:

1. **Task 1: Create notification dispatch cron route** - `01aa0ad` (feat)
2. **Task 2: Create vercel.json cron configuration** - `da2c277` (chore)

## Files Created/Modified

- `app/api/notifications/dispatch/route.ts` - Vercel Cron GET handler with auth, env guard, reminder + survey batch dispatch
- `vercel.json` - Cron schedule: /api/notifications/dispatch every 15 minutes

## Decisions Made

- `export const dynamic = 'force-dynamic'` is required to prevent Next.js caching the GET route — without it, Vercel would serve a stale cached response
- Reminder window is 23-25h (not exactly 24h) because the cron runs every 15 minutes; a 2h window guarantees one cron tick catches bookings at the 24h mark
- Non-production guard checks `VERCEL_ENV` presence: local dev has no variable so no guard fires, Vercel preview sets `VERCEL_ENV=preview` so guard fires and returns early — no production-only logic needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**CRON_SECRET must be set in Vercel project environment variables.** Vercel automatically passes this secret as the `Authorization: Bearer <CRON_SECRET>` header when invoking cron endpoints. Without it, every cron invocation will return 401.

Steps:
1. In Vercel dashboard → Project Settings → Environment Variables
2. Add `CRON_SECRET` with a strong random value (e.g., `openssl rand -hex 32`)
3. Redeploy for the variable to take effect

## Next Phase Readiness

- Automated notification pipeline is complete: confirmation (Plan 03), reminder (this plan), survey (this plan)
- All NOTIF-02, NOTIF-03, NOTIF-04, BOOK-15, BOOK-16 requirements fulfilled
- Plan 06 (bookings dashboard UI) can proceed — it reads from the same `bookings` table

---
*Phase: 05-booking-system*
*Completed: 2026-03-22*
