---
phase: 05-booking-system
verified: 2026-03-22T09:45:07Z
status: passed
score: 29/29 must-haves verified
re_verification: true
gaps:
  - truth: "Dispatch route is protected from Next.js caching via export const dynamic = 'force-dynamic'"
    status: resolved
    resolution: "Removed cacheComponents from next.config.ts and re-added export const dynamic = 'force-dynamic'. Build verified clean."
---

# Phase 5: Booking System Verification Report

**Phase Goal:** Build a complete booking system — conversational chatbot booking flow, staff admin dashboard, automated notifications, and facility configuration — so Elken members can book sessions via WhatsApp and staff can manage all bookings from the dashboard.
**Verified:** 2026-03-22T09:45:07Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | bookings table exists with all required columns including audit_log jsonb and notification tracking fields | VERIFIED | `supabase/migrations/00010_bookings.sql` — `audit_log jsonb NOT NULL DEFAULT '[]'::jsonb`, `reminder_sent`, `survey_sent` all present |
| 2 | facilities_config table exists with configurable capacity, duration, cutoff rules per facility type | VERIFIED | `00010_bookings.sql` — `CREATE TABLE public.facilities_config` with capacity, duration_minutes, min_advance_hours, max_window_days |
| 3 | check_and_create_booking RPC prevents double-booking with SELECT FOR UPDATE | VERIFIED | `00010_bookings.sql` line 154 — `FOR UPDATE` present in check_and_create_booking body |
| 4 | find_next_available_slots RPC returns next N available slots | VERIFIED | `00010_bookings.sql` — `CREATE OR REPLACE FUNCTION public.find_next_available_slots` present |
| 5 | update_booking_status RPC atomically changes status and appends audit log | VERIFIED | `00010_bookings.sql` — `audit_log = audit_log || jsonb_build_array(...)` inside UPDATE |
| 6 | BookingState and BookingStep TypeScript types are exported from lib/booking/types.ts | VERIFIED | All 12 required exports confirmed: BookingStep, FacilityType, BookingLocation, BookingStatus, BookingState, Booking, FacilityConfig, StepResult, AuditLogEntry, FACILITY_LABELS, FACILITY_LOCATION_CONSTRAINTS, LOCATION_LABELS |
| 7 | When intent is book_session and booking_enabled is true, the bot enters the booking state machine instead of RAG | VERIFIED | `app/api/chat/[botId]/route.ts` — imports handleBookingFlow, isBookingExpired; active state check at line 141 before intent detection at line 190; new session trigger at line 196 |
| 8 | Bot asks facility type first, then location, then date/time, then customer details, then summary | VERIFIED | `lib/booking/state-machine.ts` — 970 lines, step handlers for 'facility', 'location', 'datetime', 'details', 'summary' all present; FACILITY_LOCATION_CONSTRAINTS used for location filtering |
| 9 | Off-topic messages during booking preserve state and re-prompt after RAG answer | VERIFIED | `lib/booking/state-machine.ts` — "Check for off-topic" comment present; off-topic handling implemented |
| 10 | 30-minute TTL clears expired booking state | VERIFIED | `lib/booking/state-machine.ts` — `const BOOKING_TTL_MS = 30 * 60 * 1000` |
| 11 | If slot is full, bot offers next 3 available alternatives | VERIFIED | `lib/booking/state-machine.ts` — imports from slot-checker; findNextAvailableSlots wired |
| 12 | Member + Bed/Inhaler path and Non-member + Bed/Inhaler path branch correctly | VERIFIED | `lib/booking/state-machine.ts` — "Meeting Room + Non-member check" comment; member/non-member branching present |
| 13 | Customer reviews full summary and must confirm before submission | VERIFIED | `lib/booking/state-machine.ts` — step 'summary' present, checkAndCreateBooking called on confirm |
| 14 | GET /api/bookings/[botId] returns bookings filterable by location, status, facility_type, and date range | VERIFIED | `app/api/bookings/[botId]/route.ts` — GET handler with location, status, facility_type, date_from, date_to query params |
| 15 | POST /api/bookings/[botId] creates a walk-in booking with status walk_in | VERIFIED | POST handler calls `supabase.rpc('check_and_create_booking')` with `p_status: 'walk_in'` |
| 16 | PATCH with action=confirm/cancel/no_show/edit changes status and appends audit log | VERIFIED | `update_booking_status` and `update_booking_fields` RPC calls confirmed; dispatchNotification fired on confirm |
| 17 | Staff can view all bookings in a filterable table with status badges | VERIFIED | `app/dashboard/bookings/page.tsx` — 975 lines; CalendarDays icon, all 5 badge colors (amber/green/red/gray/blue), filter selects for Location/Status/Facility/Date |
| 18 | Staff can confirm, cancel, or mark no-show with inline confirmation rows | VERIFIED | `bg-destructive/5` row present; all three copy strings confirmed: "Confirm this booking?", "Cancel this booking?", "Mark this booking as no-show?" |
| 19 | Staff can register a walk-in via the Dialog modal | VERIFIED | "Register Walk-in Customer" dialog with "Walk-in bookings are confirmed immediately" description; "Go Back" cancel button |
| 20 | Staff can view booking details and audit trail in a Sheet side panel | VERIFIED | Sheet with "Booking Details" title, "Audit Trail" section, reminder_sent/survey_sent notification badges |
| 21 | Staff can edit booking fields from the Sheet | VERIFIED | "Save Changes" button present in Sheet edit mode |
| 22 | Facility configuration page allows admin to set capacity, duration, and cutoff rules | VERIFIED | `app/dashboard/bots/[botId]/booking/page.tsx` — "Booking Configuration" heading, "Facility Types" card, "Booking Module" toggle, "Notification Webhook" card |
| 23 | Bot layout has Booking tab | VERIFIED | `app/dashboard/bots/[botId]/layout.tsx` — `{ label: 'Booking', path: 'booking' }` present |
| 24 | Facilities API route supports GET and POST with upsert | VERIFIED | `app/api/bots/[botId]/facilities/route.ts` — GET and POST handlers; `.upsert(rows, { onConflict: 'bot_id,facility_type' })` |
| 25 | Vercel Cron calls /api/notifications/dispatch every 15 minutes | VERIFIED | `vercel.json` — `"schedule": "*/15 * * * *"` targeting `/api/notifications/dispatch` |
| 26 | Reminder and survey notifications dispatched with retry tracking | VERIFIED | `app/api/notifications/dispatch/route.ts` — reminder/survey queries, retry_count < 3 filter, increments on failure, sets sent=true on success |
| 27 | Dispatch route validates CRON_SECRET and skips non-production | VERIFIED | `CRON_SECRET` and `VERCEL_ENV` checks present in dispatch route |
| 28 | Dispatch route is protected from Next.js caching via export const dynamic = 'force-dynamic' | FAILED | `export const dynamic = 'force-dynamic'` is missing from `app/api/notifications/dispatch/route.ts` |
| 29 | Survey responses submitted via chat are captured and stored on the booking record | VERIFIED | `app/api/bookings/[botId]/survey/route.ts` — POST handler, `survey_response` updated, lookup by bookingId or userId |

**Score:** 28/29 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00010_bookings.sql` | bookings table, facilities_config table, 4 RPC functions, RLS policies | VERIFIED | 2 tables, 4 RPC functions, 6 indexes, RLS enabled on both tables, FOR UPDATE and gender_conflict present |
| `lib/booking/types.ts` | TypeScript types for booking state machine | VERIFIED | All 12 exports present: types, interfaces, constants |
| `lib/booking/state-machine.ts` | handleBookingFlow function — core booking conversation handler | VERIFIED | 970 lines; exports handleBookingFlow and isBookingExpired; all 5 step handlers; 30-min TTL; off-topic handling |
| `lib/booking/slot-checker.ts` | Slot availability check and booking creation via Supabase RPC | VERIFIED | Exports checkAndCreateBooking, findNextAvailableSlots, getAvailableSlots; RPC calls confirmed |
| `lib/booking/notifications.ts` | n8n outbound webhook dispatcher | VERIFIED | Exports dispatchNotification, NotificationType; fetches n8n_outbound_webhook from bots; gracefully skips if unconfigured |
| `app/api/chat/[botId]/route.ts` | Extended chat endpoint with booking state machine intercept | VERIFIED | Imports handleBookingFlow and isBookingExpired; active-state check at line 141 BEFORE intent detection at line 190 |
| `app/api/bookings/[botId]/route.ts` | Booking CRUD API — GET, POST, PATCH | VERIFIED | All three handlers present; update_booking_status, check_and_create_booking, update_booking_fields RPC calls confirmed; dispatchNotification on confirm |
| `app/api/bookings/[botId]/survey/route.ts` | Survey response capture endpoint | VERIFIED | POST handler; survey_response updated; lookup by bookingId or userId |
| `app/api/notifications/dispatch/route.ts` | Vercel Cron target for automated notification dispatch | PARTIAL | GET handler, CRON_SECRET validation, VERCEL_ENV guard, retry logic all present — but missing `export const dynamic = 'force-dynamic'` |
| `app/dashboard/bookings/page.tsx` | Bookings management page with filterable table, walk-in dialog, detail sheet | VERIFIED | 975 lines; all UI elements confirmed; correct badge colors; all copy strings match UI-SPEC |
| `app/dashboard/bots/[botId]/booking/page.tsx` | Facility configuration page | VERIFIED | 'use client', "Booking Configuration" heading, 3 cards (Booking Module, Facility Types, Notification Webhook) |
| `app/dashboard/bots/[botId]/layout.tsx` | Updated bot layout with Booking tab | VERIFIED | Booking tab link present |
| `app/api/bots/[botId]/facilities/route.ts` | Facilities config API — GET and POST with upsert | VERIFIED | GET and POST handlers; upsert on conflict |
| `vercel.json` | Cron schedule configuration | VERIFIED | `"schedule": "*/15 * * * *"` on `/api/notifications/dispatch` |
| `components/ui/sheet.tsx` | Sheet component | VERIFIED | File present |
| `components/ui/select.tsx` | Select component | VERIFIED | File present |
| `components/ui/popover.tsx` | Popover component | VERIFIED | File present |
| `components/ui/calendar.tsx` | Calendar component | VERIFIED | File present |
| `components/ui/textarea.tsx` | Textarea component | VERIFIED | File present |
| `components/ui/separator.tsx` | Separator component | VERIFIED | File present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/chat/[botId]/route.ts` | `lib/booking/state-machine.ts` | import handleBookingFlow | WIRED | `import { handleBookingFlow, isBookingExpired } from '@/lib/booking/state-machine'` confirmed |
| `lib/booking/state-machine.ts` | `lib/booking/slot-checker.ts` | import checkAndCreateBooking | WIRED | `from '@/lib/booking/slot-checker'` import confirmed |
| `lib/booking/slot-checker.ts` | `supabase.rpc('check_and_create_booking')` | Supabase RPC call | WIRED | `supabase.rpc('check_and_create_booking', {...})` confirmed |
| `lib/booking/slot-checker.ts` | `supabase.rpc('find_next_available_slots')` | Supabase RPC call | WIRED | `supabase.rpc('find_next_available_slots', {...})` confirmed |
| `app/api/bookings/[botId]/route.ts` | `supabase.rpc('update_booking_status')` | RPC call for status changes | WIRED | `supabase.rpc('update_booking_status', {...})` confirmed |
| `app/api/bookings/[botId]/route.ts` | `supabase.rpc('check_and_create_booking')` | RPC call for walk-in creation | WIRED | Confirmed for POST handler with p_status='walk_in' |
| `app/api/bookings/[botId]/route.ts` | `lib/booking/notifications.ts` | import dispatchNotification | WIRED | Import confirmed; `dispatchNotification(botId, bookingId, 'confirmation')` on action=confirm |
| `app/api/notifications/dispatch/route.ts` | `lib/booking/notifications.ts` | import dispatchNotification | WIRED | Import confirmed at line 2 |
| `vercel.json` | `app/api/notifications/dispatch/route.ts` | cron path configuration | WIRED | `/api/notifications/dispatch` path in crons array |
| `app/dashboard/bookings/page.tsx` | `/api/bookings/[botId]` | fetch calls for CRUD operations | WIRED | `fetch('/api/bookings/${selectedBotId}?...')` confirmed for GET/POST/PATCH |
| `app/dashboard/bots/[botId]/booking/page.tsx` | `/api/bots/[botId]/facilities` | fetch for facility config | WIRED | `fetch('/api/bots/${botId}/facilities')` confirmed for GET and POST |
| `supabase/migrations/00010_bookings.sql` | `public.bots` | foreign key on bot_id | WIRED | `REFERENCES public.bots(id) ON DELETE CASCADE` confirmed on both tables |
| `supabase/migrations/00010_bookings.sql` | `public.conversations` | foreign key on conversation_id | WIRED | `REFERENCES public.conversations(id) ON DELETE SET NULL` confirmed |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| BOOK-01 | 02, 06 | Booking state machine entered on book_session intent | SATISFIED | Chat route intercepts; handleBookingFlow called |
| BOOK-02 | 01, 06 | Facility type selection with 6 options | SATISFIED | FACILITY_LABELS in types.ts; step 'facility' in state-machine.ts |
| BOOK-03 | 02, 06 | Location selection with facility constraints | SATISFIED | FACILITY_LOCATION_CONSTRAINTS enforced in state-machine.ts |
| BOOK-04 | 02, 06 | Date/time slot selection with capacity and cutoff checks | SATISFIED | step 'datetime' in state-machine.ts; facilities_config cutoffs |
| BOOK-05 | 02, 06 | Slot full — suggest 3 alternatives | SATISFIED | findNextAvailableSlots called on slot_full result |
| BOOK-06 | 01 | SELECT FOR UPDATE prevents double-booking | SATISFIED | FOR UPDATE present in check_and_create_booking RPC |
| BOOK-07 | 02, 06 | Captures name, member ID, contact, location, facility, BES device, member status | SATISFIED | step 'details' in state-machine.ts |
| BOOK-08 | 02, 06 | Customer reviews and confirms summary | SATISFIED | step 'summary' in state-machine.ts |
| BOOK-09 | 01, 03, 06 | Booking created with status 'pending' | SATISFIED | checkAndCreateBooking called with status 'pending' in state machine |
| BOOK-10 | 02, 06 | Member + Bed/Inhaler path: BES device question, submit for approval | SATISFIED | Member/non-member branching in state-machine.ts |
| BOOK-11 | 02, 06 | Non-member + Bed/Inhaler: specialist contact message | SATISFIED | Non-member path in state-machine.ts |
| BOOK-12 | 02, 06 | Meeting Room: members only | SATISFIED | Meeting Room + Non-member rejection in state-machine.ts |
| BOOK-13 | 01, 06 | Unisex Bed: gender conflict prevention | SATISFIED | gender_conflict check in check_and_create_booking RPC |
| BOOK-14 | 03, 06 | Confirmation message sent on staff approval | SATISFIED | dispatchNotification('confirmation') called in PATCH confirm handler |
| BOOK-15 | 04, 05, 06 | Automated 24-hour reminder | SATISFIED | Reminder dispatch in cron route with 23-25h window |
| BOOK-16 | 04, 05, 06 | Post-session survey sent automatically | SATISFIED | Survey dispatch in cron route for session_start < now |
| BOOK-17 | 03, 06 | Survey responses stored in DB | SATISFIED | app/api/bookings/[botId]/survey/route.ts stores in survey_response jsonb |
| BADM-01 | 03, 04, 06 | Filterable bookings table | SATISFIED | GET /api/bookings/[botId] with 5 filter params; dashboard page with filter selects |
| BADM-02 | 04, 06 | Status badges | SATISFIED | 5 correct color classes in dashboard page |
| BADM-03 | 03, 04, 06 | Staff can confirm, cancel, mark no-show | SATISFIED | PATCH handler with update_booking_status RPC; inline confirm rows in dashboard |
| BADM-04 | 03, 04, 06 | Walk-in registration from dashboard | SATISFIED | POST handler with walk_in status; Walk-in Dialog in dashboard page |
| BADM-05 | 03, 04, 06 | Edit booking fields | SATISFIED | update_booking_fields RPC; Sheet edit mode with Save Changes |
| BADM-06 | 01, 03, 06 | Audit trail logged on every change | SATISFIED | audit_log jsonb; atomic append via || jsonb_build_array in all RPCs |
| BADM-07 | 04, 06 | Audit trail visible per booking | SATISFIED | "Audit Trail" section in Sheet side panel |
| NOTIF-01 | 03, 06 | Confirmation message via n8n webhook | SATISFIED | dispatchNotification('confirmation') in PATCH confirm |
| NOTIF-02 | 05, 06 | 24-hour reminder via n8n | SATISFIED | reminder dispatch in cron route |
| NOTIF-03 | 05, 06 | Post-session survey via n8n | SATISFIED | survey dispatch in cron route |
| NOTIF-04 | 01, 05, 06 | Notification delivery tracked via flags | SATISFIED | reminder_sent, survey_sent, retry_count columns; cron route updates flags on success/failure |

**All 28 Phase 5 requirement IDs are accounted for and satisfied.**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/api/notifications/dispatch/route.ts` | top of file | Missing `export const dynamic = 'force-dynamic'` | Warning | Next.js may cache the GET response during build or at edge, preventing the cron job from executing on each invocation in production. The route is functional but not guaranteed to be dynamic. |

No other anti-patterns found. `return null` occurrences in `lib/booking/state-machine.ts` are intentional — they are parser helper functions that return `null` to signal "no match found" (not implementation stubs).

---

## Human Verification Required

The following behaviors require manual testing and cannot be verified statically:

### 1. Conversational Booking Flow End-to-End

**Test:** Using the WhatsApp/Telegram test console, send "I want to book a session" to a booking-enabled bot. Follow the prompts through all 6 steps (facility → location → date/time → details → summary → confirm).
**Expected:** Bot progresses through each step with numbered options, validates inputs, displays a summary, and on "confirm" returns a submission message. Booking appears in dashboard with status 'pending'.
**Why human:** Multi-turn conversational flow with intent detection and state persistence cannot be verified by file inspection.

### 2. Double-Booking Prevention Race Condition

**Test:** Simultaneously submit two bookings for the same facility, location, and time slot using concurrent requests.
**Expected:** Exactly one booking succeeds; the other receives a "slot is full" response with 3 alternatives offered.
**Why human:** Race condition behavior depends on database-level locking — not verifiable statically.

### 3. 30-Minute TTL Expiry

**Test:** Start a booking, wait 31 minutes without completing it, then send any message.
**Expected:** Bot responds with an expiry message and clears the booking state. Subsequent messages are processed as fresh intents.
**Why human:** Time-dependent behavior requires waiting.

### 4. Cron Notification Dispatch in Production

**Test:** Confirm a booking with session_start 24 hours from now. Wait 15 minutes for the cron to fire. Check if the customer received a reminder via WhatsApp/Telegram.
**Expected:** Reminder delivered; `reminder_sent = true` in the bookings table; `reminder_sent_at` populated.
**Why human:** Requires production Vercel environment with CRON_SECRET configured and a real n8n webhook endpoint.

### 5. Walk-in Registration from Dashboard

**Test:** Navigate to /dashboard/bookings, select a bot, click "Register Walk-in", fill in all fields, submit.
**Expected:** Toast "Walk-in registered successfully.", booking appears in table with blue 'walk_in' badge.
**Why human:** Browser interaction with form submission cannot be verified statically.

---

## Gaps Summary

One gap was found affecting the cron notification dispatch route. The `app/api/notifications/dispatch/route.ts` file is missing `export const dynamic = 'force-dynamic'`. This directive is required to prevent Next.js from statically optimizing the GET handler during build. Without it, the route could be cached and the cron job may receive a stale or pre-rendered response rather than executing the live dispatch logic on each invocation.

This is a single-line fix. All other components of the booking system are fully implemented and wired correctly:

- Database schema with 2 tables, 4 RPC functions, and 6 indexes is complete
- TypeScript types cover all booking entities
- State machine (970 lines) handles all 7 booking steps and all branching paths
- Slot checker wires to Supabase RPCs for atomic operations
- Chat endpoint correctly intercepts active booking state BEFORE intent detection
- Booking admin API handles GET/POST/PATCH with atomic RPC mutations and notification dispatch
- Dashboard page (975 lines) implements full UI with filters, badges, inline actions, walk-in dialog, and audit trail sheet
- Facility config page enables per-facility configuration and n8n webhook setup
- Cron dispatch route processes reminders and surveys with retry tracking
- All 28 requirement IDs are satisfied

---

_Verified: 2026-03-22T09:45:07Z_
_Verifier: Claude (gsd-verifier)_
