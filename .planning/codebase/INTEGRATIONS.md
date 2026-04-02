# Integrations

**Analysis Date:** 2026-04-02

## External APIs

### Anthropic (Claude)
- **Purpose:** Primary AI response generation and intent/language classification
- **SDK:** `@anthropic-ai/sdk` ^0.80.0
- **Client init:** `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })`
- **Usage locations:**
  - `lib/rag/detect.ts` — intent + language classification (non-streaming, max_tokens: 100)
  - `app/api/chat/[botId]/route.ts` — streaming chat response (max_tokens: 1024)
  - `lib/booking/state-machine.ts` — off-topic detection within booking flows
- **Model:** `claude-haiku-4-5-20251001`
- **Auth env var:** `ANTHROPIC_API_KEY`

### OpenAI (Whisper)
- **Purpose:** Voice message transcription
- **SDK:** `openai` ^6.33.0
- **Client init:** `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` (lazy singleton)
- **Usage location:** `lib/rag/transcribe.ts`
- **Model:** `whisper-1`
- **Supported audio formats:** mp3, mp4, m4a, wav, ogg, oga, webm, flac, opus
- **Auth env var:** `OPENAI_API_KEY`

### Voyage AI
- **Purpose:** Generating vector embeddings for document chunks, FAQs, products, and query embedding for RAG retrieval
- **SDK:** `voyageai` ^0.2.1
- **Client init:** `new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! })` (module-level singleton)
- **Usage location:** `lib/ingest/embedder.ts`
- **Model:** `voyage-3-large` (1024-dim output, `outputDimension: 1024`)
- **Batch limit:** 128 inputs per call (handled internally in `embedDocumentChunks`)
- **Input types:** `document` (ingestion) and `query` (retrieval)
- **Auth env var:** `VOYAGE_API_KEY`
- **Note:** Excluded from Next.js bundler via `serverExternalPackages` in `next.config.ts`; ESM patched via `scripts/patch-voyageai-esm.cjs` postinstall

### Google Calendar API
- **Purpose:** Creating, updating, deleting, and listing calendar events for facility bookings
- **SDK:** `googleapis` ^171.4.0
- **Client init:** `new google.auth.OAuth2(clientId, clientSecret)` in `lib/booking/google-calendar.ts`
- **API version:** Calendar v3, OAuth2 v2
- **Scopes:** `https://www.googleapis.com/auth/calendar`
- **OAuth flow:** Authorization code flow with offline access; per-bot tokens stored in `bots` table
- **Token refresh:** Automatic via `oauth2Client.on('tokens', ...)` event — persisted back to Supabase
- **Timezone:** Asia/Kuala_Lumpur (hardcoded)
- **Auth env vars:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **OAuth endpoints:**
  - Connect: `GET /api/auth/google-calendar/connect?botId=...`
  - Callback: `GET /api/auth/google-calendar/callback`

### n8n (Outbound Webhooks)
- **Purpose:** Dispatching WhatsApp/Telegram booking notifications (confirmation, reminder, survey)
- **Protocol:** HTTP POST to a per-bot configurable webhook URL
- **Usage location:** `lib/booking/notifications.ts`
- **Configuration:** `bots.n8n_outbound_webhook` column in Supabase (set per-bot in dashboard)
- **Payload fields:** `userId`, `channel`, `message`, `type`, `bookingId`, `botName`
- **Notification types:** `confirmation`, `reminder`, `survey`
- **No SDK** — plain `fetch()` calls
- **Note:** No centralized n8n URL env var; each bot stores its own webhook URL in the database

## Databases

### Supabase (PostgreSQL + pgvector)
- **Type:** Managed PostgreSQL (Supabase cloud)
- **Client library:** `@supabase/supabase-js` (latest) + `@supabase/ssr` (latest)
- **Three client variants:**
  - Browser client (`lib/supabase/client.ts`) — uses `createBrowserClient` from `@supabase/ssr`, anon key
  - Server client (`lib/supabase/server.ts`) — uses `createServerClient` from `@supabase/ssr`, anon key + cookie handling
  - Service client (`lib/supabase/service.ts`) — uses `createClient` directly, **service role key**, bypasses all RLS
- **Extensions:**
  - `pgvector` — 1024-dim vector columns on `chunks`, `faqs`, `products` tables
  - `pgtap` — database testing
- **Vector search RPC functions** (in `supabase/migrations/00007_rag_functions.sql`):
  - `match_chunks(query_embedding, match_threshold, match_count, p_bot_id)`
  - `match_faqs(query_embedding, match_threshold, match_count, p_bot_id)`
  - `match_products(query_embedding, match_threshold, match_count, p_bot_id)`
- **Core tables:** `tenants`, `bots`, `profiles`, `documents`, `chunks`, `conversations`, `messages`, `faqs`, `products`, `bookings`, `api_keys`, `analytics`
- **Row-Level Security:** Enabled; service client bypasses RLS for trusted server operations
- **Migrations:** 15 SQL files in `supabase/migrations/`
- **Auth env vars:**
  - `NEXT_PUBLIC_SUPABASE_URL` — public project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anonymous key (browser-safe)
  - `SUPABASE_SERVICE_ROLE_KEY` — secret service role key (server-only, never exposed to browser)

## Message Queues / Event Systems

**No message queue in use.** Notification delivery is synchronous HTTP POSTs to n8n webhooks, triggered by the cron endpoint `GET /api/notifications/dispatch`. Retry logic is manual (up to 3 retries tracked in `reminder_retry_count` and `survey_retry_count` columns on the `bookings` table).

## Auth Providers

### Supabase Auth
- **Purpose:** User authentication for the admin dashboard
- **Implementation:** `@supabase/ssr` middleware (`lib/supabase/middleware.ts`)
- **Session handling:** Cookie-based; `updateSession()` called on every request via `proxy.ts` middleware
- **Protected routes:** All routes except `/login`, `/auth/*`, and `/api/chat/*`
- **Redirect logic:** Unauthenticated → `/login`; authenticated on `/login` → `/dashboard`
- **Token validation:** Always uses `supabase.auth.getUser()` (never `getSession()`) to revalidate with auth server
- **Roles:** `super_admin`, `tenant_admin` (stored in `profiles.role`)

### Google OAuth2 (Calendar only)
- **Purpose:** Per-bot Google Calendar connection (not user authentication)
- **Tokens stored:** In `bots` table columns: `google_oauth_access_token`, `google_oauth_refresh_token`, `google_oauth_token_expiry`, `google_oauth_email`
- **Scope:** Calendar read/write only

## Scheduled Jobs / Cron

### Booking Notification Dispatcher
- **Endpoint:** `GET /api/notifications/dispatch/route.ts`
- **Auth:** `Authorization: Bearer {CRON_SECRET}` header check
- **Env var:** `CRON_SECRET`
- **Trigger:** External cron (e.g., Vercel Cron) — production-only (`VERCEL_ENV === 'production'`)
- **Jobs:**
  - Reminder: sent 23–25 hours before `session_start` for confirmed bookings with `reminder_sent = false`
  - Survey: sent after `session_start` has passed for confirmed/walk-in bookings with `survey_sent = false`
- **Retry cap:** 3 attempts per notification type

## Other Third-Party Services

### Document Parsing (server-side)
- `pdf-parse` ^1.1.1 — text extraction from PDF files (`lib/ingest/extractor.ts`)
- `mammoth` ^1.12.0 — text extraction from DOCX files (`lib/ingest/extractor.ts`)
- Both excluded from bundler (CJS/native) via `next.config.ts`

### Token Counting
- `gpt-tokenizer` ^3.4.0 — GPT tokenizer for estimating token counts during RAG chunking/retrieval

## API Routes Summary

All API routes are under `app/api/`:

| Route | Purpose |
|-------|---------|
| `POST /api/chat/[botId]` | Main chatbot endpoint (streaming, RAG, booking) |
| `POST /api/ingest/[botId]` | Document upload initiation |
| `POST /api/ingest/[botId]/process` | Document processing (extract, chunk, embed) |
| `GET/POST /api/documents/[botId]` | Document CRUD |
| `DELETE /api/documents/[botId]/[documentId]` | Document deletion |
| `GET/POST /api/bots` | Bot management |
| `GET/PUT /api/config/[botId]/personality` | Bot personality config |
| `GET/PUT /api/config/[botId]/guardrails` | Bot guardrails config |
| `GET/PUT /api/config/[botId]/google-calendar` | Google Calendar config |
| `GET/POST /api/config/[botId]/faqs` | FAQ management |
| `GET/PUT /api/config/[botId]/templates` | Message template config |
| `POST /api/config/[botId]/test-chat` | Debug/test chat endpoint |
| `GET /api/config/[botId]/debug` | Debug info |
| `GET/POST /api/bookings/[botId]` | Booking management |
| `POST /api/bookings/[botId]/survey` | Booking survey submission |
| `GET /api/bots/[botId]/facilities` | Available facilities list |
| `GET/POST /api/products/[botId]` | Product CRUD |
| `GET/POST /api/keys/[botId]` | API key management |
| `GET /api/analytics/[botId]` | Analytics data |
| `GET /api/notifications/dispatch` | Cron: send reminders + surveys |
| `GET /api/auth/google-calendar/connect` | Start Google Calendar OAuth |
| `GET /api/auth/google-calendar/callback` | Google Calendar OAuth callback |
| `GET/POST /api/admin/tenants` | Super-admin tenant management |
| `GET/POST /api/admin/users` | Super-admin user management |

---

*Integration audit: 2026-04-02*
