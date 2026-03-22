# Phase 6: Analytics - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build reporting and analytics views for the admin dashboard: message volume, intent breakdown, unanswered queries, response latency, booking reports (confirmed bookings, cancellations, facility breakdown, location volume, booking funnel), customer satisfaction (survey responses), and CSV export for every report. All reports are scoped per bot via a bot selector. Analytics are read-only — no configuration, no mutations.

</domain>

<decisions>
## Implementation Decisions

### Page Structure & Navigation
- Single `/dashboard/analytics` page (existing placeholder) with **tabs**: Message Stats | Booking Reports | Survey
- **Bot selector dropdown at top of page** — same pattern as `/dashboard/bookings` (Phase 5). A bot must be selected before any data loads
- Sidebar nav "Analytics" link already points to `/dashboard/analytics` — no changes needed to `app/dashboard/layout.tsx`
- All 12 analytics requirements live within these three tabs (no sub-routes)

### Booking Funnel (ANAL-11)
- Presented as a **simple stat row** with 4 boxes: Enquiries → Submitted → Confirmed → Attended, each showing count and conversion percentage
- No funnel chart component needed — plain stat cards in a horizontal row

### Charting Library
- **shadcn/ui Charts (Recharts wrapper)** — install with `npx shadcn@latest add chart` which adds `recharts` dependency
- Consistent with existing shadcn/ui stack. No additional opinionated libraries (no Tremor)
- Message volume chart (ANAL-01): **area/line chart** — X-axis = days, Y-axis = message count
- Intent breakdown chart (ANAL-02): **horizontal bar chart** — each intent (browse_product / health_issue / book_session / faq / unknown) as a bar with count and percentage

### Date Filter
- **Global date filter at top of page** — one selector that applies to all report sections simultaneously
- Options: **today / 7d / 30d preset toggle buttons** + a **"Custom" option** that opens a date range calendar using `components/ui/calendar.tsx` (already installed) and `components/ui/popover.tsx` (already installed)
- All API queries for analytics must accept `from` and `to` date parameters derived from the selected filter

### CSV Export
- **Export button per report section** — each report card has its own "Export CSV" button
- Export respects the **currently selected date filter** — downloads exactly the data visible on screen
- No global export panel or ZIP downloads
- CSV generation happens client-side from the fetched data (no dedicated export API route needed)

### Claude's Discretion
- Exact SQL queries / Supabase RPCs vs direct table queries for analytics data
- Whether to create DB views or functions for complex aggregations (e.g., booking funnel counts, p50/p95 latency)
- Loading skeleton design for chart areas
- Exact card layout density and spacing within tabs
- Empty state messaging when no data exists for the selected period

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Analytics Requirements
- `.planning/REQUIREMENTS.md` §Analytics & Reporting (ANAL-01 through ANAL-12) — exact acceptance criteria for every report: message volume, intent breakdown, unanswered queries, latency p50/p95, confirmed bookings, cancellations, facility breakdown, location volume, audit trail, survey report, booking funnel, CSV export

### Existing Schema (MUST read before writing queries or migrations)
- `supabase/migrations/00002_schema.sql` — `messages` table with fields: `bot_id`, `intent`, `rag_found`, `latency_ms`, `created_at`, `role`; `conversations` table with `channel` field (messages join conversations for channel filtering per ANAL-01)
- `supabase/migrations/00010_bookings.sql` — `bookings` table with: `bot_id`, `status`, `facility_type`, `location`, `session_start`, `survey_response jsonb`, `audit_log jsonb`, `channel`, `created_at`; also `facilities_config` table

### Architecture Constraints
- `.planning/PROJECT.md` §Constraints — Next.js App Router, shadcn/ui only, Tailwind CSS, service role key never in NEXT_PUBLIC_, Vercel hosting
- `.planning/PROJECT.md` §Key Decisions — bot_id is the universal isolation key; RLS enforced on all queries

### Existing Dashboard Patterns (MUST read before building analytics page)
- `app/dashboard/bookings/page.tsx` — reference for bot-selector-at-top pattern, Card layout, 'use client' + useParams/useState, filter bar
- `app/dashboard/bots/[botId]/api-keys/page.tsx` — reference for Card + CardHeader + CardContent layout, toast pattern
- `components/ui/tabs.tsx` — use for Message Stats | Booking Reports | Survey tab navigation
- `components/ui/calendar.tsx` — use for custom date range picker (already installed)
- `components/ui/popover.tsx` — use to wrap the custom date range calendar picker (already installed)

### Last Migration Reference
- `supabase/migrations/00010_bookings.sql` — last migration; any new Phase 6 migrations (e.g., analytics SQL views/functions) start at `00011`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/tabs.tsx` — already installed; use for the three-tab layout (Message Stats | Booking Reports | Survey)
- `components/ui/calendar.tsx` — already installed; use for custom date range picker in global filter
- `components/ui/popover.tsx` — already installed; wrap the date range calendar in a popover
- `components/ui/badge.tsx` — use for channel badges (WhatsApp / Telegram) and status badges in reports
- `components/ui/card.tsx`, `button.tsx`, `select.tsx` — all present; use for layout and bot selector
- `components/ui/sonner.tsx` (toast) — already in use; use for CSV export confirmation toast

### Established Patterns
- **Bot selector at top** — `/dashboard/bookings/page.tsx` has this exact pattern; replicate for analytics
- **'use client' + useState for filters** — all dashboard pages use client components for interactive state
- **Service role client for data fetches** — `lib/supabase/service.ts`; analytics queries use service role to bypass RLS for aggregate reads
- **Card + CardHeader + CardContent** — standard layout for every admin section
- **bot_id isolation** — every query must be scoped by the selected bot_id

### Integration Points
- `app/dashboard/analytics/page.tsx` — currently a placeholder stub; Phase 6 builds this out entirely
- `app/api/analytics/[botId]/route.ts` — new: API routes for analytics data (message stats, intent breakdown, unanswered, latency, booking reports, survey)
- `supabase/migrations/00011_analytics.sql` — new (if needed): SQL views or RPCs for complex aggregations (p50/p95, funnel counts)

</code_context>

<specifics>
## Specific Ideas

- The global date filter should be visually prominent at the top of the page — a segmented button group for today / 7d / 30d, with a "Custom" button that opens a date range picker popover
- Unanswered queries log (ANAL-03) should show the query text grouped by exact match or near-match frequency — a table sorted by frequency descending with the actual message content and count

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-analytics*
*Context gathered: 2026-03-22*
