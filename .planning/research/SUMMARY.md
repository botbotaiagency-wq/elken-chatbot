# Project Research Summary

**Project:** Multi-Tenant AI Chatbot SaaS Platform (Ask Ethan Digital)
**Domain:** Multi-tenant SaaS — AI chatbot with RAG pipeline, booking flows, multilingual support (EN/BM/ZH), WhatsApp/Telegram delivery via n8n
**Researched:** 2026-03-18
**Confidence:** MEDIUM (training data, August 2025 cutoff — key versions require pre-build verification)

## Executive Summary

This is a multi-tenant AI chatbot SaaS platform built on a Next.js 14 App Router monolith, Supabase Postgres with pgvector, Claude Haiku as the LLM, and n8n as the external channel bridge for WhatsApp and Telegram delivery. The first and only tenant at launch is Elken, a Malaysian health and beauty company whose users communicate in English, Bahasa Malaysia, and Mandarin. The platform must be production-ready for Elken while remaining architected for future tenants — meaning tenant isolation is a first-class constraint, not an afterthought. Experts build this type of product by enforcing data isolation at the database layer (Supabase RLS + bot_id scoping), not relying on application-level filtering alone, and by treating the RAG pipeline as the critical path that everything else depends on.

The recommended approach is a phased build that front-loads the hardest architectural decisions: schema design with RLS and HNSW pgvector indexes in Phase 1, then the RAG pipeline (ingestion + retrieval + streaming chat) in Phase 2, then the webhook gateway and admin dashboard together in Phases 3 and 4, and finally the Elken-specific booking state machine as a feature-flagged module. This ordering respects the dependency chain — nothing works without the data layer, nothing is useful without RAG, and nothing ships without the webhook and dashboard. The booking module is deliberately isolated so non-booking tenants never see it.

The top risks are: (1) multi-tenancy data leakage from missing bot_id scoping, which is catastrophic and silent in a single-tenant dev environment; (2) Vercel streaming timeouts on the chat endpoint if the wrong runtime is used; (3) BM language embedding quality, which is hard to measure without testing against real Malay queries; and (4) booking double-booking race conditions. All four risks are preventable if the countermeasures are built in from the relevant phase start rather than bolted on later.

---

## Key Findings

### Recommended Stack

The stack is locked at Next.js 14 App Router + TypeScript + Supabase Postgres + Claude Haiku + Vercel. Research confirms these are the correct choices. The critical additions beyond the locked spec are: voyage-3 (via Anthropic API) for retrieval-optimized multilingual embeddings instead of Claude's general embeddings; the Vercel AI SDK v3 for streaming chat without SSE boilerplate; shadcn/ui for the 11-page admin dashboard; and Zustand + TanStack Query for client/server state respectively. Full details in `.planning/research/STACK.md`.

**Core technologies:**
- **Next.js 14 App Router:** Full-stack framework — App Router colocates server/client logic; RSC reduces bundle size; do not upgrade to v15 mid-project
- **Supabase Postgres + pgvector:** Primary datastore + vector search — RLS enforces tenant isolation at DB layer; HNSW index required (not IVFFlat); use `vector(1024)` for voyage-3
- **Claude Haiku (claude-haiku-20241022):** LLM — locked per spec; fast and cheap; handles EN/BM/ZH without fine-tuning
- **voyage-3 (via Anthropic API):** Embeddings — retrieval-optimized; outperforms Claude's general embeddings on multilingual content; use `input_type: "document"` vs `"query"` asymmetric approach
- **Vercel AI SDK v3:** Streaming — `streamText(...).toDataStreamResponse()` pattern; `useChat` hook on client; eliminates SSE boilerplate
- **shadcn/ui + Tailwind v3:** Dashboard UI — components copied into repo (no version lock-in); use v3, not v4 (shadcn/ui targets v3)
- **Supabase Auth via `@supabase/ssr`:** Dashboard auth — `@supabase/auth-helpers-nextjs` is deprecated; use `@supabase/ssr`
- **pdf-parse + mammoth:** File extraction — Node.js runtime only (not Edge); enforce `export const runtime = 'nodejs'` on ingestion routes
- **Zustand + TanStack Query v5:** State — Zustand for client UI state; React Query for server state cache; no Redux

**Critical version notes:**
- Do NOT use `@supabase/auth-helpers-nextjs` (deprecated)
- Do NOT use Tailwind v4 (breaking config changes; shadcn/ui targets v3)
- Do NOT upgrade Next.js to v15 mid-project
- LangChain text splitter import path (`@langchain/textsplitters`) needs verification — alternatively implement a simple recursive splitter manually

### Expected Features

Full analysis in `.planning/research/FEATURES.md`.

**Must have (table stakes for v1):**
- RAG pipeline end-to-end (upload → chunk → embed → retrieve → stream) — the core product
- Webhook endpoint with API key auth — the only delivery mechanism for WhatsApp/Telegram via n8n
- Multilingual auto-detection and response templates (EN/BM/ZH) — table stakes for Elken's market
- FAQ management (CRUD with language tags) — admins must tune without developer help
- Bot personality and guardrails configuration — essential for regulated health/beauty context
- Testing console with source chunk transparency — required before going live
- Knowledge base file management with indexing status — upload, view, delete with visibility
- Unanswered/low-confidence query log — admins must know what the bot can't answer
- Analytics: message volume, intent breakdown, response latency
- API key generation and revocation
- Tenant and bot isolation enforced at all layers
- Booking state machine with slot availability (feature-flagged, Elken-specific)

**Should have (competitive differentiators):**
- Pre-seeded tenant onboarding (Elken seed script — FAQs, templates, personality) — reduces time-to-live from days to minutes
- Intent classification with per-message labelling — enables routing and workflow triggers
- Conversation memory / context window management across multi-turn sessions
- Booking funnel analytics (conversion from enquiry to booking confirmation)
- n8n integration snippets (copy-paste webhook URL + JSON body)
- Super-admin cross-tenant view (needed when Tenant #2 onboards)

**Defer to v2+:**
- Direct WhatsApp/Telegram SDK integration — n8n owns the channel bridge; do not couple to it
- Embeddable chat widget — REST webhook is sufficient; Elken is WhatsApp-first
- Google Drive auto-sync — manual upload only for v1
- Multi-model support (GPT-4, Gemini) — Claude only per spec
- Billing and subscription management — Navien manages manually at this tenant count
- Mobile app — responsive web dashboard only
- Python ingestion microservice — inline Next.js route is sufficient for v1

### Architecture Approach

The architecture is a Next.js monolith with a clear separation between the public webhook gateway (`/api/chat`) and the authenticated admin surface (`/app/(dashboard)/` + `/api/admin/*`). Data is entirely in Supabase (Postgres + pgvector + Auth + Storage). Tenant isolation is enforced at two levels: RLS policies on every bot_id-scoped table for dashboard (anon key) queries, and explicit bot_id WHERE clauses for service-role webhook queries. The booking state machine lives in `conversation.metadata` jsonb — no separate Redis or session store, survives Vercel cold starts. The n8n bridge is deliberately external: this platform exposes a clean REST endpoint; it never holds channel credentials. Full architecture in `.planning/research/ARCHITECTURE.md`.

**Major components:**
1. **Webhook Gateway (`/api/chat`)** — Validates API key (hash lookup), resolves bot_id, runs RAG pipeline, streams Claude response back to n8n
2. **RAG Pipeline** — Embeds query (voyage-3), cosine search on pgvector (bot_id-scoped), FAQ priority injection, guardrails check, Claude Haiku streaming
3. **Ingestion Pipeline** — File upload to Supabase Storage, text extraction (pdf-parse/mammoth), recursive chunking, voyage-3 batch embedding, pgvector insert
4. **Admin Dashboard (App Router)** — 11 pages per bot: knowledge, FAQs, templates, personality, guardrails, analytics, bookings, integrations, API keys, testing console
5. **Booking State Machine** — Stateful multi-turn flow persisted in `conversation.metadata` jsonb; feature-flagged per bot; slot reservation via `SELECT FOR UPDATE` transaction
6. **Supabase RLS Layer** — bot_id isolation at DB level; second line of defense behind application-layer scoping
7. **Super-Admin View** — Dedicated RLS policy (not service-role bypass); cross-tenant read access for Navien

**Key patterns:**
- Dual Supabase client strategy: `supabaseAdmin` (service role, server-only) vs anon client (browser + auth session)
- API key stored as SHA-256 hash only; prefix displayed; timing-safe comparison on every webhook request
- FAQ priority injection above RAG chunks in context assembly — FAQs always win
- HNSW index on embedding column with `bot_id` filter before vector operator in all queries

### Critical Pitfalls

Top risks ranked by consequence severity. Full analysis in `.planning/research/PITFALLS.md`.

1. **Multi-tenancy data leakage via missing bot_id scoping** — Enable RLS on every table from the initial migration; write a two-tenant isolation test before any feature work; reserve service role key for ingestion only, not chat/query paths
2. **Streaming breaks on Vercel (timeout or buffering)** — Use Edge runtime on `/api/chat`; set `maxDuration = 30` on ingestion routes (requires Vercel Pro); test streaming on Vercel preview, not just localhost
3. **BM (Bahasa Malaysia) embedding quality failure** — Test retrieval recall per language before connecting Claude; add BM keyword pre-filter to language detector (`["saya", "awak", "boleh", "nak", ...]`); default to BM classification when confidence < 0.7 for Elken deployment
4. **Booking double-booking race condition** — Use `SELECT ... FOR UPDATE` inside a single DB transaction for slot check+reserve; never split check and reserve into separate operations; add optimistic locking on `conversation.metadata` for concurrent message handling
5. **pgvector sequential scan (no HNSW index)** — Create HNSW index in the initial migration: `CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`; do not wait until RAG phase

---

## Implications for Roadmap

The architecture research provides an explicit 7-phase build order based on dependency analysis. Research confirms this sequencing. The suggested phases below follow that dependency chain directly.

### Phase 1: Data Foundation
**Rationale:** Everything — RAG, auth, booking, analytics — depends on a correct schema. RLS policies and indexes are retrofitting nightmares; they must be established before the first query is written. This phase has no external API dependencies and can be fully validated with SQL tests.
**Delivers:** Supabase schema (tenants, bots, bot_configs, api_keys, conversations, documents, chunks, faqs, templates, bookings, usage_logs), RLS policies on all bot_id-scoped tables, HNSW index on chunks.embedding, Supabase Auth setup with super_admin role, composite indexes on conversations(bot_id, user_id)
**Addresses:** Tenant isolation, API key hashing setup, two-tenant isolation test
**Avoids:** Pitfalls 1 (data leakage), 2 (RLS performance), 3 (missing HNSW index), missing conversation indexes, missing RLS on future tables

### Phase 2: Core RAG Pipeline
**Rationale:** RAG is the product. No feature is useful without working retrieval. Ingestion and retrieval must be built and validated together — specifically the embedding dimension contract must be locked before any data is inserted. BM retrieval quality must be tested before connecting Claude.
**Delivers:** Embedding abstraction (voyage-3 with shared EMBEDDING_MODEL + EMBEDDING_DIM constant), ingestion pipeline (extract → chunk → embed → store), retrieval pipeline (embed → cosine search → FAQ inject), similarity threshold tuning, multilingual retrieval test suite per language
**Uses:** pdf-parse, mammoth, voyage-3 via Anthropic API, pgvector HNSW
**Avoids:** Pitfalls 4 (embedding dimension mismatch), 5 (no similarity threshold), 6 (BM embedding quality)

### Phase 3: Webhook Gateway and Chat Endpoint
**Rationale:** n8n integration is the only delivery channel. The webhook endpoint is the product's external surface. API key auth must be complete before any external testing. Streaming behavior must be validated on Vercel before the testing console is built.
**Delivers:** API key generation + hashing, `/api/chat` public endpoint with streaming, language detection with BM keyword pre-filter, intent classification, conversation persistence with metadata jsonb, Vercel Edge runtime streaming validated on preview deployment
**Uses:** Vercel AI SDK v3 `streamText` + `toDataStreamResponse`, `@anthropic-ai/sdk`, `crypto.timingSafeEqual` for key validation
**Avoids:** Pitfalls 7 (Vercel streaming), 10 (plaintext API key storage), 12 (BM misclassification), n8n duplicate webhook retry (idempotency via message_id)

### Phase 4: Admin Dashboard
**Rationale:** Admins need the dashboard to configure and test the bot. The testing console closes the feedback loop on RAG quality. Dashboard can only be built after Phases 1-3 establish the data and chat foundations.
**Delivers:** Next.js App Router layout with Supabase Auth session, bot management, knowledge base upload UI (with file size limit + extraction validation), FAQ/templates/personality/guardrails CRUD, testing console with source chunk transparency and latency display, API key management UI
**Uses:** shadcn/ui components (Sheet, Dialog, DataTable, Tabs, Form), Tailwind v3, shadcn/ui Form + react-hook-form + zod, Zustand + TanStack Query
**Avoids:** Pitfall 11 (large PDF OOM — enforce 10MB limit and validate extracted text), Supabase Storage public bucket misconfiguration (private bucket + signed URLs)

### Phase 5: Booking State Machine
**Rationale:** Feature-flagged to Elken only. Booking is the primary Elken use case beyond product queries but has the most complex concurrency requirements. Must be built on a stable webhook and conversation foundation. The double-booking race condition design must precede any state transition code.
**Delivers:** Booking state machine transitions (idle → collect_date → collect_facility → collect_slot → confirm → complete), slot availability check with `SELECT FOR UPDATE`, optimistic locking on conversation.metadata, booking persistence, bookings management dashboard page, DB-level cutoff constraint
**Avoids:** Pitfalls 8 (double-booking race), 9 (conversation state race), minor Pitfall 4 (cutoff rule not DB-enforced)

### Phase 6: Analytics and Super-Admin
**Rationale:** Required for operational visibility and for Navien to monitor platform health. Depends on usage data being logged from Phase 3 onward. Super-admin is deferred until this phase since there is only one tenant at launch.
**Delivers:** Analytics aggregation queries (message volume, intent breakdown, latency p50/p99), analytics dashboard page per bot, Claude token usage tracking per bot_id with daily cap, super-admin cross-tenant view (via explicit RLS policy, not service-role bypass)
**Avoids:** Moderate Pitfall 2 (Claude cost overrun), Moderate Pitfall 5 (super-admin service-role bypass)

### Phase 7: Integration Layer and Launch
**Rationale:** Final integration test and Elken seed data. Confirms end-to-end flow from WhatsApp through n8n through webhook through Claude back to WhatsApp user.
**Delivers:** Elken seed script (tenant, bot, FAQs in EN/BM/ZH, response templates, personality config), n8n integration snippets page, end-to-end smoke test via n8n with real WhatsApp messages
**Avoids:** Moderate Pitfall 3 (n8n webhook retry — idempotency check)

### Phase Ordering Rationale

- Schema before everything: RLS policies and HNSW indexes cannot be safely retrofitted after data exists. Doing this first eliminates the #1 and #3 critical pitfalls by design.
- RAG before dashboard: The testing console validates RAG quality. Building the dashboard before RAG is ready means the testing console would test nothing useful.
- Webhook before dashboard completion: Streaming behavior on Vercel must be confirmed before the testing console uses the same endpoint. Validate on Vercel preview in Phase 3.
- Booking isolated in Phase 5: Feature flag means Phases 1-4 are fully shippable for non-booking tenants. The complex concurrency problems in booking (Pitfalls 8 and 9) are contained to one phase.
- Analytics last among core features: Usage data must be flowing (from Phase 3) before aggregation queries are meaningful. Token tracking should be wired in Phase 3 but the dashboard can wait.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Booking State Machine):** Elken's specific booking rules (cutoff times, member vs non-member paths, facility/slot schema) are unknown. Needs a requirements session with Navien/Elken before the state machine is designed. Booking flow UX patterns for WhatsApp (conversational vs menu-driven) also need validation.
- **Phase 3 (Language Detection):** BM language detector library choice (`franc`, `langdetect`, or custom keyword-based) needs an empirical test against real Elken WhatsApp message samples before committing to an implementation.
- **Phase 7 (n8n Integration):** n8n version and WhatsApp Business API access method (Cloud API vs on-premise) will determine the exact webhook payload shape. Verify with Navien's current n8n setup.

Phases with well-documented standard patterns (skip deep research):
- **Phase 1 (Data Foundation):** Supabase schema + RLS is well-documented. Follow patterns in ARCHITECTURE.md and STACK.md directly.
- **Phase 2 (RAG Pipeline):** voyage-3 + pgvector HNSW + recursive chunking is a standard pattern. Follow STACK.md guidance. The main validation task is the multilingual test suite, not research.
- **Phase 4 (Admin Dashboard):** shadcn/ui + Next.js App Router + Supabase Auth is thoroughly documented. Follow ARCHITECTURE.md folder structure directly.
- **Phase 6 (Analytics):** Standard time-series aggregation queries + Recharts. No novel patterns needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core choices (Next.js 14, Supabase, Claude Haiku) are HIGH confidence. voyage-3 model name and Vercel AI SDK v3 API shape need version verification against current docs before implementation. LangChain text splitter import path is LOW — consider implementing a custom splitter instead. |
| Features | MEDIUM | Table stakes and anti-features are clearly defined. Booking state machine specifics (Elken's exact flow, member/non-member rules) are UNKNOWN — requires a requirements session with Navien. BM language quality claims are LOW confidence without empirical testing. |
| Architecture | HIGH | All architecture patterns are well-established (RLS, dual Supabase client, HNSW indexing, conversation.metadata jsonb). The 7-phase build order is internally consistent and dependency-correct. |
| Pitfalls | HIGH | Pitfalls are domain-specific and drawn from known failure patterns in this exact stack combination. The top 5 pitfalls are well-supported by documented precedent. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **voyage-3 model name and pricing:** Verify current model identifier and cost per 1M tokens via Anthropic API docs before implementation. The model was confirmed available as of August 2025 but the name may have changed.
- **Vercel AI SDK v3 `StreamingTextResponse` deprecation:** Confirm whether `StreamingTextResponse` has been fully removed in the current version. Use `toDataStreamResponse()` pattern from STACK.md regardless.
- **Tailwind v3 vs v4 with shadcn/ui CLI:** Run `npx shadcn@latest init` and observe which Tailwind version the CLI targets as of March 2026 before manually installing Tailwind.
- **Elken booking rules:** Member vs non-member booking paths, facility schema (locations, facility types, slot intervals), last-booking cutoff minutes — none of these are specified in research. Needs a pre-Phase 5 requirements session.
- **BM embedding quality empirical test:** Create a 20-query BM test set and measure voyage-3 retrieval recall before committing the RAG architecture to production. Do this at the end of Phase 2.
- **n8n payload shape:** Confirm the exact JSON structure n8n sends for WhatsApp messages on Navien's current n8n version. The `conversation_id` and `sender_id` field names must match the webhook gateway implementation.
- **Supabase pgvector version on Pro tier:** Confirm current pgvector version and HNSW DDL syntax via the Supabase dashboard before writing migrations.

---

## Sources

### Primary (HIGH confidence)
- Next.js 14 App Router documentation — routing, RSC, Route Handlers, streaming
- Supabase RLS documentation — policy syntax, `auth.uid()` patterns, `@supabase/ssr` replacement for `auth-helpers-nextjs`
- Claude API streaming (Anthropic SDK) — `messages.stream()`, haiku model ID
- pgvector documentation — HNSW indexing DDL, `<=>` cosine distance operator, `bot_id` filter ordering
- Node.js `crypto` module — `randomBytes`, `createHash`, `timingSafeEqual`
- Postgres JSONB + `SELECT FOR UPDATE` — conversation metadata pattern, slot reservation transactions

### Secondary (MEDIUM confidence)
- voyage-3 via Anthropic API — retrieval-optimized embeddings, multilingual capability, `input_type` asymmetric approach (confirmed as of Aug 2025; verify current model name)
- Vercel AI SDK v3 — `streamText`, `toDataStreamResponse`, `useChat` (confirmed as of Aug 2025; verify `StreamingTextResponse` deprecation status)
- shadcn/ui component patterns — Sheet, Dialog, DataTable, Tabs, Form with react-hook-form + zod (stable patterns; verify Tailwind v3/v4 CLI behavior)
- Chatbase, Botpress, CustomGPT feature landscape — competitor feature expectations for RAG SaaS platforms

### Tertiary (LOW confidence — validate before using)
- BM-specific embedding quality claims — needs empirical test with real Malay queries against voyage-3
- Booking state machine UX patterns for WhatsApp — no specific post-2024 sources; validate against Elken's actual requirements
- LangChain `@langchain/textsplitters` import path — package restructured in 2024/2025; recommend implementing custom recursive splitter instead to eliminate the dependency

---

*Research completed: 2026-03-18*
*Ready for roadmap: yes*
