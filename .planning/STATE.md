---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Phase 6 context gathered
last_updated: "2026-03-22T10:07:25.325Z"
last_activity: 2026-03-18 — Roadmap created
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 22
  completed_plans: 22
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Any client can upload their documents, configure a bot, and have a working AI chatbot live on WhatsApp/Telegram within minutes — with zero code changes required.
**Current focus:** Phase 1 — Data Foundation

## Current Position

Phase: 1 of 7 (Data Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-18 — Roadmap created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-data-foundation P02 | 110s | 2 tasks | 7 files |
| Phase 01-data-foundation P01 | 6 | 2 tasks | 16 files |
| Phase 01-data-foundation P03 | 4min | 1 tasks | 4 files |
| Phase 01-data-foundation P03 | 15min | 2 tasks | 4 files |
| Phase 02-rag-pipeline P01 | 8min | 2 tasks | 11 files |
| Phase 02-rag-pipeline P02 | 13min | 2 tasks | 9 files |
| Phase 02-rag-pipeline P03 | 7min | 2 tasks | 5 files |
| Phase 02-rag-pipeline P04 | 4min | 2 tasks | 4 files |
| Phase 02-rag-pipeline P05 | 144s | 1 tasks | 3 files |
| Phase 02-rag-pipeline P05 | 10min | 2 tasks | 2 files |
| Phase 02-rag-pipeline P06 | 199s | 3 tasks | 5 files |
| Phase 03-webhook-gateway P01 | 352s | 2 tasks | 6 files |
| Phase 03-webhook-gateway P02 | 3min | 2 tasks | 7 files |
| Phase 04-admin-dashboard P00 | 2min | 1 tasks | 4 files |
| Phase 04-admin-dashboard P01 | 3min | 2 tasks | 9 files |
| Phase 04-admin-dashboard P03 | 3min | 2 tasks | 2 files |
| Phase 04-admin-dashboard P02 | 236s | 2 tasks | 4 files |
| Phase 04-admin-dashboard P04 | 3min | 2 tasks | 3 files |
| Phase 05-booking-system P01 | 3min | 2 tasks | 10 files |
| Phase 05-booking-system P02 | 242s | 2 tasks | 3 files |
| Phase 05-booking-system P03 | 2min | 2 tasks | 2 files |
| Phase 05-booking-system P04 | 3.5min | 2 tasks | 4 files |
| Phase 05-booking-system P05 | 1min | 2 tasks | 2 files |
| Phase 05-booking-system P06 | 4min | 1 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Ingestion runs inside Next.js API routes (not Railway Python worker) — simpler v1 deployment
- n8n is the messaging bridge — this app exposes REST webhook only, no direct SDK
- pgvector for RAG via Supabase — no extra infra needed
- Booking state machine persisted in conversation.metadata jsonb — stateful without extra tables
- Feature-flagged booking module — platform reusable for non-booking clients
- [Phase 01-data-foundation]: bot_id is the universal isolation key for all content tables (documents, chunks, conversations, messages, faqs, response_templates)
- [Phase 01-data-foundation]: supabase_auth_admin granted SELECT on profiles before RLS to allow custom_access_token_hook to read user role/tenant_id
- [Phase 01-data-foundation]: HNSW index uses cosine distance operator (vector_cosine_ops) matching the <=> RAG query operator
- [Phase 01-01]: Used Next.js 16.1.7 (latest) instead of pinning to 14 — template resolves latest; all App Router patterns identical
- [Phase 01-01]: SUPABASE_SERVICE_ROLE_KEY isolated to lib/supabase/service.ts only — never exposed to browser via NEXT_PUBLIC_ variable
- [Phase 01-01]: Replaced PUBLISHABLE_KEY with ANON_KEY throughout — plan spec requires ANON_KEY naming for consistency across all phases
- [Phase 01-data-foundation]: Next.js 16 uses proxy.ts not middleware.ts — updateSession helper in lib/supabase/middleware.ts, wired via proxy.ts
- [Phase 01-data-foundation]: Dashboard layout uses Suspense+AuthGate async component pattern to support Next.js 16 cacheComponents partial prerender
- [Phase 01-data-foundation]: Next.js 16 uses proxy.ts not middleware.ts — updateSession helper in lib/supabase/middleware.ts, wired via proxy.ts
- [Phase 01-data-foundation]: Dashboard layout uses Suspense+AuthGate async component pattern to support Next.js 16 cacheComponents partial prerender
- [Phase 01-data-foundation]: Phase 1 fully verified end-to-end: 8 pgTAP RLS isolation tests pass, super-admin login works, ANTHROPIC_API_KEY added to .env.local
- [Phase 02-rag-pipeline]: pdf-parse v2 uses class-based PDFParse({ data: buffer }) API, not old function-based pdfParse(buffer)
- [Phase 02-rag-pipeline]: vi.hoisted() required in vitest for mock functions referenced in vi.mock factory closures (ESM hoisting)
- [Phase 02-rag-pipeline]: voyageai@0.2.x ESM bundle has broken directory imports — fixed via postinstall patch script and serverExternalPackages in next.config.ts
- [Phase 02-rag-pipeline]: Products use products.embedding for RAG search (not chunks table) — chunks.document_id is NOT NULL so products are queried via match_products RPC
- [Phase 02-rag-pipeline]: Claude Haiku (claude-haiku-20241022) for intent/language classification — fast, cheap, 100 token max_tokens sufficient
- [Phase 02-rag-pipeline]: match_products only called for browse_product and health_issue intents — avoids unnecessary RPC calls
- [Phase 02-rag-pipeline]: User message logged before pipeline processing (null intent/rag fields) so every inbound is captured even on downstream failure
- [Phase 02-rag-pipeline]: params typed as Promise<{botId}> (Next.js 16 requirement) with await params before use in chat route
- [Phase 02-rag-pipeline]: supabase/.temp/ added to .gitignore — Supabase CLI runtime directory should not be tracked
- [Phase 02-rag-pipeline]: Phase 2 end-to-end verification gate passed: all automated tests green (63/63), all infrastructure manually confirmed (migrations 00006+00007, bot-files bucket, VOYAGE_API_KEY, match_chunks/match_faqs/match_products RPCs, chat endpoint streaming)
- [Phase 02-rag-pipeline]: API key validation placed before body parsing — bot existence check fails fast with 404 before any request processing
- [Phase 02-rag-pipeline]: null api_key_hash treated as dev-mode bypass (not rejection) so Phase 1/2 bots continue working pre-Phase 3
- [Phase 02-rag-pipeline]: RAG-08: Text-based Product Detail Cards satisfy Phase 2 scope; brochure/PDF delivery deferred to Phase 7 (n8n bridge handles media)
- [Phase 03-webhook-gateway]: api_keys table uses soft-delete via revoked_at with partial indexes for active-key lookups
- [Phase 03-webhook-gateway]: Chat endpoint validates api_keys table first then falls back to bots.api_key_hash — preserves Phase 1/2 dev-mode bypass
- [Phase 03-webhook-gateway]: fire-and-forget last_used_at update (not awaited) on api_keys match to avoid latency impact
- [Phase 03-webhook-gateway]: Manual relative time calculation used instead of date-fns to avoid extra dependency
- [Phase 03-webhook-gateway]: CopyButton extracted as sub-component in integrations page to share icon-swap logic across URL and snippet blocks
- [Phase 04-admin-dashboard]: Wave 0 stubs use it.todo() not it() with empty bodies — vitest shows pending, never failing
- [Phase 04-admin-dashboard]: test-chat.test.ts includes mocks for rag/detect, rag/retrieve, rag/prompt, rag/logger matching existing chat.test.ts pattern
- [Phase 04-admin-dashboard]: Config routes use createServiceClient() (service role) — config mutations are trusted server operations bypassing RLS
- [Phase 04-admin-dashboard]: Bots list /api/bots uses createClient() for session auth + createServiceClient() for data — dual client pattern for role-based scoping
- [Phase 04-admin-dashboard]: Bot detail layout uses usePathname + pathname.startsWith(href) for active tab — NOT shadcn Tabs component
- [Phase 04-admin-dashboard]: FAQ edit uses PATCH with stable faqId (not delete+create) — preserves FAQ IDs across edits
- [Phase 04-admin-dashboard]: Templates language filter hides intents without selected variant; Promise.all for parallel EN/BM/ZH upserts
- [Phase 04-admin-dashboard]: BotConfig interface uses optional nullable fields matching DB column nullability
- [Phase 04-admin-dashboard]: language_override applied after detection so intent classification uses original message language
- [Phase 04-admin-dashboard]: test-chat route duplicates chat route logic intentionally — API key auth is woven through original, extraction would be premature refactor
- [Phase 04-admin-dashboard]: Debug data fetched after stream completes via separate GET — keeps streaming protocol clean, debug non-blocking
- [Phase 05-booking-system]: facilities_config as separate table (not jsonb on bots): enables per-row RLS, proper indexing, and simpler admin UI for 6 facility types each with 4 config fields
- [Phase 05-booking-system]: check_and_create_booking RPC is mandatory for all booking inserts — uses SELECT FOR UPDATE to atomically prevent double-booking race conditions (BOOK-06)
- [Phase 05-booking-system]: find_next_available_slots hardcodes Asia/Kuala_Lumpur for business hours (09:00-18:00) — all GenQi locations are in Malaysia
- [Phase 05-booking-system]: Active booking state checked before intent detection — booking answers (yes, 1, confirm) would be misclassified by intent detector
- [Phase 05-booking-system]: Booking responses are plain text (not streaming) — pre-written prompts, not Claude-generated content; returned as plain Response
- [Phase 05-booking-system]: feature_flags.booking_enabled gates all booking code — platform reusable for non-booking bots
- [Phase 05-booking-system]: Confirm action triggers notification fire-and-forget (not awaited) — response latency must not depend on n8n delivery
- [Phase 05-booking-system]: dispatchNotification returns boolean, never throws — callers handle retry policy independently
- [Phase 05-booking-system]: Bot selector shown at top of /dashboard/bookings — bookings are per-bot so a bot must be selected before data loads
- [Phase 05-booking-system]: facilities POST uses upsert with onConflict: bot_id,facility_type — atomic save-all for all 6 facility config rows
- [Phase 05-booking-system]: export const dynamic = 'force-dynamic' prevents Next.js caching the cron dispatch endpoint
- [Phase 05-booking-system]: Reminder window is 23-25h (not exactly 24h) — 2h window ensures 15-min cron catches bookings at the 24h mark
- [Phase 05-booking-system]: Non-production guard uses VERCEL_ENV presence: local dev has none (no guard), preview has VERCEL_ENV=preview (guard fires), production has VERCEL_ENV=production (no guard)
- [Phase 05-booking-system]: Survey lookup supports bookingId OR userId — n8n workflow can pass either identifier
- [Phase 05-booking-system]: export const dynamic removed from cron dispatch — incompatible with cacheComponents: true in next.config.ts
- [Phase 05-booking-system]: calendar.tsx --spacing(8) replaced with [--cell-size:2rem] — Tailwind v3 does not support v4 spacing function syntax; Turbopack rejects it

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 5 (Booking): Elken's exact booking rules (cutoff times, member/non-member paths, facility/slot schema) are not yet fully specified. A requirements session with Navien/Elken is needed before the state machine is designed.
- Phase 3 (Language Detection): BM language detector library choice (franc, langdetect, or custom keyword-based) needs an empirical test against real Elken WhatsApp samples before committing to an implementation.
- Phase 7 (n8n Integration): Exact JSON payload shape from n8n (conversation_id, sender_id field names) must be confirmed with Navien's current n8n setup before webhook implementation.

## Session Continuity

Last session: 2026-03-22T10:07:25.321Z
Stopped at: Phase 6 context gathered
Resume file: .planning/phases/06-analytics/06-CONTEXT.md
