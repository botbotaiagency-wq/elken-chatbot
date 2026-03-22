# Phase 5: Booking System - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the end-to-end GenQi facility booking system: a conversational state machine in the WhatsApp/Telegram bot (triggered when intent = `book_session`), a staff-facing bookings management dashboard, and automated outbound notifications (confirmation, 24hr reminder, post-session survey) dispatched via n8n. Analytics and seed data are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Booking Conversation Flow
- Bot starts by asking facility type first — not location. Facility type determines location availability (Unisex Bed = Subang only; Meeting Rooms = OKR only), so asking first avoids offering invalid combinations.
- Flow order: **Facility type → Location → Date/Time slot → Customer details → Booking summary → Confirm**
- Customer details are collected all at once in a single prompt — Name, Member ID (if applicable), Contact Number, Elken member status (YES/NO), BES device status (for bed bookings). Fewer turns, customer fills all at once.
- If customer sends an unexpected message mid-flow (off-topic question, product query): **preserve booking state**, answer the question normally via RAG, then append "To continue your booking, please [current step prompt]". The `conversation.metadata` booking state is untouched.
- **30-minute TTL on booking state**: if no new message arrives within 30 minutes, the booking state in `conversation.metadata` is cleared. On customer return after timeout, bot starts fresh from facility selection with a note: "Your previous session expired — let's start again."
- Customer must review a full booking summary and explicitly confirm before submission (BOOK-08).

### Slot & Capacity Rules
- **Time slot duration is configurable per facility type** by admin — not hardcoded. A `facilities` config table (or `booking_config` jsonb on the bot) stores duration per facility type (e.g., Bed = 60 min, Meeting Room = 60 min or 120 min).
- **Capacity per facility is admin-configurable** — not hardcoded. Admin sets the max concurrent bookings per facility type per location from the admin dashboard. Requires a facility configuration UI and a corresponding schema.
- **Booking cutoff rules are configurable per facility type**: admin sets minimum advance notice (e.g., Bed = 2 hours, Meeting Room = 24 hours) and maximum advance booking window (e.g., 30 days). Stored alongside facility config.
- Slot availability check uses `SELECT FOR UPDATE` transaction to prevent double-booking race conditions (BOOK-06).
- Unisex Bed constraint: bot enforces gender separation — if a male-only or female-only booking exists at the same slot, Unisex Bed is blocked (BOOK-13).
- If selected slot is full, bot automatically suggests the next 3 available alternative date/time slots (BOOK-05).

### Admin Bookings Page Layout
- Primary view at `/dashboard/bookings`: **filterable data table** — consistent with the rest of the dashboard's table pattern (no calendar component needed).
- Table columns: Customer Name, Facility Type, Location, Date/Time, Status badge (pending / confirmed / cancelled / no-show / walk-in), Actions.
- Filters above the table: Location (OKR / Subang / All), Date range picker, Status, Facility type — all from a filter bar, same pattern as Phase 4 FAQ/template lists.
- **Confirm / Cancel / Mark No-show** action buttons per row (inline or in a dropdown). Status changes recorded in audit trail.
- **"Register Walk-in" button** at the top of the page → opens a modal (shadcn/ui Dialog) with the same fields as the bot flow: Name, Member ID, Contact, Facility type, Location, Date/Time, Member status. Walk-in creates a booking with status `walk_in` (treated as confirmed — no pending stage).
- **Per-booking audit trail** displayed in a **side panel (shadcn/ui Sheet)** — clicking a booking row or an "View history" action opens the Sheet with full booking details + audit log (timestamp, action, staff name, note). Consistent with `BADM-06/07` requirements.
- Staff can edit booking fields (date, time, facility, notes) from the Sheet (BADM-05).
- Audit trail is stored as `audit_log jsonb` on the booking record (append-only array of events).

### Notification Dispatch
- **Outbound delivery architecture**: the platform POSTs to an n8n outbound webhook URL (configured per bot in settings) with payload `{ userId, channel, message, type }`. n8n handles the actual WhatsApp/Telegram delivery. n8n already knows how to send messages — this maintains the "n8n owns the channel bridge" architectural constraint.
- The n8n outbound webhook URL is stored in bot config (new field on `bots` or `bot_config`).
- **Timed notifications (24hr reminder, post-survey)**: a **Vercel Cron job** calls `/api/notifications/dispatch` every 15 minutes. The route queries bookings where `reminder_sent = false AND session_start BETWEEN now()+23h AND now()+25h` (for reminder), and `survey_sent = false AND session_start < now()` (for survey). For each due booking, fires the n8n outbound webhook.
- **Confirmation message** is triggered immediately when staff clicks "Confirm" in the admin dashboard — not by cron. The confirm action POSTs to n8n synchronously.
- **Failure handling**: retry up to 3 times (on subsequent cron runs via a `retry_count` field on the booking record). After 3 failures, mark `reminder_status = 'failed'` (or `survey_status = 'failed'`). Staff can see failed notifications in the bookings table (status indicator). NOTIF-04 delivery tracking: `reminder_sent`, `survey_sent` boolean flags + `reminder_sent_at`, `survey_sent_at` timestamps on booking record.

### Claude's Discretion
- Exact schema for `facilities` / `booking_config` table (whether it's a separate table or jsonb on `bots`)
- Exact date/time picker UX in the bot conversation (numbered list of available slots vs natural language date parsing)
- shadcn/ui component variants for the bookings table (DataTable with react-table or plain table)
- Whether Sheet component needs to be added to shadcn/ui (run `npx shadcn@latest add sheet` if not present)
- Exact cron schedule expression for Vercel Cron
- RLS policies on the new `bookings` table

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Booking System Requirements
- `.planning/REQUIREMENTS.md` §Booking System (BOOK-01 through BOOK-17) — exact acceptance criteria for the conversational booking flow, state machine steps, member/non-member paths, slot checking, double-booking prevention, and summary confirmation
- `.planning/REQUIREMENTS.md` §Bookings Admin (BADM-01 through BADM-07) — exact acceptance criteria for the staff dashboard: filterable table, status badges, confirm/cancel/no-show actions, walk-in registration, audit trail
- `.planning/REQUIREMENTS.md` §Notifications (NOTIF-01 through NOTIF-04) — acceptance criteria for confirmation, 24hr reminder, post-survey delivery, and delivery tracking flags

### Architecture Constraints (MUST read before designing state machine)
- `.planning/PROJECT.md` §Key Decisions — booking state machine lives in `conversation.metadata` jsonb (locked); n8n is the channel bridge (this app exposes REST only); no Railway worker; no websockets
- `.planning/PROJECT.md` §Constraints — Next.js App Router, Tailwind + shadcn/ui only, service role key never in NEXT_PUBLIC_, Vercel hosting

### Existing Schema (MUST read before writing migrations)
- `supabase/migrations/00002_schema.sql` — existing `conversations` table with `metadata jsonb` column (booking state goes here); existing `messages` table; `bots` table with `feature_flags jsonb`
- `supabase/migrations/00009_bot_config.sql` — last migration; new Phase 5 migrations start at `00010`

### Existing Chat Endpoint (MUST read before adding booking state machine)
- `app/api/chat/[botId]/route.ts` — Phase 5 extends this endpoint: after intent classification, if intent = `book_session` AND `feature_flags.booking_enabled = true`, the booking state machine handler intercepts and manages the conversation instead of the standard RAG flow

### Existing Dashboard Patterns (MUST read before building bookings page)
- `app/dashboard/bots/[botId]/api-keys/page.tsx` — reference for 'use client' + useParams() pattern, Card layout, inline confirm rows, modal dialogs
- `app/dashboard/bots/[botId]/testing/page.tsx` — reference for the streaming chat UI pattern (for any bot-side test flows)
- `components/ui/dialog.tsx` — already installed; use for walk-in registration modal
- `components/ui/badge.tsx` — already installed; use for booking status badges

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase/service.ts` — service role client; use for all booking mutations, slot checking transactions, and notification dispatch route
- `components/ui/dialog.tsx` — use for walk-in registration modal (same pattern as Phase 3 API key modal and Phase 4 FAQ modal)
- `components/ui/badge.tsx` — use for booking status badges (pending / confirmed / cancelled / no-show / walk-in)
- `components/ui/tabs.tsx` — available if needed for bookings page sub-navigation
- `app/dashboard/bots/[botId]/api-keys/page.tsx` — inline confirm row pattern and `formatRelativeTime` utility reusable for booking table

### Established Patterns
- `'use client' + useParams()` — all dashboard pages use this; booking management page follows suit
- **Service role client for all mutations** — `lib/supabase/service.ts`; never expose SERVICE_ROLE_KEY via NEXT_PUBLIC_
- **bot_id isolation** — every DB query scoped by bot_id; RLS enforced on all new tables
- **params typed as `Promise<{botId}>` with `await params`** — Next.js 16 requirement in API routes
- **Card + CardHeader + CardContent** layout — standard for all admin sections
- **Toast confirmations** — `components/ui/sonner.tsx` already used in Phase 3/4; use same pattern for booking status change confirmations

### Integration Points
- `app/api/chat/[botId]/route.ts` — extend with booking state machine handler (triggered when intent = `book_session` AND `feature_flags.booking_enabled`)
- `app/dashboard/bookings/page.tsx` — currently a placeholder; Phase 5 builds this out as the full bookings management page
- `app/api/notifications/dispatch/route.ts` — new: Vercel Cron target for reminder and survey dispatch
- `app/api/bookings/[botId]/route.ts` — new: booking CRUD API (confirm, cancel, no-show, walk-in, edit)
- `supabase/migrations/00010_bookings.sql` — new: `bookings` table, `facilities_config` table, booking state fields

</code_context>

<specifics>
## Specific Ideas

- The booking state machine in `conversation.metadata` should use a clear step enum: `{ step: "facility" | "location" | "datetime" | "details" | "summary" | "confirmed" | "cancelled", ...collected_data }` — downstream planner should design the full state shape
- Walk-in bookings bypass the pending → confirmed flow: they are created with status `walk_in` immediately (staff is present, no approval needed)
- The n8n outbound webhook URL needs to be configurable per bot — store in `bots.n8n_outbound_webhook` or a new `bot_integrations` config field; without this URL the notification dispatch silently skips sending

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-booking-system*
*Context gathered: 2026-03-22*
