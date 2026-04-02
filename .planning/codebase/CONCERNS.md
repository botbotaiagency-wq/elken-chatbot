# Codebase Concerns

**Analysis Date:** 2026-04-02

---

## Security Concerns

### SC-1: test-chat and debug routes have no server-side session validation
- **Files:** `app/api/config/[botId]/test-chat/route.ts`, `app/api/config/[botId]/debug/route.ts`
- **Risk:** Any caller who knows a valid bot UUID can invoke the full RAG pipeline (embed query, call Voyage AI, call Claude, log messages) and read message debug metadata without any authenticated session. The code comment says "Protected by the dashboard session auth" but there is no `createClient().auth.getUser()` call in either route — the protection is purely client-side routing.
- **Impact:** Unauthenticated RAG invocations cost Anthropic + Voyage AI tokens. Debug route exposes source chunks and similarity scores for any bot. Could also be used for prompt-injection probing without a valid API key.
- **Fix:** Add `createClient().auth.getUser()` at the top of both handlers and return 401 if no user.

### SC-2: Service role client used for ALL API routes, bypassing RLS
- **Files:** `lib/supabase/service.ts`, every `app/api/` route handler
- **Risk:** Every API route — including the public chat endpoint — uses `createServiceClient()` which bypasses RLS entirely. The tenant isolation relies 100% on application-level `bot_id` filtering. If any query forgets a `.eq('bot_id', botId)` filter, it silently returns cross-tenant data.
- **Impact:** Data leakage between tenants (PDPA violation). There is no database-level safety net on the chat/ingest/analytics paths. RLS is defined in migrations but never exercised in production API calls.
- **Current state:** The code consistently applies `.eq('bot_id', botId)` in current routes, but this is a fragile convention — one future query that omits it causes a breach.
- **Fix:** Use the anon Supabase client with user-scoped sessions for tenant-reads; reserve service role only for ingestion pipeline and super-admin operations.

### SC-3: OAuth state parameter used as sole bot identity in Google Calendar flow
- **Files:** `app/api/auth/google-calendar/callback/route.ts`, `lib/booking/google-calendar.ts`
- **Risk:** The OAuth `state` parameter contains the raw `botId`. There is no CSRF token, no PKCE, and no state signature. A crafted OAuth callback with a different `botId` in the `state` parameter would store Google tokens against an attacker-chosen bot.
- **Impact:** An attacker could link their own Google account to another tenant's bot by guessing a bot UUID and crafting a redirect.
- **Fix:** Sign the `state` value (e.g. `botId:hmac(secret, botId)`) and verify the HMAC on callback.

### SC-4: Google OAuth tokens stored in plain columns on the `bots` table
- **Files:** `lib/booking/google-calendar.ts`, `supabase/migrations/00015_google_oauth.sql`
- **Risk:** `google_oauth_access_token` and `google_oauth_refresh_token` are stored as plain text columns in the `bots` table. The service role key (which every API route uses) can read them trivially. A Supabase log or slow query trace could expose them.
- **Impact:** Compromise of any stored refresh token gives perpetual Google Calendar write access to the connected account.
- **Fix:** Encrypt refresh tokens at rest using a server-side secret before storing, or use Supabase Vault.

### SC-5: Blocked-keyword matching is prompt-level only — not enforced at response level
- **Files:** `lib/rag/prompt.ts` (lines 60–69)
- **Risk:** The guardrail instruction is injected as a string into the Claude system prompt: "If the user's message contains any of these keywords, respond with...". Claude is asked to perform the check; there is no application-level pre-screening of the user message before it reaches Claude.
- **Impact:** A sufficiently clever jailbreak prompt or obfuscated keyword (e.g., leetspeak, Unicode look-alikes) bypasses the guardrail entirely. This matters for Elken's health-product context where regulated claims must not be made.
- **Fix:** Add a server-side blocked-keyword pre-check before calling Claude. If matched, short-circuit with the `refuse_message` directly.

### SC-6: `.env.local` is present in the repository working tree
- **File:** `.env.local` (exists at project root)
- **Risk:** The `.gitignore` does correctly exclude `.env*.local` so this file should not be in git history. However, its presence on disk means any misconfigured CI/CD or deploy pipeline that copies the working directory could expose real credentials.
- **Note:** Contents were not read (forbidden file). Existence noted for awareness.

### SC-7: `CRON_SECRET` not documented in `.env.local.example`
- **Files:** `app/api/notifications/dispatch/route.ts`, `.env.local.example`
- **Risk:** The dispatch route validates `Authorization: Bearer $CRON_SECRET`. The `.env.local.example` only documents three Supabase vars. A deployer who misses setting `CRON_SECRET` will have a dispatch endpoint with no secret — any HTTP client can trigger reminder/survey sends for all tenants.
- **Fix:** Add `CRON_SECRET=` to `.env.local.example` with a documentation comment.

---

## Technical Debt

### TD-1: Booking state machine uses `on_loan_unit` as a temp slot storage field
- **Files:** `lib/booking/state-machine.ts` (lines 267–274)
- **Risk:** Available time slots are serialised as JSON and stored in `BookingState.on_loan_unit` — a field name borrowed from unrelated domain logic. The comment on line 270 says "We store the available slots count in a temp key via on_loan_unit hack".
- **Impact:** The slot list is re-hydrated via `JSON.parse(state.on_loan_unit)` on the next message. If `on_loan_unit` is undefined or corrupt, the bot presents empty slot lists. The field name is semantically confusing for any future developer.
- **Fix:** Add a dedicated `available_slots` field to `BookingState` type.

### TD-2: Massive volume of `it.todo` test stubs — near-zero test coverage for several features
- **Files:** `tests/api/config.test.ts` (15 todos), `tests/api/test-chat.test.ts` (8 todos), `tests/api/analytics.test.ts` (all 13 assertions are `expect(true).toBe(true)`), `tests/lib/csv.test.ts` (all assertions are `expect(true).toBe(true)`)
- **Impact:** Personality config, guardrails config, test-chat endpoint, all 11 analytics report types, and all CSV export behaviours have zero real test coverage. Regressions in these paths will go undetected.
- **Fix:** Replace stubs with real assertions as part of a dedicated quality phase. Highest priority: analytics (ANAL-01–ANAL-11) and config (CONF-01–CONF-05).

### TD-3: Dual middleware files — `proxy.ts` and `middleware.ts` diverged
- **Files:** `lib/supabase/proxy.ts`, `lib/supabase/middleware.ts`
- **Risk:** Two middleware implementations exist. `proxy.ts` uses `supabase.auth.getClaims()` (newer API) and allows `/` without auth. `middleware.ts` uses `supabase.auth.getUser()` and redirects everything except `/login`, `/auth`, and `/api/chat`. The actual `middleware.ts` at root (not seen but implied by Next.js convention) determines which is active.
- **Impact:** If the wrong file is wired up, either the root `/` page is unprotected, or getClaims/getUser inconsistency could cause session sync issues.
- **Fix:** Confirm which middleware is active (`middleware.ts` at project root), delete the unused file, document the decision.

### TD-4: HNSW index comment says "1536-dim" but vectors are 1024-dim
- **File:** `supabase/migrations/00004_indexes.sql` (line 3)
- **Risk:** Comment reads "m=16, ef_construction=64 are pgvector defaults; appropriate for 1536-dim at v1 scale" but the embedder uses `outputDimension: 1024` (`lib/ingest/embedder.ts`). The index itself is correct (`vector_cosine_ops`), but the stale comment will mislead developers checking the index configuration.
- **Fix:** Update comment to reflect 1024 dimensions.

### TD-5: `vercel.json` is empty — cron schedule for notification dispatch is missing
- **File:** `vercel.json`
- **Risk:** Per the v1.0 milestone audit, a cron entry `{ "path": "/api/notifications/dispatch", "schedule": "*/15 * * * *" }` was in place but regressed. Without it, automated reminders (NOTIF-02) and post-session surveys (NOTIF-03) will never fire.
- **Impact:** Booking confirmations rely on n8n being configured to poll the dispatch endpoint manually. Until `vercel.json` is restored, notifications are dead.
- **Fix:** Restore cron entry to `vercel.json`.

### TD-6: Nyquist test compliance: only 1 of 7 phases is compliant
- **Source:** `.planning/v1.0-MILESTONE-AUDIT.md`
- **Risk:** Phases 1, 2, 3, 5, 6, 7 have `nyquist_compliant=false`. Integration tests, concurrency tests, and E2E flow tests are absent for most phases.
- **Fix:** Run `/gsd:validate-phase` for each non-compliant phase.

---

## Performance Risks

### PR-1: Two Claude API calls per chat message (intent detection + generation)
- **Files:** `app/api/chat/[botId]/route.ts`, `lib/rag/detect.ts`
- **Risk:** Every user message makes two sequential Anthropic calls: one for intent/language detection (`detectIntentAndLanguage`) and one for the actual response. These are not parallelised. At 200ms per Haiku call, this adds ~200ms minimum to every response latency.
- **Impact:** p50 latency is structurally higher than a single-call architecture. Under load, this doubles the Anthropic API rate-limit surface.
- **Fix:** Consider caching intent results for identical messages (short TTL), or batching detection into the main system prompt as a preflight JSON block.

### PR-2: Slot availability computed in application layer with N+1-style logic
- **Files:** `lib/booking/slot-checker.ts` (lines 101–184)
- **Risk:** `getAvailableSlots` fetches ALL bookings for a given day, then filters in JavaScript. As booking volume grows, this query returns increasingly large result sets for filtering client-side. For a busy facility with many bookings per day, this will be slow.
- **Fix:** Move slot availability calculation to a SQL function (like `check_and_create_booking` already does atomically). A purpose-built RPC can return available slots in a single round trip.

### PR-3: Missing indexes on `bookings` table
- **File:** `supabase/migrations/00004_indexes.sql`
- **Risk:** The index migration creates indexes for `bots`, `documents`, `chunks`, `conversations`, `messages`, `faqs`, and `response_templates` — but **no indexes on the `bookings` table**. The bookings admin page queries by `bot_id`, `status`, `facility_type`, and `session_start`. These are full table scans.
- **Impact:** Dashboard booking list and analytics booking queries will degrade as booking volume grows.
- **Fix:** Add `CREATE INDEX bookings_bot_id_idx ON bookings(bot_id)`, `CREATE INDEX bookings_session_start_idx ON bookings(session_start)`, and a composite `(bot_id, status)` index.

### PR-4: HNSW index dimension comment mismatch may indicate stale migration awareness
- **File:** `supabase/migrations/00004_indexes.sql`
- **Risk:** Related to TD-4. The HNSW index was created without verifying the actual output dimension of the voyage-3-large model at 1024 dims. If the index was created on a column declared `vector(1536)` but data is inserted as `vector(1024)`, Postgres will error. If the column is `vector(1024)` and the index is correct, performance is fine — but the comment is wrong and creates confusion.

### PR-5: No per-bot token usage tracking — Claude cost overrun risk
- **Files:** `app/api/chat/[botId]/route.ts`, `app/api/config/[botId]/test-chat/route.ts`
- **Risk:** Claude API responses include token counts (`usage.input_tokens`, `usage.output_tokens`). Neither route logs or checks these. A single bot making thousands of requests per day has no cap and no visibility until the monthly bill.
- **Impact:** Potential cost overrun; no alerting mechanism.
- **Fix:** Log token counts to `messages` table or a dedicated `usage_logs` table. Implement a per-bot daily token cap.

---

## Incomplete / Missing Features

### IM-1: Notification delivery is broken end-to-end (NOTIF-01 to NOTIF-04)
- **Files:** `app/api/notifications/dispatch/route.ts`, `lib/booking/notifications.ts`, `vercel.json`, `lib/booking/state-machine.ts`, `supabase/migrations/00010_bookings.sql`
- **Three independent gaps:**
  1. `vercel.json` is `{}` — cron schedule is absent, automated reminders/surveys never fire (NOTIF-02, NOTIF-03)
  2. `check_and_create_booking` RPC has no `p_user_id`/`p_channel` parameters — all chatbot-originated bookings store `user_id=NULL, channel=NULL` — n8n cannot route notification back to the WhatsApp/Telegram user (NOTIF-01, NOTIF-04)
  3. `n8n_outbound_webhook` is not seeded and not documented in `.env.local.example` — `dispatchNotification()` silently returns `false` until manually configured
- **Impact:** The E2E flow "Customer books → staff approves → notification delivered" is completely broken.

### IM-2: Booking state machine language is hardcoded to English
- **Files:** `app/api/chat/[botId]/route.ts` (line 196), `lib/booking/state-machine.ts`
- **Risk:** When routing to the booking flow from an existing state, the detection is hardcoded: `detection: { intent: 'book_session', language: 'en' }`. All booking prompts (facility list, location list, date prompt, slot list, confirmation summary) are English only regardless of the user's detected language.
- **Impact:** BM and ZH users receive English booking prompts — a degraded experience for Elken's primary Malaysian audience.

### IM-3: Slot operating hours hardcoded to 09:00–18:00 MYT
- **File:** `lib/booking/slot-checker.ts` (lines 124–126)
- **Risk:** `startHour = 9`, `endHour = 18` are hardcoded constants. The comment says "hardcoded for Malaysia". If GenQi facilities change hours, or a second tenant has different hours, this requires a code change.
- **Fix:** Store operating hours in `facilities_config` table and read from there.

### IM-4: FAQ language field is hardcoded to `'en'` during document ingestion
- **File:** `app/api/ingest/[botId]/process/route.ts` (line 108)
- **Risk:** When processing Q&A parse mode documents, every FAQ is stored with `language: 'en' as const`. BM-language Q&A documents will be stored as English, causing incorrect FAQ language filtering.
- **Fix:** Detect language from each Q&A pair (or accept a `language` field in the upload request), or default to the document's declared language.

### IM-5: No file size validation on document upload
- **File:** `app/api/ingest/[botId]/route.ts`
- **Risk:** The ingest route validates `filename`, `contentType`, and `category` but does NOT validate file size. Large PDFs (100+ pages) will be accepted for signed upload URLs and later fail during processing, burning Vercel function time and leaving documents in `status: 'failed'` with no clear user-facing guidance.
- **Fix:** Require `fileSize` in the upload request body and reject uploads above a threshold (e.g. 10MB).

### IM-6: Input validation absent on `capacity`, `duration_minutes` in facilities config
- **File:** `app/api/bots/[botId]/facilities/route.ts`
- **Risk:** The POST handler accepts `capacity` and `duration_minutes` from the request body without validating that they are positive integers. A negative capacity or zero duration could cause infinite loops in `getAvailableSlots` (the slot iteration loop at line 130 uses `hour += slotDuration / 60`).
- **Fix:** Validate numeric fields are positive integers before upserting.

---

## Dependency Risks

### DR-1: `@supabase/ssr` and `@supabase/supabase-js` pinned to `latest`
- **File:** `package.json`
- **Risk:** Both Supabase packages are pinned to `latest` rather than a specific version. Breaking changes in Supabase client library (auth API changes, cookie handling) will automatically apply on the next `npm install`. The project already has two diverged middleware files that suggest a past Supabase API change caused issues.
- **Fix:** Pin to a specific version and upgrade deliberately.

### DR-2: `next` pinned to `latest`
- **File:** `package.json`
- **Risk:** Next.js has had breaking changes between minor versions (App Router behaviour, streaming, params handling). Unpinned `latest` means a Next.js version bump on deploy could silently break routing or streaming.
- **Fix:** Pin to a specific version (e.g. `15.3.1` as implied by `eslint-config-next`).

### DR-3: `voyageai` package requires a post-install ESM patch
- **Files:** `package.json` (`"postinstall": "node scripts/patch-voyageai-esm.cjs"`), `scripts/patch-voyageai-esm.cjs`
- **Risk:** The voyageai package requires a monkey-patch script to work in the Next.js build environment. This is a fragile dependency that could break on any voyageai version bump. If the patch script fails silently, embeddings fail at runtime without a clear error.
- **Impact:** Single point of failure for the entire RAG pipeline.
- **Fix:** Monitor voyageai changelog for official ESM support; remove the patch when the upstream fix ships.

### DR-4: `pdf-parse` version `1.1.1` — known to have empty extraction issues with some PDFs
- **File:** `package.json`
- **Risk:** `pdf-parse` is widely documented to fail silently on scanned PDFs, password-protected PDFs, and some newer PDF specs. The ingestion pipeline does not validate that extracted text is non-empty before chunking.
- **Impact:** Empty chunks get embedded, stored, and returned as "relevant" context to Claude — causing hallucinations.
- **Fix:** Add a minimum text length check after extraction. Consider `pdfjs-dist` as an alternative for better compatibility.

---

## Operational Concerns

### OC-1: No rate limiting on any public API endpoint
- **Files:** `app/api/chat/[botId]/route.ts`, `app/api/ingest/[botId]/route.ts`, all public routes
- **Risk:** There is no rate limiting (by IP, by API key, or by bot) on any endpoint. The chat endpoint calls two external APIs (Voyage AI + Anthropic) per request. A single client sending 1,000 concurrent requests would exhaust API quotas and generate unbounded costs.
- **Fix:** Implement rate limiting via Upstash Redis or Vercel Edge rate limiting middleware. Minimum: per-bot rate limit on `/api/chat/[botId]`.

### OC-2: Fire-and-forget async operations swallow failures silently
- **Files:** `app/api/chat/[botId]/route.ts` (line 63–66: `last_used_at` update), `app/api/bookings/[botId]/route.ts` (lines 161–166: notification dispatch, calendar sync)
- **Risk:** Several critical async operations are fire-and-forget with no await and no surface-level error handling. The `last_used_at` update for API keys, notification dispatch, and Google Calendar sync all fail silently. There is no retry queue, no dead-letter mechanism, and no alerting.
- **Impact:** Notifications go undelivered without any operator visibility. Calendar events get out of sync.
- **Fix:** At minimum, log failures to a structured error table or Sentry. For notification dispatch, the retry mechanism exists (`reminder_retry_count`) but only works if the cron fires.

### OC-3: `console.warn` DEV MODE messages will appear in Vercel production logs
- **File:** `app/api/chat/[botId]/route.ts` (lines 82, 91)
- **Risk:** The chat endpoint logs `[DEV MODE] Bot ${botId}: no api_key_hash set — skipping API key validation` as a `console.warn` when a bot has no API key configured. In production, if a bot is accidentally deployed without an API key, this message will appear in Vercel logs without triggering any alert, and the endpoint will process unauthenticated requests silently.
- **Fix:** In production (`process.env.NODE_ENV === 'production'`), enforce API key requirement and return 401 rather than warn.

### OC-4: Booking concurrency — no optimistic locking on conversation metadata updates
- **Files:** `lib/booking/state-machine.ts`, `supabase/migrations/00010_bookings.sql`
- **Risk:** Booking state is stored in `conversations.metadata` (jsonb). Concurrent messages (e.g. rapid double-tap from user, or n8n webhook retry) both read the same state, apply transitions, and write back. The second write silently overwrites the first, causing state machine corruption (lost facility selection, duplicate booking attempts).
- **Impact:** The atomic RPC (`check_and_create_booking`) prevents double-booking at the database level, but the conversation state can still become corrupted leading to a broken booking UX.
- **Fix:** Implement optimistic locking on `conversations.metadata` using a version column, or use a Postgres advisory lock keyed on `conversation_id`.

### OC-5: No structured logging — all observability is `console.log`/`console.error`
- **Files:** All `app/api/` route files
- **Risk:** All server-side logging uses `console.error` and `console.warn`. There is no structured log format, no correlation IDs, no log levels, and no integration with an observability platform (Sentry, Datadog, LogTail).
- **Impact:** Debugging production issues requires trawling raw Vercel log streams. No alerting on error spikes. No request tracing across the chat pipeline.
- **Fix:** Integrate a structured logger (e.g. Pino) and add request correlation IDs. Consider Sentry for error alerting.

### OC-6: Missing CORS configuration for `/api/chat` public endpoint
- **Files:** `app/api/chat/[botId]/route.ts`, `lib/supabase/middleware.ts`
- **Risk:** The middleware explicitly allows `/api/chat` without authentication, making it a public endpoint. However, there is no explicit CORS policy (`Access-Control-Allow-Origin` header). Browser clients (web widget embeds) may face CORS errors; or conversely, any origin can call the endpoint.
- **Fix:** Add explicit CORS headers to the chat endpoint, restricting allowed origins to configured tenant domains.

### OC-7: n8n webhook delivery has no idempotency guard — duplicate messages possible
- **Files:** `app/api/chat/[botId]/route.ts`
- **Risk:** n8n retries failed webhooks. If the chat endpoint takes >8 seconds (slow Claude + RAG + intent detection), n8n may retry the same message. Both requests will run the full pipeline, creating two conversation messages and two Claude responses sent back to the user.
- **Impact:** Duplicate responses in production WhatsApp chats, duplicate message logs, double token billing.
- **Fix:** Accept an idempotency key from n8n (e.g. `X-N8N-Message-ID` header) and deduplicate within a short TTL window using Redis or a Supabase unique constraint.

---

*Concerns audit: 2026-04-02*
