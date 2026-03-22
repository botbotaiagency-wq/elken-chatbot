---
phase: 05-booking-system
plan: "04"
subsystem: booking-ui
tags: [bookings, dashboard, facility-config, sheet, dialog, filters]
dependency_graph:
  requires: ["05-01", "05-03"]
  provides: ["booking-management-ui", "facility-config-ui"]
  affects: ["app/dashboard/bookings", "app/dashboard/bots/[botId]/booking"]
tech_stack:
  added: []
  patterns:
    - "Bot selector pattern before scoped data fetch"
    - "Inline confirm rows (bg-destructive/5) for destructive actions"
    - "Sheet side panel for booking detail + audit trail"
    - "Filter bar with Select + date range inputs driving refetch"
    - "facilities API using upsert with onConflict for atomic saves"
key_files:
  created:
    - app/dashboard/bookings/page.tsx
    - app/dashboard/bots/[botId]/booking/page.tsx
    - app/api/bots/[botId]/facilities/route.ts
  modified:
    - app/dashboard/bots/[botId]/layout.tsx
decisions:
  - "Bot selector shown at top of /dashboard/bookings — bookings are per-bot so a bot must be selected before data loads"
  - "facilities POST uses upsert with onConflict: bot_id,facility_type — atomic save-all pattern for all 6 rows"
  - "n8n_outbound_webhook save uses /api/config/[botId]/webhook endpoint — follows existing config API pattern from Phase 4"
  - "booking_enabled toggle uses /api/config/[botId]/feature-flags endpoint — consistent with Phase 4 feature flag management"
metrics:
  duration: "~3.5 minutes"
  completed: "2026-03-22"
  tasks_completed: 2
  files_changed: 4
---

# Phase 05 Plan 04: Booking Management UI Summary

Staff-facing bookings management page and facility configuration page: filterable table with 5 status badges, inline confirm/cancel/no-show rows, walk-in Dialog, booking detail Sheet with audit trail and edit mode, plus per-facility-type config with capacity/duration/cutoff rules and n8n webhook URL.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Build bookings management page | 7d9f39e | app/dashboard/bookings/page.tsx |
| 2 | Build facility config page and add Booking tab | 5dd3d70 | app/dashboard/bots/[botId]/booking/page.tsx, app/dashboard/bots/[botId]/layout.tsx, app/api/bots/[botId]/facilities/route.ts |

## What Was Built

**Bookings Management Page (`/dashboard/bookings`):**
- Bot selector dropdown at page top — bookings fetch only after a bot is selected
- Filter bar: Location, Status, Facility type (Select components) + date From/To range (Input type="date")
- Bookings table with 6 columns: Customer (name + contact), Facility, Location, Date/Time, Status, Actions
- 5 status badge colors: amber=pending, green=confirmed, red=cancelled, gray=no-show, blue=walk-in
- Inline confirm rows with `bg-destructive/5` class for Confirm, Cancel, and No-show actions
- All inline copy matches UI-SPEC: "Confirm this booking? A confirmation message will be sent to the customer.", "Cancel this booking? This cannot be undone.", "Mark this booking as no-show? The customer will not receive a survey."
- Walk-in Registration Dialog: all 8 fields (Name, Member ID, Contact, Member Status, Facility, Location, DateTime, Notes); location auto-selects when facility constraints are single; submit calls POST /api/bookings/[botId]
- Booking Detail Sheet: display grid with all booking fields; edit mode replaces spans with Input/Select; "Save Changes" calls PATCH with action='edit'; audit trail with scrollable entries; notification status badges for reminder_sent and survey_sent (green=Sent, default=Pending, red=Failed after 3 retries)
- Toast messages: "Walk-in registered successfully.", "Booking confirmed. Customer will be notified.", "Booking cancelled.", "Marked as no-show.", "Booking updated.", "Something went wrong. Please try again."

**Facility Configuration Page (`/dashboard/bots/[botId]/booking`):**
- "Booking Module" card with checkbox to toggle `feature_flags.booking_enabled`
- "Facility Types" card with table of all 6 facility types; each value cell is Input type="number"; "Save Booking Config" button upserts all rows
- "Notification Webhook" card with Input for n8n_outbound_webhook URL; helper text matches UI-SPEC verbatim

**API Route (`/api/bots/[botId]/facilities`):**
- GET: fetches all `facilities_config` rows for the bot using service client
- POST: upserts all 6 rows using `onConflict: 'bot_id,facility_type'`; validates all facility types present in request

**Bot Layout Update:**
- "Booking" tab added to `app/dashboard/bots/[botId]/layout.tsx` TABS array; follows existing `pathname.startsWith(href)` active state pattern

## Deviations from Plan

**1. [Rule 2 - Missing feature] Walk-in location auto-selection from FACILITY_LOCATION_CONSTRAINTS**
- The plan specified "auto-select if only one option" for walk-in location select
- Implemented `handleWalkInFacilityChange` that reads `FACILITY_LOCATION_CONSTRAINTS` and auto-selects single-option locations (e.g., bed_unisex → Subang only; room_small/room_large → OKR only)
- Select is `disabled` when only one location is valid
- Files modified: app/dashboard/bookings/page.tsx
- Commit: 7d9f39e

None of the other deviations required — plan executed as specified.

## Self-Check: PASSED

- FOUND: app/dashboard/bookings/page.tsx
- FOUND: app/dashboard/bots/[botId]/booking/page.tsx
- FOUND: app/api/bots/[botId]/facilities/route.ts
- FOUND commit: 7d9f39e (bookings management page)
- FOUND commit: 5dd3d70 (facility config page + bot layout + facilities API)
