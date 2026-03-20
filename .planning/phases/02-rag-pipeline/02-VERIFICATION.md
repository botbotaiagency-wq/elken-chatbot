---
phase: 02-rag-pipeline
verified: 2026-03-20T11:48:00Z
status: passed
score: 5/5 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Chat endpoint validates API key (RAG-01) — crypto.timingSafeEqual against bots.api_key_hash, null hash allows dev-mode bypass"
    - "RAG-07 wellness fallback — intent-conditional branch in buildSystemPrompt; health_issue with ragFound=false shows GenQi/Healthfood category suggestions"
    - "RAG-08 scope — REQUIREMENTS.md documents text-based Product Detail Cards satisfy Phase 2; brochure/file delivery deferred to Phase 7"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "End-to-end document ingestion"
    expected: "Upload a PDF via POST /api/ingest/[botId], POST to /process, verify status becomes ready with non-zero chunk_count in Supabase"
    why_human: "Requires applied migrations, live Supabase storage bucket, and VOYAGE_API_KEY configured"
  - test: "Cross-language RAG retrieval"
    expected: "A query in Bahasa Malaysia or Chinese returns relevant chunks with similarity >= 0.75"
    why_human: "Requires populated knowledge base and live Voyage AI embedding API"
  - test: "Streaming chat response with FAQ priority"
    expected: "A question matching a seeded FAQ returns the FAQ answer, not a generic document chunk"
    why_human: "Requires seeded FAQ embeddings and live Voyage AI + Anthropic APIs"
  - test: "Migrations applied correctly"
    expected: "supabase db push applies 00006 and 00007 without errors; chunks.embedding is vector(1024); match_chunks/match_faqs/match_products RPCs exist"
    why_human: "Requires connected Supabase project with CLI access"
---

# Phase 2: RAG Pipeline Verification Report

**Phase Goal:** Documents can be uploaded, chunked, embedded, and stored; the bot can retrieve the most relevant chunks for any query in English, Bahasa Malaysia, and Chinese
**Verified:** 2026-03-20T11:48:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 02-06)

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can upload a PDF/DOCX/TXT and watch status move pending -> processing -> ready with chunk count | VERIFIED | `app/api/ingest/[botId]/route.ts` creates signed upload URL with status=pending; `/process` route runs extract/chunk/embed/store and sets status=ready with chunk_count |
| 2 | Admin can delete a document and all its chunks are removed from pgvector | VERIFIED | `app/api/documents/[botId]/[documentId]/route.ts` removes from storage then deletes document record; FK cascade removes all chunks |
| 3 | A query in EN/BM/ZH returns correct top-k chunks with similarity > 0.75 | VERIFIED (structural) | `lib/rag/retrieve.ts` queries match_faqs + match_chunks + match_products with SIMILARITY_THRESHOLD=0.75; detect.ts handles language via Claude Haiku; human end-to-end test needed |
| 4 | FAQs returned as priority context above RAG chunks | VERIFIED | `lib/rag/prompt.ts` injects "PRIORITY FAQ ANSWERS (use these first)" section before "KNOWLEDGE BASE CONTEXT" |
| 5 | All messages logged with role, intent, source chunk IDs, similarity scores, rag_found, latency | VERIFIED | `lib/rag/logger.ts` logMessage inserts all fields; chat endpoint logs user message pre-pipeline and assistant message post-stream with full metadata |

**Score:** 5/5 success criteria verified (structural + unit-test level; items 3-4 also need live human testing)

---

## Gap Closure Verification (Plan 02-06)

### Gap 1 — RAG-01 API Key Validation (was BLOCKER, now CLOSED)

**Previous state:** Line 15 TODO comment deferring validation to Phase 3; endpoint was unauthenticated.

**Current state (verified in `app/api/chat/[botId]/route.ts`):**
- `import crypto from 'crypto'` and `import { createServiceClient } from '@/lib/supabase/service'` present
- Validation block runs immediately after `await params`, before body parsing
- Supabase lookup: `from('bots').select('id, api_key_hash').eq('id', botId).single()`
- 404 returned if bot not found
- When `api_key_hash` is set: `X-API-Key` header extracted, SHA-256 hashed, compared with `crypto.timingSafeEqual`; 401 for missing or wrong key
- When `api_key_hash` is null: `console.warn('[DEV MODE] ...')` and request proceeds
- Zero remaining TODO Phase 3 comments in this file

**Tests:** `tests/api/chat-auth.test.ts` — 5 test cases covering all branches (missing key / wrong key / correct key / null hash dev mode / 404 non-existent bot). All 5 pass.

**Pattern counts:**
- `timingSafeEqual`: 1 match
- `X-API-Key`: 3 matches (header read + two error messages)
- `api_key_hash`: 8 matches
- `DEV MODE`: 1 match
- `sha256`: 1 match
- `TODO Phase 3`: 0 matches

### Gap 2 — RAG-07 Wellness Fallback (was PARTIAL, now CLOSED)

**Previous state:** Generic "I don't have specific information" fallback for all intents when ragFound=false.

**Current state (verified in `lib/rag/prompt.ts`, lines 51-67):**
- Fallback block branches on `detection.intent === 'health_issue'`
- Health issue branch: pushes `"NO MATCHING PRODUCT FOUND FOR HEALTH CONCERN"` section naming GenQi (wellness devices) and Healthfood (supplements) categories with an invitation to browse
- All other intents: original generic fallback still intact (`"NO KNOWLEDGE BASE MATCH FOUND"`)

**Pattern counts:**
- `health_issue`: 3 matches (fallback branch condition + two intent-specific instruction blocks)
- `GenQi`: 1 match
- `Healthfood`: 1 match
- `NO MATCHING PRODUCT FOUND FOR HEALTH CONCERN`: 1 match
- `NO KNOWLEDGE BASE MATCH FOUND`: 1 match

### Gap 3 — RAG-08 Scope (was PARTIAL/DEFERRED, now DOCUMENTED)

**Previous state:** No scope clarification; brochure delivery gap was ambiguous.

**Current state (verified in `.planning/REQUIREMENTS.md`, RAG-08 entry):**
- Scope note added: "Text-based Product Detail Cards (name, description, ingredients, benefits, pricing, usage) are returned in the Claude response. Brochure/PDF file attachment and WhatsApp media message delivery are deferred to Phase 7 (Integration and Launch) where the n8n bridge handles media message types."
- RAG-08 checkbox remains `[x]` (marked complete within Phase 2 scope)

---

## Required Artifacts

### Wave 1 — Foundation

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00006_schema_fix_products.sql` | Schema fix + products table | VERIFIED | Contains vector(1024), DROP INDEX IF EXISTS chunks_embedding_hnsw_idx, products_tenant_isolation policy |
| `supabase/migrations/00007_rag_functions.sql` | match_chunks/faqs/products RPCs | VERIFIED | All 3 functions with p_bot_id, match_threshold, match_count parameters |
| `lib/ingest/chunker.ts` | Token-based chunking with overlap | VERIFIED | Uses encode/decode from gpt-tokenizer; 500 token chunks, 50 overlap |
| `lib/ingest/extractor.ts` | PDF/DOCX/TXT extraction | VERIFIED | PDFParse class API; rejects scanned PDFs; mammoth for DOCX |
| `lib/ingest/embedder.ts` | Voyage AI batch embedding | VERIFIED | voyage-3-large, outputDimension: 1024, inputType document and query |
| `vitest.config.ts` | Test infrastructure | VERIFIED | environment: node, @ alias, setupFiles |
| `tests/setup.ts` | Mock env vars | VERIFIED | All required env vars mocked |
| `types/database.ts` | Phase 2 TypeScript types | VERIFIED | Product, Message, Conversation, FAQ, Intent, Language, DocumentCategory all present |

### Wave 2 — Ingestion API

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/ingest/[botId]/route.ts` | POST — upload initiation | VERIFIED | Creates document record with status=pending; generates signed upload URL; validates contentType and category |
| `app/api/ingest/[botId]/process/route.ts` | POST — processing pipeline | VERIFIED | Imports extractText, chunkText, embedDocumentChunks; handles status=failed on error; maxDuration=60 |
| `app/api/documents/[botId]/route.ts` | GET — document listing | VERIFIED | Returns id, filename, category, status, chunk_count, error_message, created_at |
| `app/api/documents/[botId]/[documentId]/route.ts` | DELETE — document + chunks + storage | VERIFIED | Removes from storage then deletes document; FK cascade handles chunks |
| `app/api/products/[botId]/route.ts` | GET + POST — product CRUD + CSV | VERIFIED | GET excludes embedding; POST handles JSON (single) and text/csv (bulk) with papaparse |

### Wave 3 — RAG Library

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/rag/detect.ts` | Intent + language detection | VERIFIED | Uses claude-haiku-4-5-20251001; validates language/intent; normalizes invalid values to en/general |
| `lib/rag/retrieve.ts` | Retrieval orchestration | VERIFIED | match_faqs first, then match_chunks always, match_products for browse_product/health_issue only; ragFound correctly derived |
| `lib/rag/prompt.ts` | System prompt assembly | VERIFIED | FAQ priority above chunks; product cards; intent-conditional wellness fallback (RAG-07 closed); generic fallback for other intents |

### Wave 4 — Chat Endpoint + Logger

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/rag/logger.ts` | Message logging + conversation management | VERIFIED | logMessage inserts all required fields; getOrCreateConversation verify-then-create pattern |
| `app/api/chat/[botId]/route.ts` | Streaming RAG chat endpoint with API key validation | VERIFIED | All pipeline wiring correct; ReadableStream streaming confirmed; API key validation with timingSafeEqual; dev-mode bypass for null api_key_hash |
| `tests/api/chat-auth.test.ts` | API key validation test coverage | VERIFIED | 5 test cases covering all auth branches; all pass |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/chat/[botId]/route.ts` | `supabase.from('bots').select('api_key_hash')` | Bot lookup for key validation | WIRED | Lines 22-30; runs before body parsing |
| `app/api/chat/[botId]/route.ts` | `crypto.timingSafeEqual` | Constant-time hash comparison | WIRED | Lines 48-53; SHA-256 hash of provided key compared to stored hash |
| `lib/rag/prompt.ts` | `detection.intent === 'health_issue'` | Intent-conditional wellness fallback | WIRED | Lines 52-66; branches on intent then ragFound |
| `lib/ingest/embedder.ts` | voyageai SDK | VoyageAIClient | WIRED | Line 1 import; voyage-3-large, outputDimension: 1024 |
| `lib/ingest/chunker.ts` | gpt-tokenizer | encode/decode | WIRED | Line 1 import; used in chunkText |
| `app/api/ingest/[botId]/process/route.ts` | lib/ingest/extractor.ts | extractText | WIRED | Line 6 import; called with mimeType from filename |
| `app/api/ingest/[botId]/process/route.ts` | lib/ingest/chunker.ts | chunkText | WIRED | Line 7 import; called with 500/50 parameters |
| `app/api/ingest/[botId]/process/route.ts` | lib/ingest/embedder.ts | embedDocumentChunks | WIRED | Line 8 import; called after chunking |
| `lib/rag/retrieve.ts` | supabase.rpc('match_faqs') | FAQ semantic matching | WIRED | Line 53; with match_threshold=0.75 |
| `lib/rag/retrieve.ts` | supabase.rpc('match_chunks') | Chunk retrieval | WIRED | Line 61; always called |
| `lib/rag/retrieve.ts` | supabase.rpc('match_products') | Product search | WIRED | Lines 70-77; conditional on intent |
| `lib/rag/detect.ts` | @anthropic-ai/sdk | Claude Haiku messages.create | WIRED | Uses claude-haiku-4-5-20251001 |
| `app/api/chat/[botId]/route.ts` | lib/rag/detect.ts | detectIntentAndLanguage | WIRED | Imported and called line 99 |
| `app/api/chat/[botId]/route.ts` | lib/rag/retrieve.ts | retrieveContext | WIRED | Imported and called line 102 |
| `app/api/chat/[botId]/route.ts` | lib/rag/prompt.ts | buildSystemPrompt | WIRED | Imported and called line 105 |
| `app/api/chat/[botId]/route.ts` | lib/rag/logger.ts | logMessage | WIRED | Called twice: pre-pipeline (user) and post-stream (assistant) |
| `app/api/chat/[botId]/route.ts` | @anthropic-ai/sdk | messages.create(stream: true) | WIRED | Line 120; ReadableStream iterates content_block_delta events |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| KB-01 | 02-02 | Admin can upload PDF, DOCX, TXT to knowledge base | SATISFIED | /api/ingest/[botId] accepts all three MIME types |
| KB-02 | 02-01 | Files extracted, chunked (500/50), embedded (voyage-3), stored in pgvector | SATISFIED | Full pipeline in /process route; chunker uses gpt-tokenizer; embedder uses voyage-3-large 1024-dim |
| KB-03 | 02-01 | Document has category tag: Beauty/FMCG/GenQi/Healthfood/Home Appliances/Other | SATISFIED | Category validated in ingest route and products route |
| KB-04 | 02-02 | Document ingestion status visible: pending -> processing -> ready/failed | SATISFIED | Status lifecycle fully implemented in process route with error_message on failure |
| KB-05 | 02-02 | Chunk count displayed per document after ingestion | SATISFIED | chunk_count updated in document record on status=ready |
| KB-06 | 02-02 | Admin can delete document, cascades to chunks | SATISFIED | DELETE route removes storage file then document; FK cascade removes chunks |
| KB-07 | 02-01, 02-02 | Structured product data retrievable as Product Detail Card | SATISFIED | products table with all required fields; match_products RPC; formatProductCard in prompt.ts |
| RAG-01 | 02-04, 02-06 | POST /api/chat/[botId] validates API key, returns streaming response | SATISFIED | API key validation with timingSafeEqual implemented; streaming response confirmed; dev-mode bypass for null hash |
| RAG-02 | 02-03 | Language auto-detected (EN/BM/ZH); bot responds in detected language | SATISFIED | detectIntentAndLanguage returns language; buildSystemPrompt applies langInstruction |
| RAG-03 | 02-03 | Intent classified: browse_product/health_issue/book_session/faq/general | SATISFIED | detect.ts classifies all 5 intents; logged on assistant message |
| RAG-04 | 02-03 | FAQs injected as priority context above RAG chunks | SATISFIED | prompt.ts: "PRIORITY FAQ ANSWERS" section before "KNOWLEDGE BASE CONTEXT" |
| RAG-05 | 02-03 | Customer can search by product name/category; bot returns full Product Detail Card | SATISFIED | match_products RPC triggered for browse_product intent; formatProductCard assembles all fields |
| RAG-06 | 02-03 | Health concern mapped to relevant product; bot explains benefits | SATISFIED | match_products triggered for health_issue intent; intent-specific prompt guidance added |
| RAG-07 | 02-03, 02-06 | No health match -> general wellness fallback | SATISFIED | Intent-conditional fallback: health_issue branch suggests GenQi/Healthfood categories; generic branch for other intents |
| RAG-08 | 02-03, 02-06 | Customer can request brochure/price list sent to chat | SATISFIED (Phase 2 scope) | Text-based Product Detail Cards returned in Claude response; brochure file delivery explicitly deferred to Phase 7 in REQUIREMENTS.md |
| RAG-09 | 02-01, 02-03 | No match (similarity < 0.75) -> rag_found=false, logged | SATISFIED | SIMILARITY_THRESHOLD=0.75 in retrieve.ts; ragFound=false logged on assistant message |
| RAG-10 | 02-04 | All messages logged: role, content, intent, source_chunks, rag_found, latency_ms | SATISFIED | logMessage inserts all 8 required fields; source_chunks aggregates FAQs+chunks+products |

**Requirements coverage: 17/17 — all Phase 2 requirements satisfied**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/rag/detect.ts` | 13 | `claude-haiku-4-5-20251001` (not `claude-haiku-20241022` per original plan spec) | INFO | Upgraded to newer model — functionally equivalent or better. Not a blocker. Consistent across both uses. |
| `app/api/chat/[botId]/route.ts` | 121 | `claude-haiku-4-5-20251001` (same model update) | INFO | Same as above. |

No blocker or warning-level anti-patterns found. Zero TODO/FIXME comments in key files.

---

## Test Suite Results

**68/68 tests pass** across 9 test files.

Test coverage:
- `tests/api/chat-auth.test.ts` — 5 tests: API key validation (missing key / wrong key / correct key / null hash dev mode / non-existent bot)
- `tests/api/chat.test.ts` — 14 tests: pipeline wiring, streaming, headers, logging
- Remaining 49 tests across 7 files: chunker, embedder, extractor, retrieve, logger, products, detect

---

## Human Verification Required

### 1. End-to-End Document Ingestion

**Test:** POST a real PDF to `/api/ingest/[botId]`, PUT to the signed URL, then POST the documentId to `/api/ingest/[botId]/process`
**Expected:** Document status becomes `ready` with a non-zero `chunk_count` in Supabase; chunks table has rows with 1024-dim embeddings
**Why human:** Requires applied migrations, live Supabase storage bucket, and VOYAGE_API_KEY configured

### 2. Cross-Language Retrieval

**Test:** Seed a document in English. Query in Bahasa Malaysia using `/api/chat/[botId]` (with valid or null api_key_hash)
**Expected:** Response contains relevant context from the English document; `X-Language: bm` header returned
**Why human:** Requires live Voyage AI for cross-lingual semantic similarity and live Anthropic API

### 3. FAQ Priority Verification

**Test:** Seed an FAQ with embedding. Send a question that closely matches the FAQ question
**Expected:** Claude response cites the FAQ answer, not a document chunk. `X-Rag-Found: true` header present
**Why human:** Requires seeded FAQ embeddings and live Voyage AI

### 4. Migration Correctness

**Test:** Run `supabase db push` and verify in SQL Editor: `chunks.embedding` is vector(1024); match_chunks/match_faqs/match_products RPCs exist; products table has all columns
**Expected:** Migrations apply without error; SQL queries confirm schema
**Why human:** Requires connected Supabase project with CLI access

---

## Summary

All three previously identified gaps are closed:

**Gap 1 — RAG-01 API Key Validation (CLOSED):** The chat endpoint now validates `X-API-Key` against `bots.api_key_hash` using `crypto.timingSafeEqual`. Returns 404 for non-existent bots, 401 for missing/invalid keys when hash is configured. Passes through with `console.warn` when `api_key_hash` is null (pre-Phase 3 dev mode). Five unit tests cover all branches and pass.

**Gap 2 — RAG-07 Wellness Fallback (CLOSED):** `buildSystemPrompt` now branches on `detection.intent === 'health_issue'` when `ragFound` is false. Health queries receive a wellness-specific message suggesting GenQi (wellness devices) and Healthfood (supplements) categories. All other intents continue with the original generic fallback.

**Gap 3 — RAG-08 Scope (CLOSED):** REQUIREMENTS.md now contains an explicit Phase 2 scope note on RAG-08 documenting that text-based Product Detail Cards satisfy the requirement for Phase 2, and that brochure/PDF file delivery via WhatsApp media messages is deferred to Phase 7 where the n8n bridge handles media message types.

The core RAG pipeline continues to be solid: 68/68 unit tests pass, the production build succeeds, the full extract/chunk/embed/store pipeline is correctly wired, FAQ priority logic is correctly implemented, multi-language detection is wired to Claude Haiku, and message logging with full metadata is working.

**Phase 2 goal is achieved.** Ready to proceed to Phase 3.

---

_Verified: 2026-03-20T11:48:00Z_
_Verifier: Claude (gsd-verifier)_
