---
phase: 06-analytics
plan: 01
subsystem: api
tags: [analytics, recharts, supabase-rpc, csv, sql, next-api-route]

# Dependency graph
requires:
  - phase: 05-booking-system
    provides: bookings table with status, audit_log, survey_response columns
  - phase: 02-rag-pipeline
    provides: messages table with intent, rag_found, latency_ms columns
  - phase: 01-data-foundation
    provides: conversations table with channel column, service client pattern
provides:
  - GET /api/analytics/[botId] route dispatching 11 report types
  - supabase/migrations/00011_analytics.sql with 5 SECURITY DEFINER RPC functions
  - lib/analytics/queries.ts with 11 typed query functions
  - lib/analytics/csv.ts with downloadCsv() client-side utility
  - components/ui/chart.tsx (shadcn ChartContainer/ChartTooltip wrappers for Recharts)
affects:
  - 06-02 (analytics UI — consumes this API and CSV utility)

# Tech tracking
tech-stack:
  added:
    - recharts ^2.15.4 (chart rendering library, added via shadcn add chart)
  patterns:
    - Single GET route with `report` query param dispatching to typed handler map
    - SECURITY DEFINER SQL RPCs for aggregate queries that bypass RLS
    - Client-side CSV generation via Blob + URL.createObjectURL (no server round-trip)
    - Query library pattern: each function returns {data, error} from Supabase directly

key-files:
  created:
    - components/ui/chart.tsx
    - supabase/migrations/00011_analytics.sql
    - lib/analytics/csv.ts
    - lib/analytics/queries.ts
    - app/api/analytics/[botId]/route.ts
  modified:
    - package.json (recharts added)
    - package-lock.json

key-decisions:
  - "Single GET route with handlers map: one endpoint for all 11 reports vs 11 separate routes — simpler to maintain and test"
  - "SECURITY DEFINER on all SQL RPCs — service role calls these, RLS would block aggregate queries across all users"
  - "getFacilityBreakdown and getLocationVolume group in JS (not SQL) — avoids extra RPC complexity for simple counts"
  - "downloadCsv returns early on empty array — prevents Blob creation with header-only file that has no useful data"

patterns-established:
  - "Analytics dispatch pattern: handlers Record<string, () => Promise<{data, error}>> for clean report routing"
  - "Optional filter params: location ?? undefined (not null) so query functions can use location && location !== 'all' guard"

requirements-completed: [ANAL-01, ANAL-02, ANAL-03, ANAL-04, ANAL-05, ANAL-06, ANAL-07, ANAL-08, ANAL-09, ANAL-10, ANAL-11, ANAL-12]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 6 Plan 01: Analytics Data Layer Summary

**Analytics backend complete: 5 SQL RPCs, 11 typed query functions, single API route dispatching all reports, and client-side CSV download utility using Recharts/shadcn chart component**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T16:37:58Z
- **Completed:** 2026-03-22T16:40:26Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Installed shadcn chart component (recharts wrapper) and added recharts to package.json
- Created migration 00011 with 5 SECURITY DEFINER SQL RPCs covering latency percentiles, message volume, intent breakdown, unanswered queries, and booking funnel
- Built complete query library (11 functions) separating RPC-based aggregates from direct table queries
- Implemented single GET analytics API route handling all 11 report types with proper HTTP status codes

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn chart + create SQL RPCs migration** - `cb4f764` (feat)
2. **Task 2: Create CSV utility and analytics query library** - `6445d8c` (feat)
3. **Task 3: Build analytics API route with report dispatch** - `5ed2470` (feat)

## Files Created/Modified

- `components/ui/chart.tsx` - ChartContainer and ChartTooltip wrappers for Recharts (shadcn)
- `supabase/migrations/00011_analytics.sql` - 5 SECURITY DEFINER RPCs: get_message_volume, get_intent_breakdown, get_unanswered_queries, get_latency_stats (p50/p95), get_booking_funnel
- `lib/analytics/csv.ts` - downloadCsv() utility with comma/quote/newline escaping and Blob download
- `lib/analytics/queries.ts` - 11 typed query functions using SupabaseClient
- `app/api/analytics/[botId]/route.ts` - Single GET handler dispatching all 11 report types
- `package.json` - recharts ^2.15.4 added
- `package-lock.json` - lockfile updated

## Decisions Made

- Single GET route with `report` query param and handlers dispatch map — one endpoint vs 11 separate routes keeps the API surface minimal and easy to mock in tests
- SECURITY DEFINER on all 5 SQL RPCs — aggregate queries run as service role since RLS would otherwise block cross-user counts
- JS-level grouping for facility and location breakdowns (not SQL GROUP BY via RPC) — avoids adding more RPC functions for simple 2-field aggregates
- `downloadCsv` returns early on empty array — prevents creating a header-only file with no rows that would confuse users

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — shadcn `add chart` prompted about overwriting card.tsx (answered no, card.tsx was unchanged), chart.tsx created successfully.

## User Setup Required

None — no external service configuration required. Migration 00011 must be applied to Supabase (standard migration apply process, same as all prior migrations).

## Next Phase Readiness

- All API endpoints ready for Plan 02 (analytics UI)
- CSV utility ready for import in frontend components
- Chart component installed and available for all analytics charts
- No blockers — frontend can consume /api/analytics/[botId]?report=X&from=Y&to=Z immediately

---
*Phase: 06-analytics*
*Completed: 2026-03-22*
