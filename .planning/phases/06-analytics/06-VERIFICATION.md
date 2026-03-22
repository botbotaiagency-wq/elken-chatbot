---
phase: 06-analytics
verified: 2026-03-23T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 11/12
  gaps_closed:
    - "ANAL-05 location filter correctly sends query param on all re-fetch paths"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Bot selector gate — open /dashboard/analytics before selecting a bot"
    expected: "Only heading and bot selector visible; tabs and date filter are hidden"
    why_human: "Requires browser rendering to confirm conditional render"
  - test: "Date filter button toggle — click Today, then 7 days"
    expected: "Active button changes to 'default' variant and all data cards refresh"
    why_human: "Requires interaction and visual feedback observation"
  - test: "CSV export download — click Export CSV on Message Volume card"
    expected: "Browser downloads a .csv file; toast 'Report exported.' appears"
    why_human: "Requires browser Blob download and toast rendering"
  - test: "ANAL-05 location filter — select Old Klang Road, then switch date preset"
    expected: "Confirmed bookings reload filtered to Old Klang Road only; network request URL contains &location=okr"
    why_human: "Requires browser network tab observation to confirm correct query param is sent"
---

# Phase 6: Analytics Verification Report

**Phase Goal:** Deliver a fully functional analytics dashboard that surfaces message stats, booking reports, and survey data with CSV export, date filtering, and bot-selector gating — covering all 12 ANAL requirements.
**Verified:** 2026-03-23
**Status:** human_needed (all automated checks pass — 3 pre-existing human checks + 1 ANAL-05 confirmation)
**Re-verification:** Yes — after ANAL-05 bug fix

---

## Re-verification Summary

**Previous status:** gaps_found (11/12)
**Current status:** human_needed (12/12 automated)

**Gap closed:** The ANAL-05 blocker has been resolved. The main data-fetching `useEffect` at line 268 of `app/dashboard/analytics/page.tsx` now correctly passes `locationExtra` (e.g. `location=okr`) as the `extra` argument to `fetchWithCache`, rather than the former cache-key suffix string (`confirmed:okr`).

**Fix verification path:**

- Line 267: `const locationExtra = confirmedLocation !== 'all' ? \`location=${confirmedLocation}\` : undefined`
- Line 268: `fetchWithCache<any[]>('confirmed', setConfirmedData, locationExtra)` — `locationExtra` is the URL query param string
- `fetchWithCache` (line 235–254): passes `extra` to `fetchReport(..., extra)` unchanged
- `fetchReport` (line 188–195): appends `extra` as `&${extra}` to the API URL — `&location=okr` is sent correctly
- Cache key (line 240): built as `...:confirmed:location=okr` — unique per location, no collision with unfiltered cache entry
- The old pattern `confirmed:${confirmedLocation}` now only appears at line 286 inside the dedicated `confirmedLocation` useEffect, where it is correctly used as a cache key (not a URL param)

**Regressions:** None. All 8 required artifacts retain identical line counts to the initial verification.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Test stubs exist for all 11 API report types and downloadCsv | VERIFIED | tests/api/analytics.test.ts (87 lines, 11 describe blocks ANAL-01..ANAL-11); tests/lib/csv.test.ts (29 lines, 6 it() blocks ANAL-12) |
| 2 | GET /api/analytics/[botId] dispatches all 11 report types | VERIFIED | app/api/analytics/[botId]/route.ts — handlers map covers all 11 keys; imports all 11 query functions from @/lib/analytics/queries |
| 3 | SQL RPCs exist for aggregate queries | VERIFIED | supabase/migrations/00011_analytics.sql — 5 SECURITY DEFINER functions: get_message_volume, get_intent_breakdown, get_unanswered_queries, get_latency_stats, get_booking_funnel |
| 4 | downloadCsv() generates valid CSV with escaping and triggers browser download | VERIFIED | lib/analytics/csv.ts — escapeCell handles commas/quotes/objects, Blob with text/csv, anchor click, early return on empty array |
| 5 | Query library exports 11 functions covering all ANAL data requirements | VERIFIED | lib/analytics/queries.ts — 11 export async functions confirmed; RPC-based (volume, intent, unanswered, latency, funnel); direct table queries (confirmed, cancellations, facility, location, audit, survey) |
| 6 | Analytics dashboard renders 3-tab layout with bot selector gate | VERIFIED | app/dashboard/analytics/page.tsx (1174 lines); selectedBotId gate wraps all tabs; 3 TabsTrigger values confirmed |
| 7 | Message Stats tab shows all 4 report cards (ANAL-01..ANAL-04) | VERIFIED | AreaChart for message volume (h-[200px]), BarChart layout="vertical" for intent (h-[180px]), unanswered table with "Query"/"Count", p50/p95 stat display — all present |
| 8 | Date filter works with today/7d/30d/custom presets | VERIFIED | 4 buttons present (h-11 class, aria-pressed), Popover Calendar mode="range" wired, getDateRange() computes correct ranges |
| 9 | Booking Reports tab shows 6 report cards (ANAL-05..ANAL-09, ANAL-11) | VERIFIED | Confirmed Bookings with location Select, Booking Funnel grid-cols-4 with conversion %, Facility Breakdown BarChart, Location Volume grid-cols-2, Cancellations table, Full Audit Trail table |
| 10 | Survey tab shows Customer Satisfaction table (ANAL-10) | VERIFIED | TabsContent value="survey" contains Customer Satisfaction card with survey_response extraction |
| 11 | CSV export on every report section (ANAL-12) | VERIFIED | downloadCsv imported and called in handleExport(); export button on every card; toast.success('Report exported.') confirmed |
| 12 | ANAL-05 location filter correctly sends query param on all re-fetch paths | VERIFIED | Line 267 computes `locationExtra = 'location=okr'`; line 268 passes `locationExtra` to `fetchWithCache`; `fetchWithCache` passes it to `fetchReport` which appends `&location=okr` to the URL. Both the main useEffect (date/tab change) and the dedicated confirmedLocation useEffect now send the correct query param. |

**Score:** 12/12 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/api/analytics.test.ts` | 11 report type stubs | VERIFIED | 87 lines, 11 report describe blocks, 14 test cases, all passing with placeholder assertions |
| `tests/lib/csv.test.ts` | downloadCsv stubs | VERIFIED | 29 lines, 6 it() blocks covering all CSV behaviors |
| `components/ui/chart.tsx` | ChartContainer/ChartTooltip wrappers | VERIFIED | shadcn chart, recharts in package.json at ^2.15.4 |
| `supabase/migrations/00011_analytics.sql` | 5 SQL RPCs | VERIFIED | Exactly 5 CREATE OR REPLACE FUNCTION, SECURITY DEFINER on all functions |
| `lib/analytics/csv.ts` | downloadCsv export | VERIFIED | 41 lines, escapeCell helper, Blob creation, anchor click, early return on empty |
| `lib/analytics/queries.ts` | 11 query functions | VERIFIED | 193 lines, 11 export async functions confirmed |
| `app/api/analytics/[botId]/route.ts` | GET route with 11 report dispatch | VERIFIED | 69 lines, await params, createServiceClient, handlers map for all 11 reports, 400/500 error responses |
| `app/dashboard/analytics/page.tsx` | Complete analytics dashboard | VERIFIED | 1174 lines (well above 300 min_lines), all 3 tabs, bot gate, date filter, charts, tables, CSV exports, loading/error/empty states |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/analytics/[botId]/route.ts` | `supabase.rpc('get_latency_stats')` | import from @/lib/analytics/queries, getLatencyStats calls rpc | WIRED | route imports getLatencyStats; queries.ts calls supabase.rpc('get_latency_stats', ...) |
| `app/api/analytics/[botId]/route.ts` | `supabase.rpc('get_message_volume')` | import from @/lib/analytics/queries, getMessageVolume calls rpc | WIRED | route imports getMessageVolume; queries.ts calls supabase.rpc('get_message_volume', ...) |
| `app/dashboard/analytics/page.tsx` | `/api/analytics/[botId]` | fetch calls in fetchReport helper | WIRED | fetchReport line 191: `/api/analytics/${botId}?report=${report}&from=...&to=...${extraQ}` |
| `app/dashboard/analytics/page.tsx` | `lib/analytics/csv.ts` | downloadCsv import | WIRED | import at line 36; used in handleExport() |
| `app/dashboard/analytics/page.tsx` | `components/ui/chart.tsx` | ChartContainer import | WIRED | import ChartContainer, ChartTooltip, ChartTooltipContent; used in AreaChart and BarChart cards |
| Page confirmedLocation state | confirmed fetch URL `&location=X` | fetchWithCache extra param (main useEffect) | WIRED | Line 267 computes locationExtra; line 268 passes it to fetchWithCache; fetchReport appends `&location=okr` to URL. Cache key uses `location=okr` suffix to stay unique. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ANAL-01 | 06-00, 06-01, 06-02 | Message volume chart (today/7d/30d, by channel) | SATISFIED | AreaChart on message-stats tab, date presets wired, get_message_volume RPC by channel |
| ANAL-02 | 06-00, 06-01, 06-02 | Intent breakdown chart (5 intents) | SATISFIED | Horizontal BarChart, INTENT_LABELS map (5 entries + unknown), get_intent_breakdown RPC |
| ANAL-03 | 06-00, 06-01, 06-02 | Unanswered queries log (rag_found=false, by frequency) | SATISFIED | Unanswered Queries table, get_unanswered_queries filters rag_found=false, ORDER BY frequency DESC |
| ANAL-04 | 06-00, 06-01, 06-02 | Response latency p50/p95 | SATISFIED | Latency stat display, get_latency_stats uses percentile_cont(0.5) and percentile_cont(0.95) |
| ANAL-05 | 06-00, 06-01, 06-02 | Confirmed bookings report, filterable by location | SATISFIED | Confirmed Bookings card with location Select; bug fixed — main useEffect now passes `location=okr` as URL query param on date/tab re-fetches; both re-fetch paths (main useEffect and dedicated confirmedLocation useEffect) send the correct param |
| ANAL-06 | 06-00, 06-01, 06-02 | Cancellations report with audit history | SATISFIED | Cancellations card with Customer/Facility/Location/Session Date/Last Action columns, last audit_log entry shown |
| ANAL-07 | 06-00, 06-01, 06-02 | Facility type breakdown | SATISFIED | Facility Breakdown BarChart with FACILITY_DISPLAY labels (6 types), getFacilityBreakdown in queries |
| ANAL-08 | 06-00, 06-01, 06-02 | Location volume (OKR vs Subang) | SATISFIED | Location Volume grid-cols-2 with "Old Klang Road" and "Subang" stats, getLocationVolume in queries |
| ANAL-09 | 06-00, 06-01, 06-02 | Full audit trail report | SATISFIED | Full Audit Trail card expands audit_log jsonb arrays into flat rows, sorted by timestamp desc |
| ANAL-10 | 06-00, 06-01, 06-02 | Customer satisfaction survey responses | SATISFIED | Survey tab Customer Satisfaction table, getSurveyResponses filters non-null survey_response |
| ANAL-11 | 06-00, 06-01, 06-02 | Booking funnel (enquiry → submitted → confirmed → attended) | SATISFIED | Booking Funnel grid-cols-4 with conversion percentages, get_booking_funnel RPC with 4 stages |
| ANAL-12 | 06-00, 06-01, 06-02 | All reports exportable to CSV | SATISFIED | Export CSV button on every report card, downloadCsv called via handleExport, toast.success confirmed |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/api/analytics.test.ts` | 12 | `expect(true).toBe(true)` placeholder assertions | Info | Intentional Wave 0 stubs — tests must be replaced with real assertions before phase is considered fully test-covered; these pass but do not actually test the implementation |
| `tests/lib/csv.test.ts` | 7-28 | `expect(true).toBe(true)` placeholder assertions | Info | Same as above — CSV tests are stubs, not real coverage |

The blocker anti-pattern from the initial verification (line 268 passing cache-key suffix as URL query param) has been resolved. No new anti-patterns introduced.

---

## Human Verification Required

### 1. Bot Selector Gate

**Test:** Navigate to /dashboard/analytics in a logged-in browser session without selecting a bot.
**Expected:** Only the page heading and bot selector are visible. Tabs (Message Stats / Booking Reports / Survey) and date filter buttons are not rendered.
**Why human:** Requires browser rendering of the conditional gate block.

### 2. Date Filter Toggle Behavior

**Test:** Select a bot, then click each preset button (Today, 7 days, 30 days, Custom).
**Expected:** Active button highlights with default variant. Data cards show loading skeletons then populate with data matching the selected range. Custom opens a two-month calendar popover.
**Why human:** Requires interaction, visual feedback, and real network responses to confirm data refresh.

### 3. CSV Export Download

**Test:** Select a bot, wait for Message Volume to load, then click "Export CSV" on the Message Volume card.
**Expected:** Browser downloads a .csv file named `message-volume_{botId}_{from}_{to}.csv`. A toast notification "Report exported." appears bottom of screen.
**Why human:** Requires browser Blob download trigger and Sonner toast rendering.

### 4. ANAL-05 Location Filter End-to-End Confirmation

**Test:** Select a bot, navigate to Booking Reports tab, change location to "Old Klang Road", confirm results filter. Then click "7 days" date preset button.
**Expected:** Network request URL should contain `&location=okr`. Confirmed bookings re-fetch applies Old Klang Road filter correctly.
**Why human:** The code fix is verified statically. Browser network tab observation confirms the correct query param is sent in the live re-fetch and that the API returns filtered results.

---

## Gaps Summary

No code-level gaps remain. All 12 ANAL requirements have verified implementations. The ANAL-05 location filter bug (main useEffect sending `confirmed:okr` as URL param instead of `location=okr`) has been fixed. The fix correctly:

1. Computes `locationExtra` as a proper query param string (`location=okr`) before calling `fetchWithCache`
2. Passes `locationExtra` as the `extra` argument — which `fetchWithCache` forwards to `fetchReport` and which `fetchReport` appends as `&location=okr` to the API URL
3. Uses `locationExtra` in the cache key suffix (`...:confirmed:location=okr`) so cached filtered results do not collide with unfiltered ones

The remaining 4 human verification items are pre-existing (visual/interactive behaviors) and do not block code-level sign-off.

---

_Verified: 2026-03-23_
_Verifier: Claude (gsd-verifier)_
