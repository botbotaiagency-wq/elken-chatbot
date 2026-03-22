---
phase: 05-booking-system
plan: 03
subsystem: api
tags: [supabase, rpc, n8n, webhook, bookings, admin, notifications]

# Dependency graph
requires:
  - phase: 05-01
    provides: lib/booking/types.ts (BookingStatus, FacilityType, FACILITY_LABELS), facilities_config table, check_and_create_booking RPC, update_booking_status RPC
  - phase: 05-02
    provides: update_booking_fields RPC, slot-checker patterns

provides:
  - Booking admin API at /api/bookings/[botId] (GET list, POST walk-in, PATCH status/edit)
  - n8n notification dispatcher at lib/booking/notifications.ts

affects:
  - 05-04-admin-bookings-ui (consumes this API)
  - 05-05-reminder-worker (uses dispatchNotification for reminder and survey types)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget n8n notification on confirm action — dispatchNotification().catch() after returning 200"
    - "Atomic walk-in registration via check_and_create_booking RPC (prevents double-booking)"
    - "Atomic status change via update_booking_status RPC (appends audit log transactionally)"
    - "Graceful webhook degradation — returns false (not throws) if n8n_outbound_webhook not configured"

key-files:
  created:
    - lib/booking/notifications.ts
    - app/api/bookings/[botId]/route.ts
  modified: []

key-decisions:
  - "Confirm action triggers notification fire-and-forget (not awaited) — response latency must not depend on n8n delivery"
  - "dispatchNotification returns boolean — caller decides retry policy, dispatcher never throws"
  - "Walk-in POST uses check_and_create_booking RPC with p_status='walk_in' — same atomic slot check as chatbot flow"
  - "PATCH edit action uses update_booking_fields RPC — keeps audit log appending in SQL, not JS"

patterns-established:
  - "Booking mutations always go through RPC functions (never direct INSERT/UPDATE) for audit log consistency"
  - "n8n webhook integration is fire-and-forget with .catch() error logging — non-blocking to API response"

requirements-completed: [BADM-03, BADM-04, BADM-05, BOOK-14, BOOK-09, BOOK-17, NOTIF-01]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 5 Plan 03: Booking Admin API Summary

**Booking admin REST API (GET/POST/PATCH) with atomic RPC mutations and fire-and-forget n8n confirmation notifications**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T09:21:56Z
- **Completed:** 2026-03-22T09:23:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `lib/booking/notifications.ts` dispatches confirmation/reminder/survey messages to n8n outbound webhook, using FACILITY_LABELS for friendly names and LOCATION_LABELS logic for location names
- `app/api/bookings/[botId]/route.ts` provides GET with 5-parameter filtering, POST walk-in via atomic RPC, and PATCH for confirm/cancel/no_show/edit via separate RPCs
- Confirm action triggers non-blocking n8n notification — staff see instant response, notification fires in background

## Task Commits

Each task was committed atomically:

1. **Task 1: Create notification dispatcher** - `03a293d` (feat)
2. **Task 2: Create booking admin API routes** - `fb1f5a8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `lib/booking/notifications.ts` — n8n outbound webhook dispatcher; exports dispatchNotification(botId, bookingId, type)
- `app/api/bookings/[botId]/route.ts` — Booking CRUD API; exports GET (list with filters), POST (walk-in), PATCH (status change + field edit)

## Decisions Made

- Confirm action fires dispatchNotification fire-and-forget (not awaited) — staff API response must never wait on n8n delivery latency
- dispatchNotification returns boolean, never throws — callers handle retry policy independently
- Walk-in POST reuses check_and_create_booking RPC with p_status='walk_in' — same atomic double-booking prevention as chatbot flow
- PATCH edit delegates to update_booking_fields RPC — audit log append stays in SQL for transactional consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `tests/api/products.test.ts` surfaced during tsc check — these are out of scope (pre-existing, unrelated to this plan's changes). No issues in new files.

## User Setup Required

None - no external service configuration required. n8n_outbound_webhook is already a column on the bots table (configured per-bot in admin UI).

## Next Phase Readiness

- Booking admin API fully operational — ready for 05-04 (admin bookings UI) to consume GET/POST/PATCH endpoints
- dispatchNotification is exported and ready for 05-05 (reminder/survey workers) to call with 'reminder' and 'survey' types
- No blockers

## Self-Check: PASSED

- lib/booking/notifications.ts: FOUND
- app/api/bookings/[botId]/route.ts: FOUND
- .planning/phases/05-booking-system/05-03-SUMMARY.md: FOUND
- Commit 03a293d (Task 1): FOUND
- Commit fb1f5a8 (Task 2): FOUND
- Commit be8136a (docs metadata): FOUND

---
*Phase: 05-booking-system*
*Completed: 2026-03-22*
