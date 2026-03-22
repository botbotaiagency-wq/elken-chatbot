# Phase 6: Analytics - Research

**Researched:** 2026-03-22
**Domain:** Next.js App Router analytics dashboard — Recharts via shadcn/ui chart, Supabase aggregate queries, PostgreSQL percentile functions, CSV export
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page Structure & Navigation**
- Single `/dashboard/analytics` page (existing placeholder) with tabs: Message Stats | Booking Reports | Survey
- Bot selector dropdown at top of page — same pattern as `/dashboard/bookings`. A bot must be selected before any data loads
- Sidebar nav "Analytics" link already points to `/dashboard/analytics` — no changes needed to `app/dashboard/layout.tsx`
- All 12 analytics requirements live within these three tabs (no sub-routes)

**Booking Funnel (ANAL-11)**
- Presented as a simple stat row with 4 boxes: Enquiries → Submitted → Confirmed → Attended, each showing count and conversion percentage
- No funnel chart component needed — plain stat cards in a horizontal row

**Charting Library**
- shadcn/ui Charts (Recharts wrapper) — install with `npx shadcn@latest add chart` which adds `recharts` dependency
- Consistent with existing shadcn/ui stack. No additional opinionated libraries (no Tremor)
- Message volume chart (ANAL-01): area/line chart — X-axis = days, Y-axis = message count
- Intent breakdown chart (ANAL-02): horizontal bar chart — each intent as a bar with count and percentage

**Date Filter**
- Global date filter at top of page — one selector that applies to all report sections simultaneously
- Options: today / 7d / 30d preset toggle buttons + a "Custom" option that opens a date range calendar using `components/ui/calendar.tsx` and `components/ui/popover.tsx` (both already installed)
- All API queries for analytics must accept `from` and `to` date parameters

**CSV Export**
- Export button per report section — each report card has its own "Export CSV" button
- Export respects the currently selected date filter
- CSV generation happens client-side from the fetched data (no dedicated export API route needed)

### Claude's Discretion
- Exact SQL queries / Supabase RPCs vs direct table queries for analytics data
- Whether to create DB views or functions for complex aggregations (e.g., booking funnel counts, p50/p95 latency)
- Loading skeleton design for chart areas
- Exact card layout density and spacing within tabs
- Empty state messaging when no data exists for the selected period

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANAL-01 | Total message volume chart: today / 7d / 30d, filterable by channel | messages table + conversations join for channel; aggregate by day/hour; AreaChart from shadcn chart |
| ANAL-02 | Intent breakdown: browse_product / health_issue / book_session / faq / unknown | messages table GROUP BY intent; horizontal BarChart layout="vertical" |
| ANAL-03 | Unanswered queries log: messages where rag_found = false, sorted by frequency | messages table WHERE rag_found = false GROUP BY content ORDER BY count DESC |
| ANAL-04 | Response latency p50/p95 per bot | PostgreSQL percentile_cont(0.5) / percentile_cont(0.95) WITHIN GROUP on latency_ms; RPC recommended |
| ANAL-05 | Confirmed bookings report: total confirmed per period, filterable by location | bookings WHERE status = 'confirmed' with date and location filter |
| ANAL-06 | Cancellation requests report: all cancellations with timestamps and full audit history | bookings WHERE status = 'cancelled' with audit_log jsonb rendered per row |
| ANAL-07 | Facility type breakdown: sessions booked by facility type | bookings GROUP BY facility_type; horizontal BarChart |
| ANAL-08 | Location volume: Old Klang Road vs Subang | bookings GROUP BY location; two-stat display row |
| ANAL-09 | Full audit trail: complete change log for all calendar edits and cancellations | bookings with non-empty audit_log; expand audit_log jsonb array into table rows |
| ANAL-10 | Customer satisfaction: post-session survey responses | bookings WHERE survey_response IS NOT NULL; render survey_response jsonb fields as table columns |
| ANAL-11 | Booking funnel: enquiry started → booking submitted → confirmed → attended | 4 counts from bookings + messages tables; plain 4-box stat row (no chart component) |
| ANAL-12 | All reports exportable to CSV | Client-side CSV generation from fetched arrays; one export button per report card |
</phase_requirements>

---

## Summary

Phase 6 builds out the analytics dashboard at `app/dashboard/analytics/page.tsx` (currently a stub) into a fully interactive reporting page. The page uses a three-tab layout (Message Stats | Booking Reports | Survey) with a global bot selector and date filter that apply to all sections simultaneously.

All data already exists in the schema from prior phases. The `messages` table (from migration `00002_schema.sql`) holds `intent`, `rag_found`, `latency_ms`, and links to `conversations` (which has `channel`). The `bookings` table (from `00010_bookings.sql`) holds `status`, `facility_type`, `location`, `audit_log` jsonb, `survey_response` jsonb, and `created_at`. No new schema columns are needed. The only schema work is optional: SQL views or RPCs for complex aggregations (p50/p95 latency, booking funnel counts) placed in migration `00011_analytics.sql`.

The charting library is Recharts via `npx shadcn@latest add chart` — `recharts` is not yet installed. The `chart.tsx` component is not yet in `components/ui/`. CSV export is fully client-side: the already-fetched data array is serialized to a blob and downloaded via a temporary `<a>` element. The existing project conventions (service role client, `params` as `Promise<{botId}>`, `'use client'` + useState, Card layout) apply unchanged.

**Primary recommendation:** Build `app/api/analytics/[botId]/route.ts` as a single GET handler with a `report` query param that dispatches to the correct Supabase query, and drive all tab sections from one client-side data loader that re-fetches when `botId`, `dateFrom`, or `dateTo` changes.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | latest (16.x in project) | Page and API route framework | Project-locked decision |
| Supabase JS (`@supabase/supabase-js`) | latest (installed) | Database queries | Project-locked decision |
| recharts | 2.x (via `npx shadcn@latest add chart`) | Chart rendering | shadcn/ui chart wrapper; project-locked decision |
| shadcn/ui chart (`components/ui/chart.tsx`) | n/a (shadcn CLI) | ChartContainer, ChartTooltip, AreaChart, BarChart wrappers | Project-locked decision |
| Tailwind CSS | 3.4.x (installed) | Styling | Project-locked |
| lucide-react | 0.511.x (installed) | Icons (Download icon for Export CSV) | Project standard |
| sonner | 2.0.x (installed) | Toast on CSV export success | Project standard |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `components/ui/tabs.tsx` | installed | Tab navigation (3 tabs) | Three-tab page layout |
| `components/ui/calendar.tsx` | installed | Custom date range picker | "Custom" date filter option |
| `components/ui/popover.tsx` | installed | Wraps the custom date range calendar | Custom date filter |
| `components/ui/badge.tsx` | installed | Channel badges (WhatsApp/Telegram) | Message volume channel filter display |
| `components/ui/card.tsx` | installed | Report section wrappers | All report cards |
| `components/ui/select.tsx` | installed | Bot selector dropdown | Bot selector at top of page |
| `lib/supabase/service.ts` | project | Service role Supabase client | Analytics API routes (bypass RLS for aggregates) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui chart (Recharts) | Tremor | Tremor ruled out by user decision — shadcn/ui only |
| shadcn/ui chart (Recharts) | Chart.js | No reason to add another charting library |
| Client-side CSV | Server-side CSV route | Server-side adds an API route with no benefit; client already has the data |
| Supabase RPC for p50/p95 | JS-side percentile calculation | DB-side is more accurate and avoids sending all latency_ms values to client |

**Installation (the one new step required):**
```bash
npx shadcn@latest add chart
```
This installs `recharts` into `node_modules` and creates `components/ui/chart.tsx`.

**Version verification (checked 2026-03-22):**
- recharts: 2.15.3 (latest as of search — installed by shadcn chart command, not pinned manually)
- All other packages already in `package.json`

---

## Architecture Patterns

### Recommended Project Structure

```
app/
  dashboard/
    analytics/
      page.tsx               # 'use client' — full analytics page
app/
  api/
    analytics/
      [botId]/
        route.ts             # GET handler with ?report= dispatch
lib/
  analytics/
    queries.ts               # Supabase query functions (message stats, booking stats, latency)
    csv.ts                   # Client-side CSV serialization utility
supabase/
  migrations/
    00011_analytics.sql      # Optional: SQL RPCs for p50/p95, funnel counts
```

### Pattern 1: Single API Route with Report Dispatch

**What:** `GET /api/analytics/[botId]?report={name}&from={iso}&to={iso}` — one route file handles all analytics queries via a `report` param switch.

**When to use:** The page fires multiple concurrent fetches (one per tab section or all at once). A single route avoids route proliferation and keeps middleware/auth consistent.

**Example:**
```typescript
// app/api/analytics/[botId]/route.ts
// Source: established pattern from app/api/bookings/[botId]/route.ts
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const url = new URL(req.url)
  const report = url.searchParams.get('report')   // 'message-volume' | 'intent' | 'unanswered' | 'latency' | etc.
  const from = url.searchParams.get('from')        // ISO datetime string
  const to = url.searchParams.get('to')            // ISO datetime string

  const supabase = createServiceClient()

  switch (report) {
    case 'message-volume': { /* ... */ }
    case 'intent':         { /* ... */ }
    case 'unanswered':     { /* ... */ }
    case 'latency':        { /* ... */ }
    case 'confirmed':      { /* ... */ }
    case 'funnel':         { /* ... */ }
    case 'facility':       { /* ... */ }
    case 'location':       { /* ... */ }
    case 'cancellations':  { /* ... */ }
    case 'audit':          { /* ... */ }
    case 'survey':         { /* ... */ }
    default: return Response.json({ error: 'unknown report' }, { status: 400 })
  }
}
```

### Pattern 2: Message Volume — Join messages + conversations for channel

**What:** `messages` does not have a `channel` column — it lives on `conversations`. To filter message volume by channel, join via `conversation_id`.

**Critical schema fact (HIGH confidence, from `00002_schema.sql`):**
- `messages.conversation_id` → `conversations.id`
- `conversations.channel` values: `'whatsapp' | 'telegram' | 'web'`
- `messages.bot_id` is directly on messages — use for primary filtering

```sql
-- Message volume per day with channel — Supabase JS query
-- Use .select with inner join notation or raw RPC
SELECT
  date_trunc('day', m.created_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS day,
  c.channel,
  COUNT(*) AS message_count
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE m.bot_id = $1
  AND m.created_at >= $2
  AND m.created_at <= $3
  AND m.role = 'user'          -- count inbound messages only
GROUP BY 1, 2
ORDER BY 1
```

Note: Supabase JS `select()` supports nested foreign table syntax but for aggregates with GROUP BY, use an RPC or raw SQL via `supabase.rpc()`. Direct `from('messages').select()` with `.eq()` filters works for simple counts but not date-truncated aggregates.

### Pattern 3: Latency p50/p95 — PostgreSQL percentile_cont

**What:** PostgreSQL has built-in ordered-set aggregate functions for percentiles. This is more accurate than JS-side calculation and avoids transmitting all latency values to the client.

**When to use:** Always — this is the standard PostgreSQL approach for percentile analytics.

```sql
-- RPC: get_latency_stats(p_bot_id, p_from, p_to)
CREATE OR REPLACE FUNCTION public.get_latency_stats(
  p_bot_id uuid,
  p_from   timestamptz,
  p_to     timestamptz
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'p50', ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)),
    'p95', ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))
  )
  FROM messages
  WHERE bot_id = p_bot_id
    AND created_at BETWEEN p_from AND p_to
    AND role = 'assistant'
    AND latency_ms IS NOT NULL;
$$;
```

**Confidence:** HIGH — `percentile_cont` is standard PostgreSQL (8.4+); Supabase supports all standard Postgres aggregate functions.

### Pattern 4: Booking Funnel Counts

**What:** The four funnel stages require querying different sources:
- Enquiries: `messages WHERE intent = 'book_session'` — intent classification indicates booking intent
- Submitted: `bookings WHERE status IN ('pending', 'confirmed', 'cancelled', 'no_show', 'walk_in')` — any booking row = submitted
- Confirmed: `bookings WHERE status IN ('confirmed', 'walk_in')`
- Attended: `bookings WHERE status = 'walk_in' OR (status = 'confirmed' AND session_start < now())` — approximation; no explicit "attended" status exists

**Important note:** There is no explicit `attended` status in the bookings schema. The closest proxy is: `status = 'confirmed' AND session_start < NOW()` (session has passed) OR `status = 'walk_in'`. This is a Claude's Discretion item — the planner should document this proxy in the plan.

### Pattern 5: Client-Side CSV Export

**What:** Convert the fetched data array to a CSV string and trigger a browser download via a temporary anchor element.

**When to use:** Any "Export CSV" button action — no server round-trip needed.

```typescript
// lib/analytics/csv.ts
export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? ''
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
        // Escape commas and quotes
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

### Pattern 6: Date Range Computation from Presets

**What:** The "today / 7d / 30d" preset buttons must compute `from` and `to` ISO strings client-side before passing to the API.

```typescript
function getDateRange(preset: 'today' | '7d' | '30d' | 'custom', custom?: { from: Date; to: Date }) {
  const now = new Date()
  const to = now.toISOString()
  if (preset === 'today') {
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    return { from: from.toISOString(), to }
  }
  if (preset === '7d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 7)
    return { from: from.toISOString(), to }
  }
  if (preset === '30d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 30)
    return { from: from.toISOString(), to }
  }
  // custom
  return {
    from: custom!.from.toISOString(),
    to: custom!.to.toISOString(),
  }
}
```

No `date-fns` needed — native Date arithmetic is sufficient per project convention (Phase 3 decision: manual relative time calculation to avoid extra dependency).

### Pattern 7: Unanswered Queries — Group by Exact Match

**What:** `messages WHERE rag_found = false AND role = 'user'` grouped by `content` with `COUNT(*) AS frequency`, ordered by frequency descending. Exact match grouping (not fuzzy/NLP grouping) as specified in CONTEXT.md.

```sql
SELECT content, COUNT(*) AS frequency
FROM messages
WHERE bot_id = $1
  AND rag_found = false
  AND role = 'user'
  AND created_at BETWEEN $2 AND $3
GROUP BY content
ORDER BY frequency DESC
LIMIT 100;
```

### Pattern 8: Tab Data Caching

Per UI-SPEC: switching tabs does NOT re-fetch if same bot + date range. Use a `useRef` cache object keyed by `{botId}:{from}:{to}:{reportName}` or fetch all reports for the active tab on mount/filter-change and store in state.

### Anti-Patterns to Avoid

- **RLS on analytics API routes:** The bookings page uses service role (`createServiceClient()`) for data fetches. Analytics must do the same — service role bypasses RLS for aggregate reads. Using the anon/session client would require the aggregate queries to satisfy RLS policies, which adds unnecessary complexity.
- **Sending all `latency_ms` values to the client for percentile calculation:** Use `percentile_cont` in a DB RPC. Sending 10,000 rows to compute p95 client-side is wasteful.
- **Importing `recharts` directly:** Always import chart primitives through `components/ui/chart.tsx` (the shadcn wrapper), not directly from `recharts`. The wrapper provides `ChartContainer`, `ChartTooltip`, and consistent theming via CSS variables.
- **Using `<AreaChart>` without `ChartContainer`:** `ChartContainer` is required — it injects the CSS variable config that maps `--chart-1` through `--chart-5` to chart colors.
- **Date filter reset on tab switch:** The UI-SPEC explicitly states the date filter persists across tab changes — do not reset `dateFrom`/`dateTo` state in the tab `onChange` handler.
- **Hardcoding `intent = 'general'` in intent breakdown:** The requirements specify `unknown` — but the messages schema stores `'general'` as an intent value (RAG-03: `browse_product / health_issue / book_session / faq / general`). The display label should be "Unknown" but the DB query must filter for `intent = 'general'` (not `'unknown'`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Area chart / Bar chart rendering | Custom SVG chart | `AreaChart`, `BarChart` via `components/ui/chart.tsx` (Recharts) | Recharts handles axes, tooltips, responsiveness, animation |
| p50/p95 percentile calculation | JS array sort + index math | `percentile_cont` PostgreSQL aggregate | Accurate, server-side, no data transfer overhead |
| CSV serialization | Custom string concat | `lib/analytics/csv.ts` utility (one small function) | Need proper quote-escaping for content with commas/newlines |
| Date range preset calculation | date-fns or day.js | Native `Date` arithmetic | Project convention: no extra date library (per Phase 3 decision) |
| Calendar date picker | Custom input | `components/ui/calendar.tsx` + `components/ui/popover.tsx` | Both already installed; project standard |
| Loading skeleton | Spinner or custom | `animate-pulse bg-muted rounded-md` div | Per UI-SPEC — pulse skeleton is the project pattern |

**Key insight:** Every hard problem in this phase (charts, percentiles, date picking, CSV download) already has a solved library or DB function in the project stack. The implementation is primarily wiring existing primitives together.

---

## Common Pitfalls

### Pitfall 1: intent field mismatch — 'general' vs 'unknown'

**What goes wrong:** ANAL-02 and ANAL-11 refer to "unknown" intent, but the messages schema stores `'general'` (from RAG-03). A query `WHERE intent = 'unknown'` returns zero rows.

**Why it happens:** The requirements doc uses "unknown" as the display label, but the implementation in Phase 2 uses `'general'` as the actual stored value.

**How to avoid:** In SQL queries and JS data processing, use `'general'` as the stored value. In chart labels, display it as "Unknown". Confirm by checking messages table data or `RAG-03` in REQUIREMENTS.md.

**Warning signs:** Intent breakdown chart shows 0 for "unknown" even though bot has unanswered queries.

### Pitfall 2: `recharts` not yet installed — chart.tsx missing

**What goes wrong:** `npx shadcn@latest add chart` has not been run. Importing `ChartContainer` from `@/components/ui/chart` fails with "Cannot find module" at build time.

**Why it happens:** `chart.tsx` is the one shadcn component NOT yet installed. All others (tabs, card, badge, select, calendar, popover, sonner) are confirmed present.

**How to avoid:** Wave 0 of planning must include `npx shadcn@latest add chart` as the first task. Verify `components/ui/chart.tsx` exists and `recharts` appears in `package.json` before writing any chart component code.

**Warning signs:** Build error referencing `@/components/ui/chart`.

### Pitfall 3: Supabase JS cannot do GROUP BY aggregates in `.select()` — use RPC

**What goes wrong:** Developers try `supabase.from('messages').select('intent, count(*)')` — this is not valid Supabase JS syntax for aggregate queries. The JS client requires either a raw SQL RPC or a DB view.

**Why it happens:** Supabase JS `.select()` maps to PostgREST which supports some aggregate operators but not arbitrary GROUP BY with COUNT(*) in the JS builder syntax.

**How to avoid:** For any query with `GROUP BY`, `COUNT(*)`, `percentile_cont`, or `date_trunc`: create an RPC function in `00011_analytics.sql` and call it via `supabase.rpc('function_name', params)`. For simple filtered fetches (e.g., cancellations list), `.from().select().eq()` is fine.

**Warning signs:** PostgREST 400 error or unexpected response shape from aggregate queries.

### Pitfall 4: `params` must be awaited — Next.js 16 requirement

**What goes wrong:** `const { botId } = params` without `await` throws a runtime error in Next.js 16 App Router.

**Why it happens:** Next.js 16 types `params` as `Promise<{botId: string}>` (confirmed project pattern from Phase 2 and Phase 5 API routes).

**How to avoid:** Always `const { botId } = await params` in route handlers. This is already established in `app/api/bookings/[botId]/route.ts`.

### Pitfall 5: `attended` stage in booking funnel has no explicit DB status

**What goes wrong:** There is no `status = 'attended'` in the bookings table. If you query `WHERE status = 'attended'`, you get zero rows.

**Why it happens:** The schema only has `pending | confirmed | cancelled | no_show | walk_in`. "Attended" is a derived concept.

**How to avoid:** Define "Attended" as `status IN ('confirmed', 'walk_in') AND session_start < NOW()`. Document this proxy in the plan. Walk-ins count as attended; confirmed bookings with a passed session time are treated as attended. The planner should confirm this interpretation.

### Pitfall 6: `audit_log` is jsonb array — iterate in JS not SQL

**What goes wrong:** Trying to query individual audit trail entries in SQL via PostgREST column filters on a jsonb array — this requires jsonb unnesting which is complex.

**Why it happens:** `audit_log` is stored as a jsonb array on each booking row, not as a separate table.

**How to avoid:** For ANAL-09 (full audit trail) and ANAL-06 (cancellations with audit history): fetch the bookings rows client-side and expand the `audit_log` array in JavaScript before rendering the table or serializing to CSV. No DB-side jsonb expansion needed.

---

## Code Examples

### shadcn Chart — AreaChart with ChartContainer

```typescript
// Source: shadcn/ui chart documentation pattern
// After running: npx shadcn@latest add chart
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'

const chartConfig: ChartConfig = {
  messages: {
    label: 'Messages',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

// data: [{ day: '2026-03-15', messages: 42 }, ...]
<ChartContainer config={chartConfig} className="h-[200px] w-full">
  <AreaChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="day" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Area
      type="monotone"
      dataKey="messages"
      stroke="var(--color-messages)"
      fill="var(--color-messages)"
      fillOpacity={0.3}
    />
  </AreaChart>
</ChartContainer>
```

### shadcn Chart — Horizontal BarChart for Intent Breakdown

```typescript
// Source: shadcn/ui chart documentation — layout="vertical" for horizontal bars
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

// data: [{ intent: 'browse_product', count: 120 }, ...]
<ChartContainer config={intentChartConfig} className="h-[180px] w-full">
  <BarChart data={data} layout="vertical">
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis type="number" />
    <YAxis type="category" dataKey="intent" width={120} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="count" fill="var(--color-intent)" radius={[0, 4, 4, 0]} />
  </BarChart>
</ChartContainer>
```

### Supabase RPC call pattern

```typescript
// Source: established pattern from lib/rag/retrieve.ts (supabase.rpc usage)
const { data, error } = await supabase.rpc('get_latency_stats', {
  p_bot_id: botId,
  p_from: from,
  p_to: to,
})
// data: { p50: 342, p95: 891 }
```

### Simple Supabase query with date range filter

```typescript
// Source: app/api/bookings/[botId]/route.ts pattern
const { data, error } = await supabase
  .from('bookings')
  .select('*')
  .eq('bot_id', botId)
  .eq('status', 'confirmed')
  .gte('created_at', from)
  .lte('created_at', to)
  .order('created_at', { ascending: false })
```

### calendar.tsx date range selection with Popover

```typescript
// Source: react-day-picker v9 (installed: ^9.14.0) API
// calendar.tsx uses react-day-picker — mode="range" for date range selection
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DateRange } from 'react-day-picker'

const [dateRange, setDateRange] = useState<DateRange | undefined>()

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm">
      {dateRange?.from && dateRange?.to
        ? `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d')}`
        : 'Custom'}
    </Button>
  </PopoverTrigger>
  <PopoverContent align="start" className="w-auto p-0">
    <Calendar
      mode="range"
      selected={dateRange}
      onSelect={setDateRange}
      numberOfMonths={2}
    />
  </PopoverContent>
</Popover>
```

Note: The calendar uses react-day-picker v9 (`^9.14.0` in package.json). The `format` helper either comes from `date-fns` (if already installed) or a simple native format function. Check `package.json` — if `date-fns` is not present, use `new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })` instead.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct recharts import | recharts via `npx shadcn@latest add chart` | shadcn chart added 2024 | Use `ChartContainer` wrapper; CSS variable color theming |
| `params.botId` in Next.js route handlers | `const { botId } = await params` | Next.js 15+ | Must await params — established in this project since Phase 2 |
| `middleware.ts` | `proxy.ts` | Next.js 16 | Already established in project — no change needed |

**Deprecated/outdated:**
- Tremor charts: User explicitly ruled out. Tremor has had API instability and is not in this project's stack.
- `date-fns` for date range labels: Not confirmed in `package.json`. Use native Date or `toLocaleDateString` to avoid adding a new dependency.

---

## Open Questions

1. **`attended` status approximation**
   - What we know: No `status = 'attended'` exists in the bookings schema. Walk-in (`walk_in`) and confirmed sessions with `session_start < NOW()` are the closest proxy.
   - What's unclear: Should walk-ins count toward "Attended"? Should no-shows be excluded from "Confirmed" in the funnel?
   - Recommendation: Define "Attended" as `COUNT(*) WHERE status IN ('confirmed', 'walk_in') AND session_start < NOW()`. Document this proxy in the plan. The planner should state this assumption clearly.

2. **date-fns availability for calendar date formatting**
   - What we know: `package.json` does not list `date-fns` as a dependency. `react-day-picker` v9 uses it internally but it may not be exposed as a direct import.
   - What's unclear: Whether `date-fns` is available transitively for the calendar "Custom" button label formatting.
   - Recommendation: Implement date formatting in the "Custom" button using `toLocaleDateString('en-US', { month: 'short', day: 'numeric' })` — no `date-fns` import needed, avoiding a hidden transitive dependency.

3. **`intent = 'general'` vs `'unknown'` label**
   - What we know: RAG-03 classifies into `browse_product / health_issue / book_session / faq / general`. ANAL-02 requirement lists `unknown`.
   - What's unclear: Whether any messages actually have `intent = 'unknown'` or whether all unmatched messages have `intent = 'general'`.
   - Recommendation: Query for `'general'` in SQL. Display as "Unknown" in the chart label. Include both in the query (`WHERE intent IN ('general', 'unknown')`) as a safety net.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | `vitest.config.ts` (exists at project root) |
| Quick run command | `npx vitest run tests/api/analytics.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANAL-01 | GET /api/analytics/[botId]?report=message-volume returns array of {day, count} | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-02 | GET ?report=intent returns array of {intent, count} for all 5 intents | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-03 | GET ?report=unanswered returns rows sorted by frequency DESC | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-04 | GET ?report=latency returns {p50, p95} numbers | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-05 | GET ?report=confirmed returns bookings with status=confirmed in date range | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-06 | GET ?report=cancellations returns bookings with status=cancelled | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-07 | GET ?report=facility returns {facility_type, count} groups | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-08 | GET ?report=location returns {okr: N, subang: N} | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-09 | GET ?report=audit returns bookings with non-empty audit_log | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-10 | GET ?report=survey returns bookings with survey_response not null | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-11 | GET ?report=funnel returns {enquiries, submitted, confirmed, attended} | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ Wave 0 |
| ANAL-12 | downloadCsv() produces valid CSV string with header row and escaped commas | unit | `npx vitest run tests/lib/csv.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/api/analytics.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api/analytics.test.ts` — API route handler tests (ANAL-01 through ANAL-11); follow existing pattern from `tests/api/bookings.test.ts` if it exists, otherwise follow `tests/api/config.test.ts`
- [ ] `tests/lib/csv.test.ts` — unit test for `downloadCsv` utility (ANAL-12)
- [ ] `components/ui/chart.tsx` — install via `npx shadcn@latest add chart` (adds recharts)
- [ ] `supabase/migrations/00011_analytics.sql` — SQL RPCs: `get_latency_stats`, `get_message_volume`, `get_intent_breakdown`, `get_booking_funnel` (all needed for GROUP BY / percentile queries)

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00002_schema.sql` — messages, conversations, messages table columns verified directly
- `supabase/migrations/00010_bookings.sql` — bookings table columns, status enum, audit_log jsonb, survey_response jsonb verified directly
- `app/dashboard/bookings/page.tsx` — bot-selector pattern, Card layout, filter bar, service role client pattern verified directly
- `app/api/bookings/[botId]/route.ts` — API route structure, `await params`, service role client, date range filter pattern verified directly
- `package.json` — confirmed recharts NOT installed; confirmed sonner, calendar, popover all installed
- `.planning/phases/06-analytics/06-UI-SPEC.md` — full UI contract verified directly
- `vitest.config.ts` — test framework configuration verified directly

### Secondary (MEDIUM confidence)
- shadcn/ui chart documentation patterns (ChartContainer, AreaChart, BarChart layout="vertical") — based on shadcn chart component conventions; recharts API is stable
- PostgreSQL `percentile_cont` syntax — standard ANSI SQL ordered-set aggregate; available in all Postgres versions supported by Supabase

### Tertiary (LOW confidence)
- None — all critical claims are verified against project source files

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and installed components
- Architecture: HIGH — directly modeled on existing Phase 5 API route patterns in the codebase
- SQL patterns: HIGH — schema verified directly from migration files; percentile_cont is standard PostgreSQL
- Pitfalls: HIGH — intent mismatch and attended status gap verified against schema + requirements

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack, 30-day window)
