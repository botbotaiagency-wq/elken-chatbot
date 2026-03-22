---
phase: 06-analytics
plan: "02"
subsystem: analytics-ui
tags: [analytics, dashboard, charts, recharts, csv-export, shadcn]
dependency_graph:
  requires: [06-01]
  provides: [analytics-dashboard-page]
  affects: [app/dashboard/analytics]
tech_stack:
  added: []
  patterns:
    - Client-side cache ref (useRef<Record>) keyed by botId:from:to:report
    - Bot selector gate pattern (identical to bookings page)
    - ChartContainer + Recharts AreaChart/BarChart via shadcn chart.tsx
    - downloadCsv client-side CSV generation with toast confirmation
    - Promise.allSettled parallel report fetching per tab
    - Native Date.toLocaleDateString (no date-fns)
key_files:
  created: []
  modified:
    - app/dashboard/analytics/page.tsx
decisions:
  - Analytics page combines all 12 ANAL requirements in a single 'use client' component with 3 tabs
  - Client-side cache ref used instead of SWR/React Query — no new dependencies added
  - Both Task 1 and Task 2 committed as one atomic commit (single file artifact)
metrics:
  duration: "187s"
  completed: "2026-03-22"
  tasks_completed: 2
  files_modified: 1
---

# Phase 6 Plan 02: Analytics Dashboard UI Summary

Full analytics dashboard page built at `/dashboard/analytics`, replacing the stub with a complete 3-tab layout covering all 12 ANAL requirements.

## What Was Built

Analytics dashboard page at `app/dashboard/analytics/page.tsx` (1169 lines) with:

- Bot selector gate — no tabs or date filter shown until a bot is selected
- Global date filter bar — Today / 7 days / 30 days preset buttons + Custom range Calendar popover
- Three tabs with client-side fetch cache per report

**Message Stats tab (ANAL-01 through ANAL-04):**
- Message Volume area chart (AreaChart, 200px, aggregated by day)
- Intent Breakdown horizontal bar chart (BarChart layout="vertical", 180px, display labels including "Unknown" for "general")
- Unanswered Queries table sorted by frequency
- Response Latency p50/p95 stat display

**Booking Reports tab (ANAL-05 through ANAL-09, ANAL-11):**
- Confirmed Bookings count with location filter (All / Old Klang Road / Subang)
- Booking Funnel 4-box stat row (grid-cols-4) with conversion percentages
- Facility Breakdown horizontal bar chart with display labels
- Location Volume two-stat row (OKR vs Subang)
- Cancellations table with audit trail preview (last action)
- Full Audit Trail table expanding booking audit_log jsonb arrays into flat rows, sorted by timestamp desc

**Survey tab (ANAL-10):**
- Customer Satisfaction table with rating and comments from survey_response jsonb

**All cards have:**
- Export CSV button (Download icon, outline variant, disabled when no data)
- Loading skeleton (animate-pulse bg-muted rounded)
- Error state ("Could not load data")
- Empty state ("No data for this period" or "No records for this period.")
- toast.success("Report exported.") on CSV download

## Verification

Build output: `npx next build` passes cleanly, `/dashboard/analytics` listed as dynamic route.

Grep verifications passed:
- `'use client'` present
- `ChartContainer`, `downloadCsv`, `TabsTrigger` imports present
- "Booking Funnel", "Customer Satisfaction", "grid grid-cols-4", "Full Audit Trail" all present

## Deviations from Plan

### Minor Implementation Notes

**1. [Rule 3 - Implementation] Tasks 1 and 2 implemented in single pass**
- Both tasks modify the same file (`app/dashboard/analytics/page.tsx`)
- Built and committed as one complete artifact since the file cannot be half-built
- All acceptance criteria for both tasks verified before commit

**2. [Rule 2 - Auto-add] confirmedLocation fetch uses correct cache key pattern**
- Plan spec had a slight ambiguity in cache key for confirmed-with-location
- Resolved: cache key is `${botId}:${from}:${to}:confirmed:${confirmedLocation}` for location-filtered fetches, separate useEffect re-fetches when confirmedLocation changes

None — plan executed as written. No architectural changes required.

## Self-Check: PASSED

- FOUND: app/dashboard/analytics/page.tsx
- FOUND commit: 7a7ef5e feat(06-02): build complete analytics dashboard page
