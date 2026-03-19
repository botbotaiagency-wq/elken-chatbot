---
phase: 02-rag-pipeline
plan: "01"
subsystem: rag-foundation
tags: [schema-migration, vitest, ingestion, embeddings, pgvector, tdd]
dependency_graph:
  requires: []
  provides:
    - vector(1024) schema (chunks, faqs, products tables)
    - match_chunks / match_faqs / match_products RPC functions
    - lib/ingest/chunker.ts — chunkText
    - lib/ingest/extractor.ts — extractPdf, extractDocx, extractTxt
    - lib/ingest/embedder.ts — embedDocumentChunks, embedQuery
    - vitest test infrastructure
  affects:
    - All subsequent Phase 2 plans (depend on correct vector dimensions and ingest libs)
tech_stack:
  added:
    - voyageai (VoyageAIClient)
    - pdf-parse v2 (PDFParse class-based API)
    - mammoth
    - papaparse
    - gpt-tokenizer
    - "@anthropic-ai/sdk"
    - vitest + @vitest/coverage-v8
  patterns:
    - TDD (RED → GREEN) for all three ingest modules
    - vi.hoisted for mock functions in vi.mock factories (vitest ESM hoisting requirement)
    - PDFParse class with { data: buffer } parameter (pdf-parse v2 API)
key_files:
  created:
    - supabase/migrations/00006_schema_fix_products.sql
    - supabase/migrations/00007_rag_functions.sql
    - vitest.config.ts
    - tests/setup.ts
    - lib/ingest/chunker.ts
    - lib/ingest/extractor.ts
    - lib/ingest/embedder.ts
    - tests/lib/chunker.test.ts
    - tests/lib/extractor.test.ts
    - tests/lib/embedder.test.ts
  modified:
    - types/database.ts (added Product, Conversation, Message, FAQ, ResponseTemplate, Intent, Language, DocumentCategory)
    - package.json (new dependencies)
decisions:
  - pdf-parse v2 uses class-based PDFParse({ data: buffer }) API instead of the old function-based pdfParse(buffer); updated extractor accordingly
  - vi.hoisted() required to expose mock functions to vi.mock factory closures in vitest ESM mode
  - Test text for "valid PDF" must exceed 100 characters to clear the scanned-PDF rejection threshold
metrics:
  duration: 8min
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_changed: 11
---

# Phase 2 Plan 01: Foundation — Schema, Test Infrastructure, Ingestion Libraries Summary

Schema migrations, vitest setup, and three core ingestion library modules (extractor, chunker, embedder) with 17 passing unit tests — the complete foundation for Phase 2 RAG pipeline.

## What Was Built

### Task 1: Dependencies, Vitest, Schema Migrations, TypeScript Types

Installed all Phase 2 production dependencies (voyageai, pdf-parse, mammoth, papaparse, gpt-tokenizer, @anthropic-ai/sdk) and dev dependencies (vitest, @vitest/coverage-v8).

Created `vitest.config.ts` with node environment, @ alias, and tests/setup.ts with mocked env vars.

Created two SQL migrations:
- `00006_schema_fix_products.sql`: Drops old HNSW index, alters `chunks.embedding` from `vector(1536)` to `vector(1024)`, recreates HNSW index, adds `faqs.embedding vector(1024)`, creates `products` table with full RLS policy (`products_tenant_isolation`), adds `storage_path` and `error_message` columns to `documents`.
- `00007_rag_functions.sql`: Creates `match_chunks`, `match_faqs`, and `match_products` RPC functions using cosine distance with bot_id isolation and configurable threshold/count parameters.

Updated `types/database.ts` to add all Phase 2 TypeScript interfaces: `Product`, `Conversation`, `Message`, `FAQ`, `ResponseTemplate`, and type aliases `Intent`, `Language`, `DocumentCategory`. Updated `Document` interface with `storage_path` and `error_message` fields.

### Task 2: Ingestion Libraries (TDD)

**lib/ingest/chunker.ts** — `chunkText(text, chunkSize=500, overlap=50)`: Uses gpt-tokenizer `encode`/`decode` for BPE token-accurate chunking with sliding window. Returns empty array for empty/whitespace input. Each chunk except the last has exactly `chunkSize` tokens.

**lib/ingest/extractor.ts** — Three extractors:
- `extractPdf(buffer)`: Uses pdf-parse v2 `PDFParse` class with `{ data: buffer }` parameter and `getText()`. Throws "Scanned PDFs are not supported" if extracted text is under 100 characters.
- `extractDocx(buffer)`: Uses mammoth `extractRawText({ buffer })`.
- `extractTxt(buffer)`: Buffer to UTF-8 string.
- `extractText(buffer, mimeType)`: Dispatch function for all three types.

**lib/ingest/embedder.ts** — Wraps `VoyageAIClient`:
- `embedDocumentChunks(texts)`: Batches in groups of 128, calls `voyage.embed` with `model: 'voyage-3-large'`, `inputType: 'document'`, `outputDimension: 1024`.
- `embedQuery(query)`: Single call with `inputType: 'query'`, `outputDimension: 1024`.

## Test Results

17 unit tests passing across chunker (5), extractor (5), embedder (5 + 2 empty-input guard):

```
Test Files  3 passed (3)
Tests       17 passed (17)
Duration    ~300ms
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pdf-parse v2 uses class-based API, not function call**
- **Found during:** Task 2 GREEN phase (TypeScript build error)
- **Issue:** Plan specified `import pdfParse from 'pdf-parse'` with `pdfParse(buffer)` call — this is the v1 API. The installed pdf-parse is v2 which exports `PDFParse` class with `new PDFParse({ data: buffer })` and `getText()` method.
- **Fix:** Updated `extractor.ts` to use `import { PDFParse } from 'pdf-parse'` and `new PDFParse({ data: buffer }).getText()`. Updated test mocks to match.
- **Files modified:** lib/ingest/extractor.ts, tests/lib/extractor.test.ts
- **Commits:** 3fb6f02

**2. [Rule 1 - Bug] vi.hoisted required for mock functions in vi.mock factories**
- **Found during:** Task 2 GREEN phase (test failures)
- **Issue:** Variables declared with `const mockEmbed = vi.fn()` before `vi.mock(...)` factories cannot be accessed inside those factories due to vitest's ESM hoisting. Tests failed with "Cannot access before initialization" / function not being called.
- **Fix:** Used `vi.hoisted(() => ({ mockFn: vi.fn() }))` to create mock functions that are available when `vi.mock` factory closures execute.
- **Files modified:** tests/lib/embedder.test.ts, tests/lib/extractor.test.ts
- **Commits:** 3fb6f02

**3. [Rule 1 - Bug] Test text for valid PDF was under 100 characters**
- **Found during:** Task 2 GREEN phase (test failure — correct behavior, wrong test expectation)
- **Issue:** Test expected `extractPdf` to succeed with 91-character text, but the 100-char threshold correctly rejected it.
- **Fix:** Updated test text to exceed 100 characters.
- **Files modified:** tests/lib/extractor.test.ts
- **Commits:** 3fb6f02

## Self-Check: PASSED
