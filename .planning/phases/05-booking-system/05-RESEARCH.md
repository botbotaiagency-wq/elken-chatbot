# Phase 5: Booking System - Research

**Researched:** 2026-03-22
**Domain:** Conversational state machines, booking systems, Vercel Cron, Supabase transactions, Next.js App Router
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Booking Conversation Flow**
- Bot starts by asking facility type first — not location. Facility type determines location availability (Unisex Bed = Subang only; Meeting Rooms = OKR only), so asking first avoids offering invalid combinations.
- Flow order: Facility type → Location → Date/Time slot → Customer details → Booking summary → Confirm
- Customer details are collected all at once in a single prompt — Name, Member ID (if applicable), Contact Number, Elken member status (YES/NO), BES device status (for bed bookings). Fewer turns, customer fills all at once.
- If customer sends an unexpected message mid-flow (off-topic question, product query): preserve booking state, answer the question normally via RAG, then append "To continue your booking, please [current step prompt]". The `conversation.metadata` booking state is untouched.
- 30-minute TTL on booking state: if no new message arrives within 30 minutes, the booking state in `conversation.metadata` is cleared. On customer return after timeout, bot starts fresh from facility selection with a note: "Your previous session expired — let's start again."
- Customer must review a full booking summary and explicitly confirm before submission (BOOK-08).

**Slot & Capacity Rules**
- Time slot duration is configurable per facility type by admin — not hardcoded. A `facilities` config table (or `booking_config` jsonb on the bot) stores duration per facility type.
- Capacity per facility is admin-configurable — not hardcoded.
- Booking cutoff rules are configurable per facility type: admin sets minimum advance notice and maximum advance booking window. Stored alongside facility config.
- Slot availability check uses `SELECT FOR UPDATE` transaction to prevent double-booking race conditions (BOOK-06).
- Unisex Bed constraint: bot enforces gender separation — if a male-only or female-only booking exists at the same slot, Unisex Bed is blocked (BOOK-13).
- If selected slot is full, bot automatically suggests the next 3 available alternative date/time slots (BOOK-05).

**Admin Bookings Page Layout**
- Primary view at `/dashboard/bookings`: filterable data table — consistent with the rest of the dashboard's table pattern (no calendar component needed).
- Table columns: Customer Name, Facility Type, Location, Date/Time, Status badge (pending / confirmed / cancelled / no-show / walk-in), Actions.
- Filters above the table: Location (OKR / Subang / All), Date range picker, Status, Facility type — all from a filter bar, same pattern as Phase 4 FAQ/template lists.
- Confirm / Cancel / Mark No-show action buttons per row (inline or in a dropdown). Status changes recorded in audit trail.
- "Register Walk-in" button at the top of the page → opens a modal (shadcn/ui Dialog) with same fields as bot flow.
- Per-booking audit trail displayed in a side panel (shadcn/ui Sheet) — clicking a booking row or "View history" action opens the Sheet.
- Staff can edit booking fields (date, time, facility, notes) from the Sheet (BADM-05).
- Audit trail stored as `audit_log jsonb` on the booking record (append-only array of events).

**Notification Dispatch**
- Outbound delivery architecture: the platform POSTs to an n8n outbound webhook URL (configured per bot in settings) with payload `{ userId, channel, message, type }`. n8n handles the actual WhatsApp/Telegram delivery.
- The n8n outbound webhook URL is stored in bot config (new field on `bots` or `bot_integrations` config field).
- Timed notifications (24hr reminder, post-survey): a Vercel Cron job calls `/api/notifications/dispatch` every 15 minutes. The route queries bookings where `reminder_sent = false AND session_start BETWEEN now()+23h AND now()+25h` (for reminder), and `survey_sent = false AND session_start < now()` (for survey). For each due booking, fires the n8n outbound webhook.
- Confirmation message is triggered immediately when staff clicks "Confirm" in the admin dashboard — not by cron. The confirm action POSTs to n8n synchronously.
- Failure handling: retry up to 3 times (on subsequent cron runs via a `retry_count` field on the booking record). After 3 failures, mark `reminder_status = 'failed'` (or `survey_status = 'failed'`). Staff can see failed notifications in the bookings table.
- NOTIF-04 delivery tracking: `reminder_sent`, `survey_sent` boolean flags + `reminder_sent_at`, `survey_sent_at` timestamps on booking record.

### Claude's Discretion
- Exact schema for `facilities` / `booking_config` table (whether it's a separate table or jsonb on `bots`)
- Exact date/time picker UX in the bot conversation (numbered list of available slots vs natural language date parsing)
- shadcn/ui component variants for the bookings table (DataTable with react-table or plain table)
- Whether Sheet component needs to be added to shadcn/ui (run `npx shadcn@latest add sheet` if not present)
- Exact cron schedule expression for Vercel Cron
- RLS policies on the new `bookings` table

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOOK-01 | When intent is `book_session`, bot enters a conversational booking state machine stored in `conversation.metadata` | State machine handler intercepts chat route after intent classification; metadata jsonb already on `conversations` table |
| BOOK-02 | Customer selects facility type: Bed (Female), Bed (Male), Bed (Unisex — Subang only), Inhaler, Meeting Room Small (OKR only, max 8 pax), Meeting Room Large (OKR only, max 50 pax) | Facility types are enum values; `facilities_config` table stores per-type capacity and rules |
| BOOK-03 | Customer selects location: GenQi Old Klang Road or GenQi Subang; Meeting Rooms only at OKR; Unisex Bed only at Subang | Location filtering logic is deterministic from facility type — encode as a lookup map |
| BOOK-04 | Customer selects available date and time slot; bot checks capacity and last-booking cutoffs per facility type | Slot availability query + cutoff enforcement from `facilities_config`; configurable per type |
| BOOK-05 | If selected slot fully booked, bot suggests next 3 available alternative date/time slots | "Find next 3 available" query with forward scan across slot windows |
| BOOK-06 | Slot checking uses `SELECT FOR UPDATE` transaction to prevent double-booking race conditions | Supabase `rpc()` with a PL/pgSQL function is the correct pattern for `FOR UPDATE` in supabase-js v2 |
| BOOK-07 | Bot captures: Member Name, Member ID, Contact Number, Booking Location, Facility Type, On Loan Unit, Elken member status (YES/NO), Has BES device (for bed bookings) | All fields collected in `conversation.metadata.details` before summary step |
| BOOK-08 | Customer reviews full booking summary and confirms before submission | "summary" step in state machine; bot formats collected data and waits for explicit "yes" / "confirm" |
| BOOK-09 | Confirmed booking created with status `pending` — requires staff approval before `confirmed` | `INSERT INTO bookings ... status = 'pending'` on confirmed summary |
| BOOK-10 | Member + Bed/Inhaler path: ask for BES device, submit for staff approval; confirmation sent on approval | Path branching in state machine at "details" step |
| BOOK-11 | Non-member + Bed/Inhaler path: "Our specialist will contact you within 24 hours"; booking as pending | Path branching in state machine at member_status check |
| BOOK-12 | Meeting Room path: Elken members only with valid ID; submit for approval; confirm directly | Validation at "details" step: meeting room + non-member → rejection message |
| BOOK-13 | Unisex Bed constraint: mixing genders at same time slot not permitted | Gender conflict check in slot availability query |
| BOOK-14 | Confirmation message automatically sent when staff approves booking | Confirm action in admin API POSTs to n8n outbound webhook |
| BOOK-15 | Automated 24-hour reminder sent before session | Vercel Cron `/api/notifications/dispatch` queries bookings 23–25h before session_start |
| BOOK-16 | Post-session survey sent automatically on booking date | Vercel Cron queries `session_start < now()` and `survey_sent = false` |
| BOOK-17 | Survey responses captured, stored in DB, visible in admin reporting | `survey_responses` jsonb column on bookings or a separate `survey_responses` table |
| BADM-01 | Admin can view all bookings in filterable table: location, date range, status, facility type | GET `/api/bookings` with query params; client-side filter state with server fetch |
| BADM-02 | Booking status badges: pending / confirmed / cancelled / no-show / walk-in | shadcn Badge with color overrides per status (defined in UI-SPEC) |
| BADM-03 | Staff can confirm, cancel, or mark booking as no-show from admin dashboard | PATCH `/api/bookings/[botId]` with `{ action: 'confirm' | 'cancel' | 'no_show', bookingId }` |
| BADM-04 | Staff can register walk-in from admin dashboard (creates booking with status `walk_in`) | POST `/api/bookings/[botId]` with `{ ...fields, status: 'walk_in' }` — bypasses pending stage |
| BADM-05 | Staff can edit and update calendar entries (date, time, facility, notes) | PATCH `/api/bookings/[botId]` with updated fields; Sheet edit mode in UI |
| BADM-06 | Every change logged in audit trail: action, who, timestamp, note — in `audit_log` jsonb | Append-only jsonb array; each mutation appends an event object |
| BADM-07 | Audit trail visible per booking (collapsible in UI) | Sheet side panel displays audit_log array in chronological order |
| NOTIF-01 | Booking confirmation message sent to customer's channel when staff approves | POST to `bots.n8n_outbound_webhook` from confirm action handler |
| NOTIF-02 | 24-hour reminder sent automatically before session | Vercel Cron dispatch route |
| NOTIF-03 | Post-session survey sent automatically on booking date | Vercel Cron dispatch route |
| NOTIF-04 | Notification delivery tracked (`reminder_sent`, `survey_sent` flags on booking record) | Boolean flags + timestamps + retry_count on `bookings` table |
</phase_requirements>

---

## Summary

Phase 5 builds three interconnected systems: (1) a conversational state machine embedded in the existing chat endpoint that intercepts `book_session` intents, (2) a staff-facing bookings management page at `/dashboard/bookings` using the established dashboard table pattern, and (3) an automated notification dispatch pipeline via Vercel Cron that fires n8n webhook calls.

The technical crux of this phase is the state machine in `conversation.metadata`. The chat route already reads and writes the `conversations` table. Phase 5 extends it: after intent detection, if `intent === 'book_session'` and `feature_flags.booking_enabled === true`, a new `handleBookingFlow()` function takes over and manages the conversation through six named steps instead of falling through to the RAG pipeline. Off-topic messages during a booking preserve state and re-prompt. A 30-minute TTL is enforced by comparing `conversation.updated_at` to `now()`.

The double-booking prevention requirement (BOOK-06) cannot be satisfied with standard supabase-js query chaining — it requires a PostgreSQL transaction with `SELECT ... FOR UPDATE`. The correct pattern is a PL/pgSQL function called via `supabase.rpc()`. This is the most critical architecture decision in the phase. Everything else (admin UI, notifications) follows established patterns from previous phases.

**Primary recommendation:** Build the booking state machine as a self-contained module `lib/booking/state-machine.ts` that exports a single `handleBookingFlow(conversationId, botId, message, metadata)` function. The chat route calls this function when booking conditions are met, receives either a direct string response or a stream signal, and returns the result. This keeps the chat route clean and makes the state machine independently testable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | latest (^2.x) | DB transactions via `rpc()`, booking CRUD | Already in project; `rpc()` is the correct pattern for PL/pgSQL transactions |
| Next.js App Router | latest (^16) | API routes for booking CRUD, cron endpoint | Already in project; locked architecture |
| shadcn/ui | latest CLI | UI components — Sheet, Select, Popover, Calendar, Textarea, Separator | Already installed/initialized; new components added via `npx shadcn@latest add` |
| lucide-react | ^0.511.0 | Icons — CalendarDays, Loader2, etc. | Already in project |
| sonner | ^2.0.7 | Toast confirmations for booking status changes | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.0 | Unit tests for state machine logic and API routes | All new modules — follows existing test infrastructure in `tests/` |

### New shadcn Components to Install
```bash
npx shadcn@latest add sheet
npx shadcn@latest add select
npx shadcn@latest add popover
npx shadcn@latest add calendar
npx shadcn@latest add textarea
npx shadcn@latest add separator
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `<table>` (established pattern) | TanStack Table / react-table | react-table adds dependency and complexity; plain table is sufficient and consistent with api-keys page pattern |
| Vercel Cron | BullMQ / background worker | No Railway worker in this stack — Vercel Cron is the correct v1 choice |
| `supabase.rpc()` for slot lock | optimistic writes + retries | `FOR UPDATE` is the only correct solution for strict double-booking prevention |

---

## Architecture Patterns

### Recommended Project Structure (Phase 5 additions)
```
lib/
├── booking/
│   ├── state-machine.ts     # Core booking flow handler
│   ├── slot-checker.ts      # Slot availability + SELECT FOR UPDATE RPC
│   ├── notifications.ts     # n8n outbound webhook dispatcher
│   └── types.ts             # BookingState, BookingStep, FacilityType types

app/
├── api/
│   ├── bookings/
│   │   └── [botId]/
│   │       └── route.ts     # GET (list), POST (walk-in), PATCH (confirm/cancel/edit)
│   └── notifications/
│       └── dispatch/
│           └── route.ts     # Vercel Cron target (GET with Bearer token)
├── dashboard/
│   └── bookings/
│       └── page.tsx         # Full bookings management page (replaces placeholder)

supabase/
└── migrations/
    └── 00010_bookings.sql   # bookings table, facilities_config table, slot_check RPC
```

### Pattern 1: Booking State Machine in conversation.metadata

**What:** A jsonb field on the `conversations` table holds the entire in-progress booking state between messages. The state machine is a pure function that takes the current state + new user message and returns the next state + bot response.

**When to use:** Every time the chat route processes a message for a conversation where `metadata.booking` is non-null, or when intent is `book_session`.

**State shape (recommended):**
```typescript
// lib/booking/types.ts
export type BookingStep =
  | 'facility'
  | 'location'
  | 'datetime'
  | 'details'
  | 'summary'
  | 'confirmed'
  | 'expired'

export interface BookingState {
  step: BookingStep
  facility_type?: string        // 'bed_female' | 'bed_male' | 'bed_unisex' | 'inhaler' | 'room_small' | 'room_large'
  location?: string             // 'okr' | 'subang'
  session_date?: string         // ISO date string
  session_time?: string         // 'HH:MM' 24-hour
  customer_name?: string
  member_id?: string
  contact_number?: string
  is_member?: boolean
  has_bes_device?: boolean
  on_loan_unit?: string
  started_at: string            // ISO timestamp — for 30-min TTL check
  last_activity_at: string      // ISO timestamp — updated on every message
}
```

**How the chat route integrates:**
```typescript
// app/api/chat/[botId]/route.ts — Phase 5 extension pattern
// After intent detection (step 6), BEFORE RAG retrieval:

const conversation = await getConversationWithMetadata(conversationId)
const bookingState = conversation.metadata?.booking as BookingState | null

// Check TTL (30 minutes = 1800 seconds)
if (bookingState && isBookingExpired(bookingState)) {
  await clearBookingState(conversationId)
  // Fall through — bot will explain session expired
}

if (
  (detection.intent === 'book_session' || bookingState) &&
  bot.feature_flags?.booking_enabled
) {
  const result = await handleBookingFlow({
    conversationId,
    botId,
    message,
    state: bookingState,
    detection,
  })
  // Return result directly — skip RAG pipeline
  return new Response(result.response, { ... })
}
// else: normal RAG flow
```

### Pattern 2: SELECT FOR UPDATE via Supabase RPC

**What:** Double-booking prevention requires an atomic check-and-insert. supabase-js v2 does not support `FOR UPDATE` directly in the query builder — it must be encapsulated in a PL/pgSQL function and called via `supabase.rpc()`.

**When to use:** At the "summary → confirmed" step when a customer confirms their booking, and when a walk-in is registered from the admin dashboard.

**Migration (in 00010_bookings.sql):**
```sql
-- Function: atomically check slot capacity and insert booking
CREATE OR REPLACE FUNCTION public.check_and_create_booking(
  p_bot_id        uuid,
  p_facility_type text,
  p_location      text,
  p_session_start timestamptz,
  p_session_end   timestamptz,
  p_customer_name text,
  p_member_id     text,
  p_contact       text,
  p_is_member     boolean,
  p_has_bes       boolean,
  p_gender        text,  -- 'male' | 'female' | null
  p_status        text   -- 'pending' | 'walk_in'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config        record;
  v_count         integer;
  v_booking_id    uuid;
BEGIN
  -- Lock: prevent concurrent inserts for same slot
  SELECT * INTO v_config
  FROM public.facilities_config
  WHERE bot_id = p_bot_id AND facility_type = p_facility_type
  FOR UPDATE;

  -- Count existing confirmed/pending bookings in this slot
  SELECT COUNT(*) INTO v_count
  FROM public.bookings
  WHERE bot_id = p_bot_id
    AND facility_type = p_facility_type
    AND location = p_location
    AND session_start = p_session_start
    AND status IN ('pending', 'confirmed', 'walk_in');

  IF v_count >= v_config.capacity THEN
    RETURN jsonb_build_object('success', false, 'reason', 'slot_full');
  END IF;

  -- Unisex Bed gender conflict check
  IF p_facility_type = 'bed_unisex' AND p_gender IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bot_id = p_bot_id
        AND facility_type = 'bed_unisex'
        AND location = p_location
        AND session_start = p_session_start
        AND status IN ('pending', 'confirmed', 'walk_in')
        AND customer_gender != p_gender
    ) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'gender_conflict');
    END IF;
  END IF;

  INSERT INTO public.bookings (
    bot_id, facility_type, location, session_start, session_end,
    customer_name, member_id, contact_number, is_member, has_bes_device,
    customer_gender, status, audit_log
  ) VALUES (
    p_bot_id, p_facility_type, p_location, p_session_start, p_session_end,
    p_customer_name, p_member_id, p_contact, p_is_member, p_has_bes,
    p_gender, p_status,
    jsonb_build_array(
      jsonb_build_object(
        'action', 'created',
        'by', 'bot',
        'at', now()::text,
        'note', 'Booking submitted via chatbot'
      )
    )
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id);
END;
$$;
```

**Usage in application code:**
```typescript
// lib/booking/slot-checker.ts
const { data, error } = await supabase.rpc('check_and_create_booking', {
  p_bot_id: botId,
  p_facility_type: state.facility_type,
  // ... all params
})

if (data?.success === false && data?.reason === 'slot_full') {
  // fetch next 3 alternatives and prompt customer
}
```

### Pattern 3: Vercel Cron for Notification Dispatch

**What:** A GET route at `/api/notifications/dispatch` is called by Vercel Cron on a schedule. It queries bookings due for reminder or survey, fires n8n outbound webhooks, and updates sent flags.

**Vercel Cron configuration (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/notifications/dispatch",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Security:** Vercel automatically adds `Authorization: Bearer <CRON_SECRET>` to cron-triggered requests. The route must validate this:
```typescript
// app/api/notifications/dispatch/route.ts
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... process reminders and surveys
}
```

Note: `CRON_SECRET` must be set in Vercel environment variables. During local development, the route can be tested by manually calling GET with the correct header.

### Pattern 4: Audit Log Append Pattern

**What:** Every booking mutation appends an event to `audit_log jsonb` rather than updating it wholesale. Uses Supabase's `||` jsonb concatenation operator.

```sql
-- Append to audit_log without overwriting
UPDATE public.bookings
SET
  status = 'confirmed',
  audit_log = audit_log || jsonb_build_array(
    jsonb_build_object(
      'action', 'confirmed',
      'by', $staff_name,
      'at', now()::text,
      'note', $note
    )
  )
WHERE id = $booking_id AND bot_id = $bot_id;
```

In supabase-js, this requires either a raw SQL RPC or using `.update()` with a function. Use a `confirm_booking` RPC function to handle the audit append atomically alongside the status change.

### Pattern 5: Booking State TTL Check

**What:** The chat route checks `booking.last_activity_at` against `now()`. If gap exceeds 30 minutes, clears `metadata.booking` and informs customer.

```typescript
// lib/booking/state-machine.ts
export function isBookingExpired(state: BookingState): boolean {
  const lastActivity = new Date(state.last_activity_at).getTime()
  const thirtyMinutesMs = 30 * 60 * 1000
  return Date.now() - lastActivity > thirtyMinutesMs
}
```

### Anti-Patterns to Avoid

- **Reading `conversation.metadata` inside a RAG retrieval flow:** The chat route must check booking state BEFORE calling `retrieveContext()` and `detectIntentAndLanguage()` when a booking is active. Intent detection can misclassify booking-flow messages (e.g., "yes" → intent `general` instead of booking confirmation).
- **Calling `supabase.from('bookings').insert()` without `FOR UPDATE`:** This does not prevent double-booking. The `check_and_create_booking` RPC is mandatory.
- **Updating `audit_log` with `.update({ audit_log: newArray })`:** This risks overwriting concurrent updates. Always use append via SQL `||` operator inside an RPC.
- **Streaming Claude responses during the booking flow:** The booking state machine returns pre-written structured messages (numbered lists of slots, confirmation summaries). These should be returned as direct text responses, not streamed via Anthropic. Only off-topic RAG responses during mid-flow interruptions use streaming.
- **Storing n8n outbound webhook URL in `NEXT_PUBLIC_` env var:** n8n webhook URLs are often sensitive. Store in `bots.n8n_outbound_webhook` column; the dispatch route uses the service role client.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slot locking | Custom optimistic-lock retry loop | PL/pgSQL `FOR UPDATE` in `check_and_create_booking` RPC | Retry loops have race windows between check and insert; `FOR UPDATE` is the only correct solution |
| Cron scheduling | Custom `setTimeout` loops, external cron services | Vercel Cron (vercel.json) | Already on Vercel; zero infra; automatic with correct schedule expression |
| WhatsApp/Telegram delivery | Direct API calls from Next.js | n8n outbound webhook (POST to configured URL) | Locked architectural decision; n8n owns the channel bridge |
| shadcn Sheet / Select / Calendar | Custom drawer or modal components | `npx shadcn@latest add sheet select popover calendar` | Radix primitives with correct accessibility; already defined in UI-SPEC |
| Date/time formatting | Manual string manipulation | `new Date().toISOString()` + `toLocaleDateString()` | Established pattern in existing codebase (see `formatDate` in api-keys/page.tsx) |

**Key insight:** The state machine logic itself must be hand-written (it is domain-specific), but every infrastructure concern — slot locking, scheduling, messaging delivery, UI components — has an existing solution in this stack.

---

## Common Pitfalls

### Pitfall 1: Off-Topic Message Corrupts Booking State
**What goes wrong:** A customer mid-booking asks "What is the price of X?" — the intent classifier returns `browse_product` — the standard RAG flow runs and clears booking context.
**Why it happens:** The chat route falls through to RAG without checking whether a booking is in progress.
**How to avoid:** In the chat route, check `metadata.booking` FIRST. If non-null and not expired, route to `handleBookingFlow()` unconditionally — even for non-`book_session` intents. The state machine handles off-topic internally by calling the RAG pipeline for the sub-question and then re-appending the current booking prompt.
**Warning signs:** Integration test shows booking state reset to null after an off-topic message mid-flow.

### Pitfall 2: Race Condition on Simultaneous Slot Requests
**What goes wrong:** Two customers simultaneously confirm the same slot. Both pass capacity check, both insert. Slot now has 2 bookings when capacity is 1.
**Why it happens:** Application-level capacity checks are not atomic.
**How to avoid:** ONLY use the `check_and_create_booking` RPC. Never check capacity and then insert in two separate supabase-js calls.
**Warning signs:** Unit test that fires two simultaneous RPC calls results in one success and one `slot_full`.

### Pitfall 3: Vercel Cron Runs in Every Preview Environment
**What goes wrong:** Cron job fires in preview deployments and sends test notifications to real customers.
**Why it happens:** Vercel Cron activates in all environments including Preview when `vercel.json` is present.
**How to avoid:** Guard the dispatch route with an environment check: `if (process.env.VERCEL_ENV !== 'production') return Response.json({ skipped: true })`. Alternatively, scope the `CRON_SECRET` so it is only set in production.
**Warning signs:** Receiving reminder messages in test/preview environments.

### Pitfall 4: Audit Log Overwrites on Concurrent Updates
**What goes wrong:** Two staff members act on the same booking simultaneously. The second `.update()` call overwrites the first staff member's audit entry.
**Why it happens:** Reading `audit_log`, appending in JS, then writing back the entire array is a read-modify-write cycle — not atomic.
**How to avoid:** Use `confirm_booking` / `cancel_booking` SQL RPCs that perform the append in PostgreSQL with `audit_log = audit_log || jsonb_build_array(...)`. Never do read-modify-write of jsonb in application code.
**Warning signs:** Audit log entries go missing when two staff act rapidly on the same booking.

### Pitfall 5: feature_flags.booking_enabled Not Checked
**What goes wrong:** A non-Elken bot receives a `book_session` intent and enters the booking flow, crashing because `facilities_config` has no rows for that `bot_id`.
**Why it happens:** The feature flag check is missed in the chat route extension.
**How to avoid:** The booking intercept condition is `intent === 'book_session' AND bot.feature_flags?.booking_enabled === true`. Both conditions must be true. Add a test case that sends `book_session` intent to a bot with `booking_enabled = false` and asserts it falls through to RAG.
**Warning signs:** Error logs about missing facility config for non-Elken bots.

### Pitfall 6: Vercel Cron Authorization Header Pattern Changed
**What goes wrong:** Cron route returns 401 in production despite correct `CRON_SECRET`.
**Why it happens:** Vercel Cron only automatically adds the `Authorization: Bearer` header when `CRON_SECRET` environment variable is set in the Vercel project settings. If the variable is absent, no auth header is sent.
**How to avoid:** Ensure `CRON_SECRET` is added to Vercel environment variables (production + preview). In local development, call the route manually with the correct header for testing.
**Warning signs:** Cron job returns 401 in production logs.

---

## Code Examples

### State Machine: Facility Selection Step
```typescript
// lib/booking/state-machine.ts
const FACILITY_LOCATION_CONSTRAINTS: Record<string, string[]> = {
  bed_female:   ['okr', 'subang'],
  bed_male:     ['okr', 'subang'],
  bed_unisex:   ['subang'],          // Subang only
  inhaler:      ['okr', 'subang'],
  room_small:   ['okr'],             // OKR only
  room_large:   ['okr'],             // OKR only
}

function handleFacilityStep(message: string, state: BookingState): StepResult {
  const selection = parseFacilitySelection(message)
  if (!selection) {
    return {
      response: buildFacilityPrompt(),
      nextState: state,
    }
  }
  return {
    response: buildLocationPrompt(selection),
    nextState: {
      ...state,
      step: 'location',
      facility_type: selection,
      last_activity_at: new Date().toISOString(),
    },
  }
}
```

### Admin Bookings API: Status Change with Audit Append
```typescript
// app/api/bookings/[botId]/route.ts
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const { bookingId, action, staffName, note } = await req.json()

  const supabase = createServiceClient()

  const { error } = await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_bot_id: botId,
    p_action: action,        // 'confirm' | 'cancel' | 'no_show'
    p_staff_name: staffName,
    p_note: note ?? '',
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // If confirming, fire n8n notification
  if (action === 'confirm') {
    await dispatchNotification(botId, bookingId, 'confirmation')
  }

  return Response.json({ ok: true })
}
```

### Notification Dispatch Route (Vercel Cron)
```typescript
// app/api/notifications/dispatch/route.ts
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Skip non-production environments
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return Response.json({ skipped: true, env: process.env.VERCEL_ENV })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const plus23h = new Date(now.getTime() + 23 * 3600 * 1000).toISOString()
  const plus25h = new Date(now.getTime() + 25 * 3600 * 1000).toISOString()

  // Reminders due
  const { data: remindersDue } = await supabase
    .from('bookings')
    .select('id, bot_id, user_id, channel, reminder_retry_count')
    .eq('reminder_sent', false)
    .eq('status', 'confirmed')
    .lt('reminder_retry_count', 3)
    .gte('session_start', plus23h)
    .lte('session_start', plus25h)

  for (const booking of remindersDue ?? []) {
    const sent = await dispatchNotification(booking.bot_id, booking.id, 'reminder')
    if (sent) {
      await supabase
        .from('bookings')
        .update({ reminder_sent: true, reminder_sent_at: now.toISOString() })
        .eq('id', booking.id)
    } else {
      await supabase
        .from('bookings')
        .update({ reminder_retry_count: booking.reminder_retry_count + 1 })
        .eq('id', booking.id)
    }
  }

  // ... similar for surveys

  return Response.json({ ok: true })
}
```

---

## Schema Design (Claude's Discretion: Recommendation)

**Recommendation:** Use a separate `facilities_config` table (not jsonb on `bots`). Reasoning: there are 6 facility types, each with 4 configurable fields (duration, capacity, min_advance_hours, max_window_days). A table allows per-row RLS, proper indexing, and simpler admin UI queries. jsonb on `bots` would require the admin to send the entire config blob on every edit.

```sql
-- 00010_bookings.sql

CREATE TABLE public.facilities_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id              uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  facility_type       text NOT NULL CHECK (facility_type IN (
                        'bed_female', 'bed_male', 'bed_unisex',
                        'inhaler', 'room_small', 'room_large'
                      )),
  capacity            integer NOT NULL DEFAULT 1,
  duration_minutes    integer NOT NULL DEFAULT 60,
  min_advance_hours   integer NOT NULL DEFAULT 2,
  max_window_days     integer NOT NULL DEFAULT 30,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (bot_id, facility_type)
);

CREATE TABLE public.bookings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id              uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  facility_type       text NOT NULL,
  location            text NOT NULL CHECK (location IN ('okr', 'subang')),
  session_start       timestamptz NOT NULL,
  session_end         timestamptz NOT NULL,
  customer_name       text NOT NULL,
  member_id           text,
  contact_number      text NOT NULL,
  is_member           boolean NOT NULL DEFAULT false,
  has_bes_device      boolean,
  on_loan_unit        text,
  customer_gender     text CHECK (customer_gender IN ('male', 'female', null)),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show', 'walk_in')),
  user_id             text,                   -- from conversation.user_id (for notification routing)
  channel             text,                   -- 'whatsapp' | 'telegram'
  conversation_id     uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  audit_log           jsonb NOT NULL DEFAULT '[]'::jsonb,
  reminder_sent       boolean NOT NULL DEFAULT false,
  reminder_sent_at    timestamptz,
  reminder_retry_count integer NOT NULL DEFAULT 0,
  survey_sent         boolean NOT NULL DEFAULT false,
  survey_sent_at      timestamptz,
  survey_retry_count  integer NOT NULL DEFAULT 0,
  survey_response     jsonb,                  -- BOOK-17: store survey response inline
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Also add to bots table:
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS n8n_outbound_webhook text;
```

**RLS recommendation:** Enable RLS on both tables. Policy: authenticated users whose `profiles.tenant_id` matches `bots.tenant_id` can SELECT/INSERT/UPDATE. Service role (used by all API routes) bypasses RLS. Super-admin can see all rows.

---

## Slot Availability Query (Next 3 Available)

For BOOK-05 (suggest next 3 alternatives), the bot needs a function that, given a facility type and location, returns the next N available slots starting from a given datetime:

```sql
-- Suggested approach: generate candidate slots then exclude full ones
-- Called via RPC from lib/booking/slot-checker.ts

CREATE OR REPLACE FUNCTION public.find_next_available_slots(
  p_bot_id        uuid,
  p_facility_type text,
  p_location      text,
  p_after         timestamptz,
  p_limit         integer DEFAULT 3
)
RETURNS TABLE (slot_start timestamptz, slot_end timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  v_config    record;
  v_candidate timestamptz;
  v_end       timestamptz;
  v_count     integer := 0;
  v_slot_count integer;
BEGIN
  SELECT * INTO v_config
  FROM public.facilities_config
  WHERE bot_id = p_bot_id AND facility_type = p_facility_type;

  -- Start scanning from next full hour after p_after
  v_candidate := date_trunc('hour', p_after) + interval '1 hour';

  WHILE v_count < p_limit LOOP
    v_end := v_candidate + (v_config.duration_minutes || ' minutes')::interval;

    -- Check capacity
    SELECT COUNT(*) INTO v_slot_count
    FROM public.bookings
    WHERE bot_id = p_bot_id
      AND facility_type = p_facility_type
      AND location = p_location
      AND session_start = v_candidate
      AND status IN ('pending', 'confirmed', 'walk_in');

    IF v_slot_count < v_config.capacity THEN
      slot_start := v_candidate;
      slot_end := v_end;
      RETURN NEXT;
      v_count := v_count + 1;
    END IF;

    v_candidate := v_candidate + (v_config.duration_minutes || ' minutes')::interval;

    -- Safety: stop after scanning 30 days
    EXIT WHEN v_candidate > p_after + interval '30 days';
  END LOOP;
END;
$$;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` for Next.js session | Next.js 16 | Already applied in Phase 1 |
| `await params` as sync | `params: Promise<{botId}>` with `await` | Next.js 16 | Already applied in Phases 2–4; must continue in Phase 5 routes |
| Direct SDK calls from Next.js to WhatsApp | n8n outbound webhook from Next.js | Architectural decision | Confirmed: never call WhatsApp/Telegram SDK directly |
| TanStack Query for server state | Direct `fetch()` + `useState` | Phase 4 established pattern | Continue plain fetch pattern; no new state management library |

**Deprecated/outdated:**
- `params` as sync object: All Phase 5 API routes must use `{ params }: { params: Promise<{ botId: string }> }` and `const { botId } = await params`.
- `export const runtime = 'edge'`: Do NOT use edge runtime for booking routes — edge runtime does not support the full Node.js crypto API and PL/pgSQL RPC calls need full supabase-js. Use default Node.js runtime.

---

## Open Questions

1. **Survey response capture format (BOOK-17)**
   - What we know: Requirement says "survey responses are captured, stored in the database, and visible in admin reporting."
   - What's unclear: Survey flow is via n8n outbound — does the bot receive the customer's survey reply back via the chat endpoint? Or does the survey link open a web form? Phase 5 scope says analytics is Phase 6. The bot sends the survey message; response capture may be passive (customer replies in chat → logged as message) or active (dedicated survey parsing).
   - Recommendation: For Phase 5, store the survey message content in `bookings.survey_response` as `{ sent_at, response_message_id }`. Full survey analytics parsing is Phase 6. Plan should note this boundary explicitly.

2. **Bot conversation metadata update pattern**
   - What we know: `getOrCreateConversation` in `lib/rag/logger.ts` does not return the full conversation row including `metadata` — it only returns `id`.
   - What's unclear: The state machine needs to read and write `conversation.metadata`. This requires either (a) a new `getConversationMetadata(conversationId)` helper, or (b) extending `getOrCreateConversation` to return the full row.
   - Recommendation: Create a new `lib/booking/state-machine.ts` helper `readBookingState(conversationId)` and `writeBookingState(conversationId, state)` that directly query the `conversations` table via service client. Do not modify the existing logger to avoid Phase 2 regression risk.

3. **Date/time slot presentation format (Claude's Discretion)**
   - What we know: The conversation happens in WhatsApp/Telegram — no rich UI, plain text only.
   - What's unclear: Should the bot present available slots as numbered list ("1. Monday 10:00 AM, 2. Monday 11:00 AM...") or ask for freetext date then validate?
   - Recommendation: Use numbered list for available slots. Freetext date parsing is error-prone in plain-text channels. Generate the next 7 available slots and present as a numbered list. Customer replies with a number. Simpler, more robust, no NLP edge cases.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/lib/booking/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOK-01 | State machine activates on `book_session` intent with `booking_enabled=true` | unit | `npx vitest run tests/lib/booking/state-machine.test.ts` | ❌ Wave 0 |
| BOOK-01 | State machine does NOT activate when `booking_enabled=false` | unit | `npx vitest run tests/lib/booking/state-machine.test.ts` | ❌ Wave 0 |
| BOOK-03 | Location options filtered correctly per facility type | unit | `npx vitest run tests/lib/booking/state-machine.test.ts` | ❌ Wave 0 |
| BOOK-05 | `find_next_available_slots` RPC returns ≤ 3 results skipping full slots | unit (mocked RPC) | `npx vitest run tests/lib/booking/slot-checker.test.ts` | ❌ Wave 0 |
| BOOK-06 | Concurrent slot requests: exactly one succeeds | unit (mocked RPC returns slot_full on second) | `npx vitest run tests/lib/booking/slot-checker.test.ts` | ❌ Wave 0 |
| BOOK-08 | Summary step formats all collected fields and waits for confirm | unit | `npx vitest run tests/lib/booking/state-machine.test.ts` | ❌ Wave 0 |
| BOOK-09 | Booking submitted as `pending` after customer confirm | unit | `npx vitest run tests/lib/booking/state-machine.test.ts` | ❌ Wave 0 |
| BOOK-13 | Unisex Bed blocks gender conflict (mocked RPC returns `gender_conflict`) | unit | `npx vitest run tests/lib/booking/slot-checker.test.ts` | ❌ Wave 0 |
| BOOK-TTL | Expired state (>30 min) is cleared and customer informed | unit | `npx vitest run tests/lib/booking/state-machine.test.ts` | ❌ Wave 0 |
| BADM-03 | PATCH /api/bookings/[botId] with action=confirm returns 200 | unit | `npx vitest run tests/api/bookings.test.ts` | ❌ Wave 0 |
| BADM-04 | POST /api/bookings/[botId] walk-in creates status=walk_in | unit | `npx vitest run tests/api/bookings.test.ts` | ❌ Wave 0 |
| BADM-06 | Each status change appends to audit_log | unit | `npx vitest run tests/api/bookings.test.ts` | ❌ Wave 0 |
| NOTIF-01 | Confirm action fires n8n webhook POST | unit (mocked fetch) | `npx vitest run tests/lib/booking/notifications.test.ts` | ❌ Wave 0 |
| NOTIF-02/03 | Dispatch route queries reminders/surveys and calls n8n | unit | `npx vitest run tests/api/notifications.test.ts` | ❌ Wave 0 |
| NOTIF-04 | After 3 failures, `reminder_retry_count` = 3 and `reminder_sent` stays false | unit | `npx vitest run tests/api/notifications.test.ts` | ❌ Wave 0 |
| BOOK-10/11/12 | Path branching: member vs non-member vs meeting room | unit | `npx vitest run tests/lib/booking/state-machine.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/booking/ tests/api/bookings.test.ts tests/api/notifications.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/booking/state-machine.test.ts` — covers BOOK-01, 03, 08, 09, 10, 11, 12, TTL, off-topic interrupt
- [ ] `tests/lib/booking/slot-checker.test.ts` — covers BOOK-05, 06, 13
- [ ] `tests/lib/booking/notifications.test.ts` — covers NOTIF-01 dispatch function
- [ ] `tests/api/bookings.test.ts` — covers BADM-03, 04, 06
- [ ] `tests/api/notifications.test.ts` — covers NOTIF-02, 03, 04 cron dispatch route

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `supabase/migrations/00002_schema.sql` through `00009_bot_config.sql` — existing schema, confirmed table structure
- Codebase direct read — `app/api/chat/[botId]/route.ts` — existing chat route structure, confirmed integration point
- Codebase direct read — `lib/rag/logger.ts` — confirmed `getOrCreateConversation` does not return metadata
- Codebase direct read — `vitest.config.ts`, `tests/setup.ts` — confirmed test infrastructure
- CONTEXT.md — all locked decisions are authoritative for this research
- UI-SPEC.md — confirmed shadcn components to install, color/typography contracts
- package.json — confirmed library versions in use

### Secondary (MEDIUM confidence)
- Vercel Cron documentation pattern — `Authorization: Bearer <CRON_SECRET>` header and `vercel.json` `crons` array are established Vercel patterns (verified against known Vercel docs behavior; `CRON_SECRET` auto-injection is a well-documented Vercel feature)
- Supabase `rpc()` for `FOR UPDATE` — the supabase-js v2 query builder does not expose `FOR UPDATE` directly; PL/pgSQL RPC is the documented workaround (HIGH confidence based on direct knowledge of supabase-js v2 API surface)

### Tertiary (LOW confidence)
- `find_next_available_slots` PL/pgSQL loop pattern — the algorithm is conceptually correct but the exact PL/pgSQL syntax may need adjustment during migration authoring; treat as a reference implementation to be tested.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in package.json; no new dependencies needed beyond shadcn components
- Architecture: HIGH — state machine pattern, RPC pattern, and cron pattern are well-understood; specific SQL functions are MEDIUM (need testing)
- Pitfalls: HIGH — all pitfalls derived from reading actual code and known constraints, not speculation

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack; no fast-moving dependencies)
