# Phase 2: RAG Pipeline - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the file ingestion pipeline (upload → extract → chunk → embed → store) and the RAG retrieval endpoint (embed query → cosine search → FAQ priority → Claude Haiku streaming response). Includes structured product data storage and management. Three languages: EN, BM, ZH. The testing console UI and admin dashboard pages for Knowledge Base are Phase 4 — this phase delivers the API layer and data model only.

</domain>

<decisions>
## Implementation Decisions

### Embedding Provider
- **voyage-3-large** via Voyage AI API (`VOYAGE_API_KEY` env var)
- Set `output_dimension=1536` to match the existing `chunks.embedding vector(1536)` schema — no migration needed
- Batch all chunks per document in a single Voyage API call (up to 128 inputs per call) — fewer round-trips, cleaner error handling per document
- Also embed FAQ entries (store FAQ embeddings for semantic matching — FAQ answers win over RAG chunks when semantic similarity is high)
- Model rationale: best multilingual retrieval quality for EN/BM/ZH; Anthropic-aligned (Voyage AI acquired by Anthropic)

### Ingestion Flow
- **Two-step process:** file uploads to Supabase Storage first → separate API call triggers processing
- Document status lifecycle: `pending` → `processing` → `ready` / `failed`
- Admin polls for status updates (no websockets needed — polling sufficient per project constraints)
- **File size limit:** 10 MB per upload
- **PDF parsing:** `pdf-parse` (lightweight, no native deps, works for text-based PDFs)
- **DOCX parsing:** `mammoth.js`
- **TXT:** raw string read
- **Scanned/image PDF handling:** if extracted text < 100 characters, reject with error "Scanned PDFs are not supported — please upload a text-based PDF"
- Ingestion runs inside Next.js API routes (no Railway worker — locked project decision)

### Language Detection
- Delegate language classification to **Claude Haiku** — combined with intent classification in a single inference call
- Claude returns structured JSON: `{ language: "en" | "bm" | "zh", intent: "browse_product" | "health_issue" | "book_session" | "faq" | "general" }`
- **Re-detect per message** — not locked to first detected language; customers code-switch mid-conversation and the bot adapts
- **RAG search is language-agnostic** — search all chunks regardless of language; voyage-3-large captures cross-lingual semantics; Claude responds in the detected language regardless of chunk language

### Product Detail Card
- **Dedicated `products` table** with structured fields: `name`, `description`, `key_ingredients`, `health_benefits`, `pricing`, `suggested_usage`, `category`, `bot_id`
- Products are also embedded and stored as chunks for RAG semantic search
- When a product match is found, the full structured Product Detail Card is returned (not just the chunk text)
- **Data entry:** Both CSV bulk import (for Elken's full catalogue) AND manual form (for individual additions/edits)
- **Language:** English-only fields for v1 — Claude translates the product card into BM/ZH when responding in those languages; no multilingual schema complexity

### RAG Retrieval Logic
- Top-K: Claude's discretion (typically 5 chunks)
- Similarity threshold: 0.75 (RAG-09 — locked in requirements)
- FAQ semantic matching runs first — if a FAQ's embedding similarity exceeds threshold, inject FAQ answer as priority context above RAG chunks
- Intent + language detected in the same Haiku call before retrieval
- All messages logged: role, content, intent, source_chunks (IDs + similarity scores), rag_found flag, latency_ms (RAG-10)

### Claude's Discretion
- Exact system prompt structure and context assembly order
- Top-K chunk count
- Chunking implementation details (character/token boundary handling, overlap mechanics)
- Supabase Storage bucket naming and folder structure
- Error retry logic for Voyage API calls
- DOCX image stripping behavior

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Knowledge Base & Ingestion Requirements
- `.planning/REQUIREMENTS.md` §Knowledge Base & Ingestion (KB-01 through KB-07) — exact acceptance criteria for file upload, chunking spec (500 tokens, 50 overlap), category tags, status lifecycle, chunk count display, delete cascade, and Product Detail Card fields

### RAG Chat Engine Requirements
- `.planning/REQUIREMENTS.md` §RAG Chat Engine (RAG-01 through RAG-10) — chat endpoint contract, language detection, intent classification, FAQ priority injection, product search, health concern matching, similarity threshold (0.75), message logging spec

### Architecture Constraints
- `.planning/PROJECT.md` §Constraints — ingestion runs in Next.js API routes (no Railway worker), Claude Haiku for chat, voyage-3 for embeddings, n8n is the channel bridge (this app exposes REST webhook only)
- `.planning/PROJECT.md` §Key Decisions — pgvector over Pinecone, booking state machine via `conversation.metadata`, feature-flagged booking module

### Existing Schema (Phase 1 output — MUST read before adding migrations)
- `supabase/migrations/00002_schema.sql` — existing `documents`, `chunks`, `conversations`, `messages`, `faqs`, `response_templates` tables; Phase 2 adds a `products` table via new migration
- `supabase/migrations/00004_indexes.sql` — existing HNSW index (`chunks_embedding_hnsw_idx`, cosine distance, 1536-dim); Phase 2 must add a matching index on `products` embeddings if products get their own embedding column

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase/service.ts` — service role Supabase client; use this in all API routes that handle ingestion and RAG (not the user session client)
- `lib/supabase/server.ts` — server session client for dashboard pages that need user context
- `supabase/migrations/00002_schema.sql` — `documents` and `chunks` tables already exist with correct schema; `messages` table already has `intent`, `source_chunks`, `rag_found`, `latency_ms` columns ready

### Established Patterns
- All API routes use the service role client from `lib/supabase/service.ts` — never expose SUPABASE_SERVICE_ROLE_KEY via NEXT_PUBLIC_ variables
- bot_id is the universal isolation key — every insert/select in ingestion and RAG must be scoped by bot_id
- Supabase migrations in `supabase/migrations/` with incrementing prefix (`00005_...`, `00006_...`)
- Next.js App Router API routes at `app/api/[route]/route.ts`

### Integration Points
- `app/api/ingest/[botId]/route.ts` — new: file upload endpoint (POST)
- `app/api/ingest/[botId]/process/route.ts` — new: trigger processing after upload (POST)
- `app/api/chat/[botId]/route.ts` — new: RAG chat endpoint (POST, streaming)
- `app/api/products/[botId]/route.ts` — new: product CRUD + CSV import (GET/POST)
- Supabase Storage bucket: `documents` (or `bot-files`) — new, configured during this phase

</code_context>

<specifics>
## Specific Ideas

- STATE.md flagged BM language detection as a blocker — resolved by delegating to Claude Haiku (no separate library needed)
- Elken has ~50+ products across categories (Beauty, FMCG, GenQi, Healthfood, Home Appliances) — CSV import is essential for initial data load
- voyage-3-large was chosen specifically for multilingual EN/BM/ZH retrieval quality; output_dimension=1536 matches the existing schema exactly

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-rag-pipeline*
*Context gathered: 2026-03-19*
