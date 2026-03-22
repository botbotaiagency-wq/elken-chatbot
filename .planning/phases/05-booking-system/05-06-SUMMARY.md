---
phase: 05-booking-system
plan: "06"
subsystem: api
tags: [booking, survey, next.js, supabase, tailwind, calendar]

# Dependency graph
requires:
  - phase: 05-booking-system/05-02
    provides: booking state machine, slot checker, notifications lib
  - phase: 05-booking-system/05-04
    provides: bookings admin API, facilities config, notification dispatch cron
  - phase: 05-booking-system/05-05
    provides: bookings dashboard UI, facilities booking config page

provides:
  - Survey response capture endpoint (POST /api/bookings/[botId]/survey)
  - Full Phase 5 build verified — all 32 routes compile without errors
  - Fixed Tailwind v4 CSS incompatibility in calendar component (Turbopack)
  - Fixed export const dynamic incompatibility with cacheComponents

affects: [phase-06, phase-07, n8n-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Survey response stored as jsonb on booking record (survey_response column)
    - Lookup by bookingId or userId (most recent survey_sent=true, survey_response=null)
    - Await params pattern for Next.js 16 in survey route

key-files:
  created:
    - app/api/bookings/[botId]/survey/route.ts
  modified:
    - app/api/notifications/dispatch/route.ts
    - components/ui/calendar.tsx

key-decisions:
  - "Survey lookup allows bookingId OR userId — n8n can pass either depending on workflow design"
  - "Removed export const dynamic from cron dispatch route — incompatible with cacheComponents: true in next.config.ts"
  - "calendar.tsx [--cell-size:--spacing(8)] replaced with [--cell-size:2rem] — Tailwind v3 does not support v4 spacing function syntax"

patterns-established:
  - "Survey endpoint: lookup → update survey_response jsonb with {rating, feedback, submitted_at}"

requirements-completed:
  - BOOK-17
  - BOOK-14
  - BADM-01
  - BADM-02
  - BADM-03
  - BADM-04
  - BADM-05
  - BADM-06
  - BADM-07
  - BOOK-01
  - BOOK-03
  - BOOK-04
  - BOOK-05
  - BOOK-07
  - BOOK-08
  - BOOK-09
  - BOOK-10
  - BOOK-11
  - BOOK-12
  - BOOK-13
  - BOOK-15
  - BOOK-16
  - NOTIF-01
  - NOTIF-02
  - NOTIF-03
  - NOTIF-04

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 05 Plan 06: Survey Endpoint and Build Verification Summary

**POST /api/bookings/[botId]/survey captures customer feedback into bookings.survey_response jsonb, with full Phase 5 build verified across all 32 routes**

## Performance

- **Duration:** 4min
- **Started:** 2026-03-22T09:35:57Z
- **Completed:** 2026-03-22T09:40:26Z
- **Tasks:** 1
- **Files modified:** 3 (1 created, 2 fixed)

## Accomplishments
- Created survey response endpoint accepting POST with bookingId/userId + rating/feedback
- Resolved 2 pre-existing build-blocking issues that would have failed CI (Turbopack CSS parse, dynamic export incompatibility)
- Full `npx next build` passes — 32 routes compiled, TypeScript clean, all Phase 5 files connected

## Task Commits

Each task was committed atomically:

1. **Task 1: Create survey response endpoint and verify build** - `65a598b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `app/api/bookings/[botId]/survey/route.ts` - Survey capture endpoint; lookup by bookingId or userId, updates survey_response jsonb
- `app/api/notifications/dispatch/route.ts` - Removed `export const dynamic = 'force-dynamic'` (incompatible with cacheComponents)
- `components/ui/calendar.tsx` - Replaced `[--cell-size:--spacing(8)]` with `[--cell-size:2rem]` for Tailwind v3 compatibility

## Decisions Made
- Survey lookup supports both bookingId (direct) and userId (finds most recent survey_sent=true with no response) — gives n8n workflow flexibility in which identifier to pass
- Removed `export const dynamic` rather than disabling `cacheComponents` — cacheComponents is a core architectural decision from Phase 1 (STATE.md) and must be preserved
- Fixed `[--cell-size:2rem]` instead of `[--cell-size:32px]` to stay in rem units consistent with Tailwind spacing scale

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed incompatible `export const dynamic` from dispatch route**
- **Found during:** Task 1 (full build verification)
- **Issue:** `export const dynamic = 'force-dynamic'` is rejected by Next.js 16 when `cacheComponents: true` is set in next.config.ts
- **Fix:** Removed the export from `app/api/notifications/dispatch/route.ts`; the route's cron guard logic is unaffected
- **Files modified:** app/api/notifications/dispatch/route.ts
- **Verification:** Build error gone; route still appears as dynamic (ƒ) in build output
- **Committed in:** 65a598b (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Tailwind v4 CSS syntax in calendar.tsx for Turbopack**
- **Found during:** Task 1 (full build verification)
- **Issue:** `[--cell-size:--spacing(8)]` in calendar.tsx generates `var(--spacing(8))` which is Tailwind v4 syntax; Turbopack's CSS parser rejects it ("Unexpected token Function")
- **Fix:** Replaced with `[--cell-size:2rem]` — equivalent value (Tailwind spacing-8 = 2rem) using standard CSS
- **Files modified:** components/ui/calendar.tsx
- **Verification:** Build CSS parsing error gone; calendar component renders identically
- **Committed in:** 65a598b (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for build to succeed. Calendar and cron dispatch remain functionally identical. No scope creep.

## Issues Encountered
- Both build errors were pre-existing in Phase 5 code from earlier plans; this build verification step was the right moment to surface and fix them.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 5 booking system code is integrated and compiles cleanly
- Survey endpoint is live at POST /api/bookings/[botId]/survey
- n8n can call the survey endpoint when a customer replies to the survey message
- Phase 6 (or Phase 7 n8n integration) can proceed without any Phase 5 blockers

---
*Phase: 05-booking-system*
*Completed: 2026-03-22*
