---
phase: 05-booking-system
plan: 02
subsystem: api
tags: [booking, state-machine, supabase-rpc, conversational-flow, feature-flags]

# Dependency graph
requires:
  - phase: 05-01
    provides: lib/booking/types.ts with BookingState, FacilityType, FACILITY_LOCATION_CONSTRAINTS, FACILITY_LABELS, LOCATION_LABELS — plus facilities_config table and check_and_create_booking RPC migration

provides:
  - handleBookingFlow — 6-step conversational booking state machine (facility, location, datetime, details, summary, confirmed)
  - isBookingExpired — 30-minute TTL check for booking sessions
  - checkAndCreateBooking — atomic RPC wrapper for double-booking prevention
  - findNextAvailableSlots — RPC wrapper for alternative slot discovery
  - getAvailableSlots — capacity-aware slot query for a given date
  - app/api/chat/[botId]/route.ts extended with booking intercept at two points (active state before intent detection; new session after detection)

affects:
  - 05-03 (SQL migrations for check_and_create_booking and find_next_available_slots RPCs)
  - 05-04 (admin dashboard for booking management)
  - 05-06 (end-to-end booking tests)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Booking state persisted in conversations.metadata jsonb as { booking: BookingState }
    - Active booking state checked BEFORE intent detection to prevent misclassification of "yes", "1", "confirm"
    - New book_session intents checked AFTER intent detection
    - Feature flag booking_enabled gates all booking code — platform remains reusable for non-booking clients
    - off-topic messages during booking answered by RAG then re-prompted with current step
    - on_loan_unit field used as temporary slot list storage during datetime step

key-files:
  created:
    - lib/booking/slot-checker.ts
    - lib/booking/state-machine.ts
  modified:
    - app/api/chat/[botId]/route.ts

key-decisions:
  - "Active booking state checked before intent detection — booking answers (yes, 1, confirm) would be misclassified by intent detector"
  - "Off-topic during booking: call RAG for the off-topic question, then append re-prompt for current booking step — state is preserved"
  - "on_loan_unit (string | null) field reused as temporary slot JSON storage during datetime step to avoid schema changes"
  - "Booking responses are plain text (not streaming) — pre-written prompts, not Claude-generated content"
  - "feature_flags.booking_enabled must be true on the bot for any booking code to run"

patterns-established:
  - "Booking intercept pattern: check existing state (step 5b) before intent detection, check new intent (step 6b) after"
  - "State machine always persists via conversations.metadata; null state = booking complete or cancelled"
  - "RPC calls for atomic operations; direct table queries for read-only slot availability"

requirements-completed:
  - BOOK-01
  - BOOK-03
  - BOOK-04
  - BOOK-05
  - BOOK-07
  - BOOK-08
  - BOOK-10
  - BOOK-11
  - BOOK-12

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 5 Plan 02: Booking State Machine Summary

**Conversational 6-step booking flow (facility → location → datetime → details → summary → confirm) with RPC-backed atomic slot checking, 30-min TTL, off-topic preservation, and feature-flagged chat route integration**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-22T07:35:26Z
- **Completed:** 2026-03-22T07:39:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Built `lib/booking/slot-checker.ts` with three exported functions: `checkAndCreateBooking` (RPC for atomic double-booking prevention), `findNextAvailableSlots` (RPC for alternative discovery), `getAvailableSlots` (capacity-aware slot query for a given date)
- Built `lib/booking/state-machine.ts` with `handleBookingFlow` (routes all 6 steps) and `isBookingExpired` (30-min TTL); handles off-topic interrupts, meeting room member-only rejection, bed/inhaler gender routing, and full member/non-member confirmation message branching
- Extended `app/api/chat/[botId]/route.ts` with two booking intercept points: active state before intent detection (step 5b) and new book_session after detection (step 6b); feature flag check gates all booking code; booking responses returned as plain text (not streaming)

## Task Commits

1. **Task 1: Build booking state machine and slot checker** - `a18ce01` (feat)
2. **Task 2: Integrate booking state machine into chat endpoint** - `9a8c61c` (feat)

**Plan metadata:** (committed with docs commit below)

## Files Created/Modified

- `lib/booking/slot-checker.ts` - Three slot management functions using Supabase RPC and direct table queries
- `lib/booking/state-machine.ts` - Core booking conversation handler with 6-step flow, TTL, off-topic handling, path branching, and state persistence
- `app/api/chat/[botId]/route.ts` - Extended with booking feature_flags check, booking state retrieval (step 4b), active-state intercept (step 5b), new-session trigger (step 6b)

## Decisions Made

- **Active state before intent detection:** Booking answers ("yes", "1", "3", "confirm") would be classified as `general` by the intent detector. By checking booking state first (step 5b), the state machine handles all messages when a session is active.
- **off-topic handling:** Rather than silently ignoring off-topic messages, the state machine calls the RAG pipeline (Haiku, 512 tokens) and appends the current step re-prompt. State is preserved unchanged.
- **on_loan_unit reuse:** The `on_loan_unit: string | null` field from `BookingState` is repurposed to hold the JSON-serialised available-slots array during the `datetime` step. This avoids schema changes; the field is cleared when moving to the `details` step.
- **Plain text responses:** Booking prompts are pre-written strings, not Claude-generated. Returning them as plain `Response` (not `ReadableStream`) avoids unnecessary streaming complexity and prevents partial-message display.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no new external service configuration required. The check_and_create_booking and find_next_available_slots RPC functions are expected to exist from Plan 01 (or will be verified/created in Plan 03).

## Next Phase Readiness

- Booking state machine is complete and integrated
- The chat endpoint will route `book_session` intents to the state machine when `feature_flags.booking_enabled` is true
- Plan 03 (SQL migrations) must confirm that `check_and_create_booking` and `find_next_available_slots` RPCs exist in Supabase
- Plan 04 (admin dashboard) can proceed independently

---
*Phase: 05-booking-system*
*Completed: 2026-03-22*
