# Architecture

**Analysis Date:** 2026-04-02

## System Overview

Multi-tenant WhatsApp/web chatbot SaaS built on Next.js 15 (App Router) deployed to Vercel. The system serves a single tenant (Elken) in its current phase but is designed for multi-tenancy. The core capability is a RAG (Retrieval-Augmented Generation) pipeline that answers product, health, and FAQ queries using Claude claude-haiku-4-5-20251001. A stateful booking sub-system handles facility reservations via a conversational state machine. All data is persisted in Supabase (PostgreSQL + pgvector + Storage).

The public API endpoint (`/api/chat/[botId]`) is the primary integration point — WhatsApp providers and web widgets call it directly with an `X-API-Key` header. The web dashboard at `/dashboard` is for tenant admins and super admins to manage bots, knowledge, bookings, and analytics.

## Key Components

**Chat API (`app/api/chat/[botId]/route.ts`)**
- Single POST handler that orchestrates the entire RAG pipeline per request
- Validates API key (SHA-256 hash against `api_keys` table or `bots.api_key_hash`)
- Accepts text messages, voice URLs, and base64 audio
- Streams Claude's response using ReadableStream / Transfer-Encoding: chunked
- Returns metadata headers: `X-Conversation-Id`, `X-Intent`, `X-Language`, `X-Rag-Found`

**RAG Pipeline (`lib/rag/`)**
- `detect.ts` — Claude claude-haiku-4-5-20251001 classifies intent (5 types) and language (en/bm/zh) per message
- `retrieve.ts` — Embeds query with VoyageAI, calls Supabase RPCs (`match_faqs`, `match_chunks`, `match_products`) for cosine similarity search at threshold 0.55
- `prompt.ts` — Assembles system prompt from bot config + retrieval results; supports custom `system_prompt` override; injects guardrails, disclaimers, tone, response length limits
- `logger.ts` — Persists messages and manages conversation lifecycle in Supabase
- `transcribe.ts` — OpenAI Whisper transcription for voice input (URL or base64)

**Document Ingest Pipeline (`app/api/ingest/[botId]/`, `lib/ingest/`)**
- Two-step: `POST /api/ingest/[botId]` creates a DB record + returns a signed Supabase Storage upload URL
- `POST /api/ingest/[botId]/process` downloads from storage, extracts text (PDF/DOCX/TXT via `extractor.ts`), chunks at 500 tokens / 50 overlap (`chunker.ts`), embeds with VoyageAI voyage-3-large 1024-dim, bulk inserts to `chunks` table
- Q&A parse mode: detects `Q:/A:` pairs in text and inserts to `faqs` table with embeddings

**Booking State Machine (`lib/booking/state-machine.ts`)**
- Stateful multi-step conversation flow persisted in `conversations.metadata` JSONB
- Steps: `facility → location → datetime → details → summary → confirmed`
- 30-minute TTL via `last_activity_at`; expired states are cleared and fall back to normal intent detection
- `slot-checker.ts` checks facility capacity and finds available slots
- `google-calendar.ts` creates Google Calendar events per booking via OAuth2 (googleapis)
- `notifications.ts` sends booking confirmations and reminders

**Notification Dispatch Cron (`app/api/notifications/dispatch/route.ts`)**
- GET endpoint secured by `CRON_SECRET` bearer token
- Queries bookings due for 24-hour reminders (23-25h window) and post-session surveys
- Retry logic with max 3 attempts per booking
- Called by Vercel cron (not an internal scheduler)

**Supabase Layer (`lib/supabase/`)**
- `server.ts` — SSR client using `@supabase/ssr` cookies, for authenticated dashboard pages
- `service.ts` — Service-role client bypassing RLS, used exclusively in API routes
- `middleware.ts` — Session refresh on every request; redirects unauthenticated users to `/login`, bypasses `/api/chat/*`
- `proxy.ts` — Storage proxy utility

**Admin Dashboard (`app/dashboard/`)**
- Next.js Server Components with Supabase session checks
- Dashboard layout (`app/dashboard/layout.tsx`) gates all routes behind auth, conditionally shows "Super Admin" nav for `super_admin` role
- Bot detail pages at `app/dashboard/bots/[botId]/` contain sub-pages: api-keys, booking, faqs, guardrails, integrations, personality, templates, testing

**Analytics (`lib/analytics/queries.ts`, `app/api/analytics/[botId]/route.ts`)**
- Report-per-query pattern with a dispatch table of named handlers
- Reports: message-volume, intent, unanswered, latency, funnel, confirmed, cancellations, facility, location, audit, survey
- All queries scoped to `botId` + date range

## Data Flow

**Inbound Chat Message:**
```
External client (WhatsApp / web widget)
  → POST /api/chat/[botId]  (X-API-Key header)
  → API key validation (api_keys table → bots.api_key_hash fallback)
  → [optional] Voice transcription via OpenAI Whisper
  → getOrCreateConversation() — Supabase conversations table
  → Check conversations.metadata.booking for active booking state
       ↳ If active booking: route to handleBookingFlow() → return text response
  → detectIntentAndLanguage() — Claude claude-haiku-4-5-20251001 classify call
       ↳ If intent = book_session: route to handleBookingFlow() → return text response
  → retrieveContext() — VoyageAI embed → match_faqs / match_chunks / match_products RPCs
  → buildSystemPrompt() — bot config + retrieval results assembled
  → Anthropic claude-haiku-4-5-20251001 streaming messages.create()
  → ReadableStream piped to client (chunked transfer)
  → logMessage() — persists assistant message after stream closes
  → Response headers carry X-Conversation-Id, X-Intent, X-Language, X-Rag-Found
```

**Document Ingestion:**
```
Admin uploads document via dashboard
  → POST /api/ingest/[botId]  (creates DB record, returns signed upload URL)
  → Client uploads file directly to Supabase Storage (bot-files bucket)
  → POST /api/ingest/[botId]/process  (triggers processing)
  → Download from storage → extractText() → chunkText() or parseQnA()
  → embedDocumentChunks() via VoyageAI voyage-3-large (batched, 128 max per call)
  → Bulk insert to chunks or faqs table
  → Document status set to 'ready'
```

**Booking Flow:**
```
User says "I want to book"
  → intent = book_session detected
  → handleBookingFlow(state=null) — creates BookingState{step:'facility'}
  → State persisted to conversations.metadata
  → Subsequent messages routed directly to state machine (bypasses intent detection)
  → Steps: facility → location → datetime → details → summary → confirmed
  → On confirm: INSERT to bookings table + Google Calendar event (if OAuth connected)
  → Booking confirmation message returned
  → Cron at /api/notifications/dispatch sends reminder 24h before, survey after session
```

**State Management:**
- Server-side only — no client-side state store
- Booking state lives in `conversations.metadata` JSONB
- React Server Components read Supabase directly; no API calls from dashboard pages
- Dashboard pages use Supabase SSR client (cookie-based auth)

## Key Design Patterns

**Multi-tenancy via `bot_id` isolation**
Every table row includes `bot_id` as a foreign key. All queries are scoped to a single `bot_id`. Tenants → Bots is a one-to-many relationship. RLS policies enforce tenant isolation at the DB level.

**Two Supabase clients**
- SSR cookie client (`lib/supabase/server.ts`) for authenticated dashboard pages
- Service-role client (`lib/supabase/service.ts`) for API routes — bypasses RLS for trusted server operations. Never exposed to the browser.

**Feature flags**
`bots.feature_flags` is a JSONB column. `booking_enabled` gates the booking flow. Checked in the chat route before routing to the state machine.

**Streaming first**
The chat endpoint uses `ReadableStream` to pipe Claude's streaming response directly to the HTTP client. Message logging happens after the stream closes (fire-and-forget for `last_used_at` updates).

**Intent-aware retrieval**
Products are only fetched for `browse_product` and `health_issue` intents, avoiding unnecessary embedding operations for greetings and FAQs.

**Booking state machine over LLM**
The booking flow uses a deterministic multi-step state machine rather than relying on LLM to track state — avoiding hallucination in date/time/slot collection.

## Entry Points

**`app/page.tsx`**
- Root page immediately redirects to `/dashboard`

**`app/layout.tsx`**
- Root layout: ThemeProvider wrapper, Geist font, global CSS

**`app/dashboard/layout.tsx`**
- Auth gate: calls `supabase.auth.getUser()`, redirects to `/login` if not authenticated
- Fetches `profiles.role` to determine super_admin visibility in sidebar

**`app/api/chat/[botId]/route.ts`**
- Primary external-facing API endpoint
- Accepts: `{ message?, userId, channel, conversationId?, language_override?, voice_url?, voice_data?, voice_filename? }`
- Returns: streaming text with response headers

**`app/api/ingest/[botId]/route.ts`** and **`app/api/ingest/[botId]/process/route.ts`**
- Two-phase document ingestion entry points
- `maxDuration = 60` (Vercel function timeout override)

**`app/api/notifications/dispatch/route.ts`**
- Cron endpoint secured by `CRON_SECRET` bearer token

**`lib/supabase/middleware.ts`** (invoked from `proxy.ts` / Next.js middleware)
- Session refresh and auth redirect on every request
- Bypasses auth for `/api/chat/*` routes (public API)

---

*Architecture analysis: 2026-04-02*
