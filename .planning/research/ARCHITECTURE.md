# Architecture Patterns

**Domain:** Multi-Tenant AI Chatbot SaaS Platform
**Researched:** 2026-03-18
**Confidence:** MEDIUM — Based on training knowledge (Aug 2025 cutoff) and project spec. External documentation tools unavailable during this research session. Patterns are well-established and cross-validated against the PROJECT.md spec.

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL CLIENTS                            │
│  n8n (WhatsApp/Telegram bridge)     Admin Dashboard (Browser)       │
└───────────────┬─────────────────────────────┬───────────────────────┘
                │ REST POST /api/chat          │ Next.js App Router
                ▼                             ▼
┌──────────────────────────┐   ┌──────────────────────────────────────┐
│   WEBHOOK GATEWAY        │   │          NEXT.JS APP ROUTER           │
│  /api/chat (public)      │   │  /app/(dashboard)/...                │
│  API key validation      │   │  Supabase Auth session               │
│  bot_id extraction       │   │  Server Components + Client Islands  │
└──────────┬───────────────┘   └──────────────────┬───────────────────┘
           │                                       │
           ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS API ROUTES                            │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐ │
│  │  RAG PIPELINE   │  │ INGESTION PIPE  │  │  ADMIN API ROUTES    │ │
│  │  (retrieval)    │  │  (write-path)   │  │  /api/admin/*        │ │
│  │                 │  │                 │  │                      │ │
│  │ embed query     │  │ extract text    │  │  CRUD for tenants,   │ │
│  │ cosine search   │  │ chunk text      │  │  bots, FAQs,         │ │
│  │ FAQ injection   │  │ embed chunks    │  │  templates,          │ │
│  │ Claude stream   │  │ store pgvector  │  │  analytics           │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────────────────┘ │
└───────────┼────────────────────┼─────────────────────────────────────┘
            │                    │
            ▼                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Data Layer)                            │
│                                                                      │
│  PostgreSQL + pgvector                                               │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────┐ ┌────────────┐  │
│  │  tenants   │ │    bots      │ │  documents /   │ │  convers-  │  │
│  │            │ │  (bot_id PK) │ │    chunks      │ │  ations    │  │
│  └────────────┘ └──────────────┘ │  (pgvector)    │ │  (jsonb    │  │
│                                  └────────────────┘ │  metadata) │  │
│  ┌────────────┐ ┌──────────────┐                    └────────────┘  │
│  │    faqs    │ │  templates   │  RLS: every table scoped by bot_id  │
│  └────────────┘ └──────────────┘                                     │
│                                                                      │
│  Supabase Auth (dashboard users)     Supabase Storage (raw files)   │
└──────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│         EXTERNAL APIS            │
│  Claude API (haiku streaming)    │
│  Voyage-3 / Claude embeddings    │
└──────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Isolation Boundary |
|-----------|---------------|-------------------|--------------------|
| Webhook Gateway (`/api/chat`) | Validate API key, extract bot_id, route to RAG pipeline, stream response back | RAG Pipeline, Supabase (key lookup) | API key must hash-match; bot_id extracted from key record |
| RAG Pipeline (retrieval path) | Embed query, vector search, inject FAQs, call Claude, stream tokens | Supabase pgvector, Claude API | All queries filtered by bot_id |
| Ingestion Pipeline (write path) | Accept uploaded file, extract text, chunk, embed, store vectors | Supabase Storage, Supabase DB, Embedding API | Runs under authenticated session; bot_id from session |
| Admin API Routes (`/api/admin/*`) | CRUD for all bot configuration entities | Supabase DB | Protected by Supabase Auth session + RLS |
| Dashboard UI (App Router) | Tenant admin views, testing console, analytics | Admin API Routes, Supabase realtime/polling | Server components use service role only in server context |
| Supabase RLS Layer | Enforce bot_id isolation at DB level, second line of defense | N/A (transparent) | Cannot be bypassed even if application code is wrong |
| Booking State Machine | Track multi-turn booking conversation state, persist across messages | Supabase conversations table (metadata jsonb) | Keyed by conversationId + bot_id |
| n8n Bridge (external) | Forward WhatsApp/Telegram messages to webhook; receive streamed response | Webhook Gateway only | This platform does NOT hold channel credentials |

---

## Data Flow

### Chat (Retrieval) Path — Hot Path
```
n8n (user message)
  → POST /api/chat {api_key, conversation_id, message, channel}
  → [Validate] hash(api_key) → lookup api_keys table → resolve bot_id
  → [Language] detect language from message (EN/BM/ZH)
  → [Intent] classify intent (product_enquiry | booking | general | off_topic)
  → [Embed] voyage-3/Claude embed query → 1536-dim vector
  → [Search] pgvector cosine similarity WHERE bot_id = ? AND chunks ORDER BY similarity LIMIT k
  → [FAQ] inject matching FAQs above chunk results (exact-match priority)
  → [Guard] check blocked_topics, apply guardrails from bot config
  → [Booking] if intent=booking → read conversation.metadata.booking_state → run state machine step
  → [LLM] Claude haiku streaming: system prompt (personality) + context + user message
  → [Stream] Server-Sent Events or chunked transfer → n8n → channel
  → [Persist] save conversation turn + metadata update to Supabase
```

### Ingestion Path — Background / Admin Triggered
```
Admin uploads file via dashboard
  → POST /api/admin/documents/upload {bot_id, file}
  → Store raw file in Supabase Storage under /{tenant_id}/{bot_id}/{filename}
  → Extract text (pdf-parse for PDF, mammoth for DOCX, plain read for TXT)
  → Chunk text (recursive character splitter: 1000 chars, 200 overlap)
  → Batch embed chunks → voyage-3 / Claude embeddings API (1536-dim)
  → INSERT INTO chunks (bot_id, document_id, content, embedding, metadata)
  → Return processing status to dashboard
```

### Dashboard (Admin) Data Flow
```
Browser → Next.js Server Component → Supabase (service role, server-only)
Browser → Client Component → Next.js API Route → Supabase (with auth context)
Supabase Auth session → JWT → RLS policies evaluate auth.uid() → tenant scoping
```

---

## Folder Structure — Next.js App Router

```
/app
  /(auth)
    /login/page.tsx
    /callback/page.tsx
  /(dashboard)
    /layout.tsx              ← sidebar nav, auth guard, tenant context
    /page.tsx                ← redirect to /bots
    /bots
      /page.tsx              ← bot list (super-admin sees all)
      /[botId]
        /overview/page.tsx
        /knowledge/page.tsx  ← file upload, chunk list
        /faqs/page.tsx
        /templates/page.tsx
        /personality/page.tsx
        /guardrails/page.tsx
        /analytics/page.tsx
        /bookings/page.tsx   ← feature-flagged
        /integrations/page.tsx
        /api-keys/page.tsx
        /test/page.tsx       ← testing console
    /tenants/page.tsx        ← super-admin only
/api
  /chat/route.ts             ← public webhook endpoint (streaming)
  /admin
    /documents
      /upload/route.ts
      /[id]/route.ts
    /faqs/route.ts
    /templates/route.ts
    /analytics/route.ts
    /bookings/route.ts
    /api-keys/route.ts
    /tenants/route.ts        ← super-admin
/lib
  /supabase
    /client.ts               ← browser client (anon key)
    /server.ts               ← server client (service role, server-only)
    /middleware.ts
  /rag
    /embed.ts                ← embedding abstraction
    /search.ts               ← vector search
    /pipeline.ts             ← full retrieval chain
  /ingestion
    /extract.ts
    /chunk.ts
    /ingest.ts
  /booking
    /state-machine.ts        ← booking flow transitions
    /slots.ts                ← availability checking
  /ai
    /claude.ts               ← Claude API wrapper, streaming
    /language.ts             ← language detection
    /intent.ts               ← intent classification
  /auth
    /api-keys.ts             ← hash, validate, generate
/components
  /ui/                       ← shadcn/ui components
  /dashboard/                ← dashboard-specific components
  /chat/                     ← test console components
/middleware.ts               ← Supabase auth session refresh
```

---

## Patterns to Follow

### Pattern 1: Row-Level Security for bot_id Isolation

**What:** Every table with bot-scoped data carries a `bot_id` column. RLS policies enforce that authenticated dashboard users can only read/write rows where `bot_id` maps back to their tenant. The webhook path uses a service-role client that bypasses RLS — isolation for the webhook is enforced in application code (API key → bot_id lookup).

**When:** Applied to: `chunks`, `documents`, `faqs`, `templates`, `conversations`, `bookings`, `api_keys`, `bot_configs`.

**Why row-level over schema-per-tenant:** Schema-per-tenant requires DDL migrations per new tenant, makes cross-tenant queries impossible (needed for super-admin analytics), and is operationally expensive. Row-level security with pgvector's `bot_id` filter achieves equivalent isolation with zero operational overhead. Supabase's RLS is Postgres-native and cannot be bypassed by application bugs when using anon/user JWT clients.

```sql
-- Example RLS policy for chunks table
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

-- Dashboard users can only see chunks belonging to their bot
CREATE POLICY "tenant_isolation_chunks"
  ON chunks
  FOR ALL
  USING (
    bot_id IN (
      SELECT b.id FROM bots b
      JOIN tenants t ON b.tenant_id = t.id
      WHERE t.owner_id = auth.uid()
    )
  );

-- Super-admin bypass (Navien's role)
CREATE POLICY "super_admin_all_chunks"
  ON chunks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
```

**Note:** The public `/api/chat` webhook MUST use a service-role Supabase client. Bot_id isolation in that path is enforced by application code: the API key record in the DB contains the `bot_id`, and all downstream queries use that resolved `bot_id` as an explicit WHERE clause — not RLS.

### Pattern 2: Dual-Client Supabase Strategy

**What:** Two Supabase clients with different privilege levels. Never expose service role to the browser.

```typescript
// lib/supabase/server.ts — server-only, service role
import { createClient } from '@supabase/supabase-js'
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // never sent to browser
)

// lib/supabase/client.ts — browser client, anon key
import { createBrowserClient } from '@supabase/ssr'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // safe to expose
)
```

**When:** Server Components and API routes use `supabaseAdmin`. Browser/Client Components use the anon client with auth session.

### Pattern 3: Streaming Chat Response (Next.js App Router)

**What:** The `/api/chat` route returns a `ReadableStream` using the Web Streams API. Claude's SDK streams tokens which are forwarded directly. n8n receives the streamed response and buffers it before sending to the messaging channel.

```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  // ... validate API key, extract bot_id ...

  const stream = new ReadableStream({
    async start(controller) {
      const claudeStream = await anthropic.messages.stream({
        model: 'claude-haiku-20241022',
        messages: [...],
        system: personalityPrompt,
      })

      for await (const chunk of claudeStream) {
        if (chunk.type === 'content_block_delta') {
          controller.enqueue(
            new TextEncoder().encode(chunk.delta.text)
          )
        }
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    }
  })
}
```

**When:** All chat responses. The test console in the dashboard uses the same endpoint with `fetch` and a `ReadableStream` reader to display tokens as they arrive.

### Pattern 4: Booking State Machine via conversation.metadata jsonb

**What:** Booking flow state is persisted in a `metadata` jsonb column on the `conversations` table. Each turn reads current state, applies the transition, and writes the new state atomically. This avoids a separate booking_sessions table and survives Vercel serverless cold starts.

```typescript
// lib/booking/state-machine.ts
type BookingState =
  | { step: 'idle' }
  | { step: 'collect_date'; location?: string }
  | { step: 'collect_facility'; date: string; location: string }
  | { step: 'collect_slot'; date: string; location: string; facility: string }
  | { step: 'confirm'; date: string; location: string; facility: string; slot: string; member: boolean }
  | { step: 'complete'; bookingId: string }

interface ConversationMetadata {
  booking?: BookingState
  language?: 'en' | 'bm' | 'zh'
  lastIntent?: string
  turnCount?: number
}

// Transition is a pure function — DB read/write happens in pipeline.ts
export function transitionBooking(
  current: BookingState,
  intent: string,
  userMessage: string,
  extractedEntities: Record<string, string>
): BookingState {
  // ... state transition logic ...
}
```

**When:** Only activated when `bot.features.booking_enabled = true` (feature flag). For non-booking bots (non-Elken tenants), the booking state machine is never invoked.

### Pattern 5: API Key Hashing

**What:** API keys are never stored in plaintext. The full key is shown once on creation. The DB stores a SHA-256 hash of the key. Validation hashes the incoming key and compares. A short prefix (first 8 chars) is stored for display in the UI.

```typescript
// lib/auth/api-keys.ts
import { createHash, randomBytes } from 'crypto'

export function generateApiKey(botId: string): { key: string; hash: string; prefix: string } {
  const raw = `sk-${botId.slice(0, 8)}-${randomBytes(32).toString('hex')}`
  const hash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(0, 12) + '...'
  return { key: raw, hash, prefix }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

// Validation in /api/chat
const keyHash = hashApiKey(incomingKey)
const keyRecord = await supabaseAdmin
  .from('api_keys')
  .select('bot_id, revoked_at')
  .eq('key_hash', keyHash)
  .single()

if (!keyRecord || keyRecord.revoked_at) return 401
```

**When:** Every request to `/api/chat`. Key generation happens in `/api/admin/api-keys`.

### Pattern 6: RAG Chunk Search with FAQ Priority Injection

**What:** Vector search returns top-k semantic chunks. Before passing context to Claude, the pipeline checks for FAQ exact/semantic matches and prepends them above RAG chunks. Claude always sees FAQs first in the context window, giving them higher influence on the response.

```
Context assembly order:
1. [SYSTEM] Bot personality + language instruction
2. [CONTEXT - FAQs] Matched FAQ Q&A pairs (exact match on intent/keywords)
3. [CONTEXT - Knowledge] Top-k semantic chunks from pgvector
4. [GUARDRAILS] Blocked topics instruction (if applicable)
5. [CONVERSATION] Last N turns (from conversations table)
6. [USER] Current message
```

**When:** All chat requests. FAQ matching runs as a fast DB query before vector search; both can run in parallel then be merged.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using Service Role Client in Browser Components
**What:** Passing `SUPABASE_SERVICE_ROLE_KEY` to `NEXT_PUBLIC_*` env vars or using it in client components.
**Why bad:** Service role bypasses all RLS. Any tenant could read all other tenants' data if the key leaks.
**Instead:** Service role stays in server-only modules (`lib/supabase/server.ts`, never imported by client components). Browser uses anon key + auth session. Use `server-only` package to enforce this at build time.

### Anti-Pattern 2: Trusting bot_id from Request Body
**What:** Accepting `bot_id` as a field in the POST body of `/api/chat` from n8n.
**Why bad:** Any caller could forge a `bot_id` and access another tenant's knowledge base.
**Instead:** Always derive `bot_id` from the API key record in the database. The key is the auth credential; `bot_id` is resolved server-side from it.

### Anti-Pattern 3: Schema-per-Tenant for This Scale
**What:** Creating a separate Postgres schema per tenant (e.g., `elken.chunks`, `clientb.chunks`).
**Why bad:** Requires DDL migrations for every new tenant, makes pooled connections harder (pgbouncer), breaks super-admin cross-tenant analytics queries, and adds operational complexity with no meaningful security benefit over RLS.
**Instead:** Row-level security with `bot_id` on every table. Simpler, equally secure, and cross-tenant queries are trivial for the super-admin role.

### Anti-Pattern 4: Storing Booking State in Memory / Redis
**What:** Using an in-memory map or Redis to track conversation state keyed by `conversationId`.
**Why bad:** Vercel serverless functions are stateless; memory resets on every invocation. Redis adds infra cost and complexity.
**Instead:** `conversation.metadata jsonb` in Postgres. Atomic update per turn. Already in Supabase. Survives cold starts. Free.

### Anti-Pattern 5: Ingestion in the Same Request as Chat
**What:** Running document ingestion (text extraction, chunking, embedding) synchronously during a user-facing operation.
**Why bad:** Embedding 100 chunks takes 5-30 seconds, which will timeout Vercel's 10s default limit and block the user.
**Instead:** Ingestion is always admin-triggered via a dedicated `/api/admin/documents/upload` route. For v1, this route runs the full pipeline synchronously but is only called by the admin dashboard (not the hot chat path). A progress indicator in the UI covers the wait time.

### Anti-Pattern 6: Single RLS Policy Relying Solely on tenant_id
**What:** Scoping all records to `tenant_id` when the data is actually at the `bot_id` level.
**Why bad:** A tenant with multiple bots could access other bots' data within their own tenant.
**Instead:** Use `bot_id` as the primary isolation key. A bot belongs to a tenant, and tenants can have multiple bots. RLS policies check `bot_id`, which is more granular and correct.

---

## Scalability Considerations

| Concern | At 10 bots | At 100 bots | At 1000 bots |
|---------|------------|-------------|--------------|
| Vector search latency | pgvector IVFFlat index per bot_id sufficient | Add HNSW index, increase `lists` | Consider Pinecone or partition by tenant |
| Ingestion throughput | Synchronous in API route is fine | Queue with Vercel background functions or edge queues | Dedicated worker service (Railway/Fly) |
| RLS query overhead | Negligible | Negligible (index on bot_id) | Marginal — ensure bot_id is indexed on all tables |
| Conversation history storage | Postgres fine | Postgres fine | Consider TTL policy on old turns |
| Claude API costs | Haiku is cheap, fine | Add caching layer for repeated FAQs | Response caching + rate limiting per bot |
| Supabase connection pool | Default pgbouncer sufficient | Review connection limits | May need dedicated Supabase project per large tenant |

---

## Suggested Build Order (Phase Dependencies)

The architecture has clear dependency layers. Components in earlier phases are prerequisites for later ones.

```
Phase 1: Data Foundation
  → Supabase schema (tenants, bots, bot_configs, api_keys, conversations)
  → RLS policies (bot_id scoping for all tables)
  → Supabase Auth setup + profiles table with role column
  ↓ REQUIRED BY: everything

Phase 2: Core RAG Pipeline
  → Embedding abstraction (voyage-3 / Claude)
  → pgvector chunks table + IVFFlat index
  → Ingestion pipeline (extract → chunk → embed → store)
  → Retrieval pipeline (embed → search → FAQ inject → Claude stream)
  ↓ REQUIRED BY: chat endpoint, testing console

Phase 3: Webhook Gateway
  → API key generation + hashing
  → /api/chat endpoint (streaming)
  → Language detection + intent classification
  → Conversation persistence
  ↓ REQUIRED BY: n8n integration, booking flow

Phase 4: Dashboard (Admin CRUD)
  → Next.js App Router layout with Supabase Auth
  → Bot management, knowledge base upload UI
  → FAQ / templates / personality / guardrails CRUD
  → Testing console
  ↓ REQUIRED BY: Elken content seeding, API key management UI

Phase 5: Booking State Machine
  → State machine transitions + slot checking
  → Booking persistence in conversation.metadata
  → Bookings management page (feature-flagged)
  ↓ REQUIRED BY: Elken live deployment (feature-flagged, skippable for other tenants)

Phase 6: Analytics + Super-Admin
  → Analytics aggregation queries (message volume, intent breakdown, latency)
  → Analytics dashboard page
  → Super-admin tenant management view
  ↓ REQUIRED BY: operational visibility

Phase 7: Integration Layer
  → n8n snippet generation in Integrations page
  → Elken seed script (tenant, bot, FAQs, templates, personality)
  → End-to-end smoke test via n8n
```

---

## Sources

Note: External documentation tools (WebFetch, WebSearch, Bash) were unavailable during this research session. The following sources informed this document from training knowledge (cutoff August 2025):

- Supabase RLS documentation — https://supabase.com/docs/guides/database/postgres/row-level-security (MEDIUM confidence — well-established Supabase pattern, policy syntax verified against training data)
- Next.js App Router streaming — https://nextjs.org/docs/app/building-your-application/routing/route-handlers (HIGH confidence — streaming with Web Streams API is stable Next.js 14 pattern)
- pgvector with bot_id filtering — https://github.com/pgvector/pgvector (HIGH confidence — cosine similarity + WHERE bot_id is standard usage)
- Claude API streaming (Anthropic SDK) — https://docs.anthropic.com/en/api/messages-streaming (HIGH confidence — messages.stream() is the current streaming API)
- API key hashing with SHA-256 in Node.js — Node.js crypto module, well-established security pattern (HIGH confidence)
- Booking state machine via JSONB — PostgreSQL JSONB documentation (HIGH confidence — JSONB metadata on conversation records is a standard pattern for stateful chatbot flows)
- PROJECT.md architectural decisions — Locked decisions from spec (multi-tenant RLS, booking via conversation.metadata, API key hashing, feature-flagged booking module)
