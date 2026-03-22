---
phase: 05-booking-system
plan: "01"
subsystem: database
tags: [postgres, supabase, plpgsql, rls, shadcn, typescript]

requires:
  - phase: 01-data-foundation
    provides: bots table, conversations table, RLS helper functions (is_super_admin, jwt_tenant_id)
  - phase: 04-admin-dashboard
    provides: shadcn/ui initialized with new-york style, components.json configured

provides:
  - bookings table with all required columns (audit_log jsonb, notification tracking fields)
  - facilities_config table with configurable capacity, duration, cutoff rules per facility type
  - check_and_create_booking RPC with SELECT FOR UPDATE double-booking prevention
  - update_booking_status RPC for atomic status changes with audit log appending
  - update_booking_fields RPC for staff booking edits with audit trail
  - find_next_available_slots RPC returning next N slots with business hours filter
  - RLS policies on bookings and facilities_config (tenant-scoped)
  - TypeScript types: BookingState, BookingStep, FacilityType, BookingLocation, BookingStatus, Booking, FacilityConfig, StepResult, AuditLogEntry
  - Constants: FACILITY_LABELS, FACILITY_LOCATION_CONSTRAINTS, LOCATION_LABELS
  - 6 new shadcn components: sheet, select, popover, calendar, textarea, separator

affects: [05-02, 05-03, 05-04, 05-05, 05-06]

tech-stack:
  added:
    - react-day-picker (calendar component dependency via shadcn)
    - @radix-ui/react-select (via shadcn select)
    - @radix-ui/react-popover (via shadcn popover)
    - @radix-ui/react-dialog (via shadcn sheet)
    - @radix-ui/react-separator (via shadcn separator)
  patterns:
    - PL/pgSQL SECURITY DEFINER functions for atomic DB operations (SELECT FOR UPDATE)
    - Audit log append pattern using jsonb || operator (never read-modify-write)
    - Business hours slot filtering in PL/pgSQL using AT TIME ZONE 'Asia/Kuala_Lumpur'
    - Partial indexes for efficient notification dispatch queries (reminder_sent, survey_sent)

key-files:
  created:
    - supabase/migrations/00010_bookings.sql
    - lib/booking/types.ts
    - components/ui/sheet.tsx
    - components/ui/select.tsx
    - components/ui/popover.tsx
    - components/ui/calendar.tsx
    - components/ui/textarea.tsx
    - components/ui/separator.tsx
  modified:
    - components/ui/button.tsx (updated by calendar shadcn install)
    - package.json
    - package-lock.json

key-decisions:
  - "facilities_config as separate table (not jsonb on bots): enables per-row RLS, proper indexing, and simpler admin UI queries for 6 facility types each with 4 config fields"
  - "find_next_available_slots uses AT TIME ZONE 'Asia/Kuala_Lumpur' for business hours check (09:00-18:00) — hardcoded to Malaysia timezone as all GenQi locations are in KL/Subang"
  - "check_and_create_booking guards against missing facilities_config with NOT FOUND check returning no_config reason — prevents crash for non-Elken bots"
  - "shadcn calendar required --overwrite flag due to button.tsx already existing — updated button.tsx is acceptable (new-york style variant changes)"

patterns-established:
  - "Pattern: SECURITY DEFINER RPC for all booking mutations — ensures slot locking and audit appending run with table owner permissions regardless of caller role"
  - "Pattern: Partial indexes for cron dispatch queries — idx_bookings_reminder and idx_bookings_survey filter pre-computed subsets, making 15-min cron queries O(1) as bookings scale"

requirements-completed: [BOOK-02, BOOK-06, BOOK-09, BOOK-13, BADM-06, NOTIF-04]

duration: 3min
completed: 2026-03-22
---

# Phase 5 Plan 01: Booking Schema Foundation Summary

**Booking system database layer: 2-table schema, 4 PL/pgSQL RPCs with SELECT FOR UPDATE slot locking and append-only audit log, RLS policies, and 6 shadcn UI components installed**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T04:05:03Z
- **Completed:** 2026-03-22T04:07:44Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Created complete booking system schema (00010_bookings.sql) with facilities_config and bookings tables, 6 indexes, and full RLS tenant isolation
- Implemented 4 PL/pgSQL RPCs: check_and_create_booking (atomic slot lock + gender conflict check), update_booking_status, update_booking_fields, find_next_available_slots
- Created lib/booking/types.ts with all TypeScript contracts for the state machine and downstream plans
- Installed 6 shadcn/ui components (sheet, select, popover, calendar, textarea, separator) required by admin booking UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Create booking schema migration with RPC functions** - `00dcae0` (feat)
2. **Task 2: Create TypeScript types and install shadcn components** - `05007da` (feat)

## Files Created/Modified

- `supabase/migrations/00010_bookings.sql` - Full booking schema: 2 tables, 6 indexes, 4 RPCs, RLS policies, n8n_outbound_webhook column on bots
- `lib/booking/types.ts` - All TypeScript types and constants for the booking system
- `components/ui/sheet.tsx` - Side panel for booking audit trail (BADM-07)
- `components/ui/select.tsx` - Facility/location/status dropdowns
- `components/ui/popover.tsx` - Date picker container
- `components/ui/calendar.tsx` - Date picker for admin walk-in registration
- `components/ui/textarea.tsx` - Notes field for booking edits
- `components/ui/separator.tsx` - Visual separators in booking UI

## Decisions Made

- `facilities_config` as a separate table (not jsonb on `bots`) — enables per-row RLS, proper indexing, and simpler admin UI queries; 6 facility types each with 4 configurable fields warrant a normalized table
- `find_next_available_slots` hardcodes `Asia/Kuala_Lumpur` timezone for business hours check — all GenQi locations are in Malaysia; making this configurable would add complexity without benefit for v1
- `check_and_create_booking` returns `no_config` reason if facilities_config row is missing — prevents silent crash for bots that don't have booking configured (aligns with BOOK-pitfall-5)
- shadcn calendar install required `--overwrite` flag — button.tsx was pre-existing from Phase 4; the updated button.tsx uses new-york style variants which is compatible

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `npx shadcn@latest add calendar --yes` prompted for button.tsx overwrite despite `--yes` flag — resolved by adding `--overwrite` flag on the retry. No content change needed; calendar's button dependency is compatible.

## User Setup Required

None — no external service configuration required. Migration will be applied when `supabase db push` is run (handled in a later plan's deployment step).

## Next Phase Readiness

- Database schema is complete and ready for application code in plans 05-02 through 05-06
- TypeScript types in `lib/booking/types.ts` provide contracts for state machine (05-02) and admin API (05-04)
- All 6 shadcn components available for admin booking UI (05-05)
- `check_and_create_booking` RPC is the mandatory path for all booking creation — application code in 05-02 and 05-04 must use `supabase.rpc()` exclusively, never direct `.insert()`

---
*Phase: 05-booking-system*
*Completed: 2026-03-22*
