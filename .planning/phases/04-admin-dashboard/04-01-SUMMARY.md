---
phase: 04-admin-dashboard
plan: 01
subsystem: api, database, ui
tags: [supabase, nextjs, app-router, bot-config, personality, guardrails, faqs, templates, rls]

# Dependency graph
requires:
  - phase: 03-webhook-gateway
    provides: api_keys table, bot detail page scaffolding (api-keys, integrations pages), createServiceClient pattern
  - phase: 01-data-foundation
    provides: bots, faqs, response_templates tables, profiles table, createServiceClient, lib/supabase/server.ts

provides:
  - "Migration 00009: personality (greeting_en/bm/zh, tone, fallback_message) and guardrails (blocked_keywords, refuse_message, disclaimer_text, max_response_length, off_topic_message) columns on bots table"
  - "GET + PATCH /api/config/[botId]/personality — personality config read/write"
  - "GET + PATCH /api/config/[botId]/guardrails — guardrails config read/write"
  - "GET + POST + PATCH + DELETE /api/config/[botId]/faqs — FAQ CRUD with bot_id scoping"
  - "GET + PATCH /api/config/[botId]/templates — template upsert with onConflict bot_id,intent_key,language"
  - "GET /api/bots — tenant-scoped bots list (super_admin sees all)"
  - "Bots list page with bot cards, active badge, Configure Bot links"
  - "Bot detail layout with 7-tab horizontal nav using usePathname for active highlighting"
  - "Bot detail index page redirecting to /personality"

affects: [04-02, 04-03, 04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Config API routes use createServiceClient() (service role, bypasses RLS) — same pattern as Phase 3 keys routes"
    - "Bots list API uses createClient() (server session) to get authenticated user, then serviceClient for data queries"
    - "All config routes use await params pattern (Next.js 16 requirement)"
    - "Bot detail layout uses usePathname + pathname.startsWith(href) for active tab detection"
    - "Template upsert uses onConflict: 'bot_id,intent_key,language' matching DB unique constraint"

key-files:
  created:
    - supabase/migrations/00009_bot_config.sql
    - app/api/config/[botId]/personality/route.ts
    - app/api/config/[botId]/guardrails/route.ts
    - app/api/config/[botId]/faqs/route.ts
    - app/api/config/[botId]/templates/route.ts
    - app/api/bots/route.ts
    - app/dashboard/bots/[botId]/layout.tsx
    - app/dashboard/bots/[botId]/page.tsx
  modified:
    - app/dashboard/bots/page.tsx

key-decisions:
  - "Config routes use createServiceClient() (not server client) — mutations are trusted server operations bypassing RLS"
  - "Bots list GET /api/bots uses server auth client to verify session, then service client for profile + bots queries"
  - "Bot detail layout is a 'use client' component using usePathname for active tab — NOT shadcn Tabs (per plan requirement)"
  - "FAQ PATCH and DELETE both apply .eq('bot_id', botId) scoping to prevent cross-bot mutations"
  - "All bots shown as Active in bots list — feature_flags heuristic used but all bots effectively active in current data"

patterns-established:
  - "Config route pair pattern: GET reads selected columns from bots table, PATCH does conditional spread update"
  - "Language filter pattern: optional ?language= query param on GET routes, validated against VALID_LANGUAGES tuple"
  - "Bot-scoped mutation safety: always chain .eq('bot_id', botId) on FAQ/template mutations"

requirements-completed: [CONF-01, CONF-02, CONF-03, CONF-04, CONF-05]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 4 Plan 01: Database Migration and Config API Foundation Summary

**Migration 00009 adds personality + guardrails columns to bots; 4 config API routes (personality, guardrails, FAQs, templates) plus tenant-scoped bots list API; bots list page and 7-tab bot detail layout wired to all config sub-routes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T19:54:56Z
- **Completed:** 2026-03-21T19:57:49Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Migration 00009 adds 10 new columns to bots table (5 personality + 5 guardrails) with CHECK constraint on tone and default on max_response_length
- 5 API routes covering full config CRUD: personality (GET/PATCH), guardrails (GET/PATCH), faqs (GET/POST/PATCH/DELETE with bot_id scoping), templates (GET/PATCH with upsert), bots list (GET with role-based scoping)
- Bot detail navigation shell: 7-tab layout using usePathname for active highlighting, bots list page with bot cards and empty state, index page redirecting to /personality

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and config API routes** - `72cfba0` (feat)
2. **Task 2: Bots list page and bot detail tab layout** - `6f40ba2` (feat)

## Files Created/Modified

- `supabase/migrations/00009_bot_config.sql` - Adds personality + guardrails columns to bots table
- `app/api/config/[botId]/personality/route.ts` - GET + PATCH personality config with tone validation
- `app/api/config/[botId]/guardrails/route.ts` - GET + PATCH guardrails config with integer validation
- `app/api/config/[botId]/faqs/route.ts` - GET/POST/PATCH/DELETE FAQ CRUD with bot_id scoping and language filter
- `app/api/config/[botId]/templates/route.ts` - GET + PATCH templates with upsert and intent_key validation
- `app/api/bots/route.ts` - GET bots list scoped by tenant (super_admin sees all via profile role check)
- `app/dashboard/bots/page.tsx` - Rewritten as client component with fetch, bot cards, empty state
- `app/dashboard/bots/[botId]/layout.tsx` - 7-tab horizontal nav with usePathname active highlighting
- `app/dashboard/bots/[botId]/page.tsx` - Async server component redirecting to /personality

## Decisions Made

- Config routes use `createServiceClient()` (service role) for all DB operations — config mutations are trusted server operations, RLS bypass is correct here
- Bots list `/api/bots` uses both `createClient()` (session auth) and `createServiceClient()` (data queries) — session check guards auth, service client avoids RLS on profile lookup
- Bot detail layout is `'use client'` with `usePathname` — NOT shadcn Tabs component per plan spec, plain Link elements with conditional border classes
- All bots displayed as "Active" badge — current data has no strong active/inactive signal in feature_flags, consistent display prevents confusion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Migration 00009 must be applied to the Supabase instance:
```
npx supabase db reset --linked
```
Or push migration directly:
```
npx supabase db push
```

## Next Phase Readiness

- All config API routes ready for 04-02 (personality form), 04-03 (guardrails form), 04-04 (FAQs CRUD page), 04-05 (templates page)
- Tab navigation shell in place — each subsequent plan fills in one tab's page component
- Build verified clean, no TypeScript errors

---
*Phase: 04-admin-dashboard*
*Completed: 2026-03-21*
