---
phase: 02-rag-pipeline
plan: "02"
subsystem: ingestion-api
tags: [api-routes, document-lifecycle, storage, embeddings, csv-import, products]
dependency_graph:
  requires:
    - lib/ingest/extractor.ts (extractText)
    - lib/ingest/chunker.ts (chunkText)
    - lib/ingest/embedder.ts (embedDocumentChunks)
    - lib/supabase/service.ts (createServiceClient)
    - supabase/migrations/00006_schema_fix_products.sql (documents, products tables)
  provides:
    - POST /api/ingest/[botId] — document upload initiation with signed URL
    - POST /api/ingest/[botId]/process — extract/chunk/embed/store pipeline
    - GET /api/documents/[botId] — document listing
    - DELETE /api/documents/[botId]/[documentId] — document + chunk + storage deletion
    - GET /api/products/[botId] — product listing
    - POST /api/products/[botId] — single product creation with embedding
    - POST /api/products/[botId] (text/csv) — bulk product import
  affects:
    - Phase 2 Plans 03-05 (RAG retrieval, chat endpoint — depend on chunk/product data being present)
tech_stack:
  added:
    - scripts/patch-voyageai-esm.cjs (postinstall patch for voyageai ESM broken imports)
  patterns:
    - Next.js 16 App Router dynamic segments — params as Promise<{ botId: string }>
    - serverExternalPackages for voyageai/pdf-parse/mammoth (Turbopack external)
    - Status lifecycle: pending -> processing -> ready/failed with error_message
    - Supabase Storage createSignedUploadUrl for direct-to-storage client uploads
    - papaparse CSV parsing with header:true and per-row validation
    - Batch embedding via embedDocumentChunks for CSV import
key_files:
  created:
    - app/api/ingest/[botId]/route.ts
    - app/api/ingest/[botId]/process/route.ts
    - app/api/documents/[botId]/route.ts
    - app/api/documents/[botId]/[documentId]/route.ts
    - app/api/products/[botId]/route.ts
    - tests/api/products.test.ts
    - scripts/patch-voyageai-esm.cjs
  modified:
    - next.config.ts (added serverExternalPackages)
    - package.json (added postinstall script)
decisions:
  - voyageai@0.2.x ESM bundle ships broken directory imports (e.g. from "../api" with no extension) — Node 25 strict ESM rejects these; fixed via postinstall patch script and serverExternalPackages
  - Products are embedded at the products table level only (not chunks table) — chunks.document_id is NOT NULL so products cannot be inserted there; RAG for products uses match_products RPC
  - CSV import uses Content-Type text/csv to distinguish from JSON single-product POST on the same endpoint
metrics:
  duration: 13min
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_changed: 9
---

# Phase 2 Plan 02: Ingestion API Routes — Upload, Process, List, Delete, Products Summary

Five API route files covering the full document lifecycle (signed upload URL, extract/chunk/embed/store pipeline, listing, deletion) and product CRUD with CSV bulk import — all using Voyage AI embeddings for RAG retrieval.

## What Was Built

### Task 1: Document Upload, Process, List, and Delete API Routes

**app/api/ingest/[botId]/route.ts** — POST upload initiation:
- Validates `contentType` (pdf, docx, txt) and `category` (6 valid values, defaults to 'Other')
- Inserts document record with `status: 'pending'`
- Generates storage path `${botId}/${docId}/${filename}` and calls Supabase Storage `createSignedUploadUrl`
- Updates document with `storage_path` and returns `{ documentId, signedUrl, token, path }`
- `maxDuration = 60` for long-running uploads

**app/api/ingest/[botId]/process/route.ts** — POST processing pipeline:
- Verifies document ownership (`bot_id === params.botId`)
- Sets status to `processing`, then downloads file from Supabase Storage
- Determines MIME type from filename extension (.pdf/.docx/.txt)
- Extracts text via `extractText(buffer, mimeType)`
- Chunks via `chunkText(text, 500, 50)` — rejects if `chunks.length === 0` with `status: 'failed'`
- Embeds all chunks via `embedDocumentChunks(chunks)`
- Bulk inserts chunk rows `{ bot_id, document_id, content, embedding }`
- Updates document to `status: 'ready', chunk_count: chunks.length`
- Any exception in try/catch sets `status: 'failed', error_message: error.message`
- `maxDuration = 60` for pipeline runs

**app/api/documents/[botId]/route.ts** — GET listing:
- Queries documents filtered by `bot_id`, ordered `created_at DESC`
- Returns `id, filename, category, status, chunk_count, error_message, created_at`

**app/api/documents/[botId]/[documentId]/route.ts** — DELETE:
- Verifies ownership, removes file from Storage if `storage_path` exists
- Deletes document record — FK cascade removes all chunks automatically

### Task 2: Product CRUD and CSV Bulk Import

**app/api/products/[botId]/route.ts** — GET + POST:
- GET: Returns all products for a bot ordered by `name ASC`, excluding `embedding` column
- POST JSON: Validates `name` (required), composes product text from all fields, embeds via `embedDocumentChunks`, inserts with embedding
- POST CSV (`Content-Type: text/csv`): Parses via `Papa.parse` with `header: true, skipEmptyLines: true`, validates each row, batch embeds all valid rows, bulk inserts, returns `{ imported, errors }`

**tests/api/products.test.ts** — 8 tests:
- Validates name required for single create (missing + empty string)
- Creates product with embedding and correct default category fallback
- Parses 2-row CSV and returns correct import count
- Skips rows missing name and reports them in `errors[]`
- Returns 400 for empty CSV
- GET returns products without embedding field

## Test Results

25 unit tests passing (8 new + 17 from Plan 01):

```
Test Files  4 passed (4)
Tests       25 passed (25)
Duration    ~426ms
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] voyageai@0.2.x ESM bundle has broken directory imports incompatible with Node 25**
- **Found during:** Task 1 build verification (`npm run build`)
- **Issue:** `voyageai/dist/esm/extended/index.mjs` contains `export * from "../api"` — a directory import without file extension. Node 25's strict ESM resolver rejects directory imports (`ERR_UNSUPPORTED_DIR_IMPORT`). Next.js 16's "collecting page data" subprocess loads route modules via `import()`, triggering this failure. Multiple files in the ESM bundle had this issue.
- **Fix:** (a) Added `serverExternalPackages: ['voyageai', 'pdf-parse', 'mammoth']` to `next.config.ts` to exclude these packages from Turbopack bundling. (b) Created `scripts/patch-voyageai-esm.cjs` postinstall script that patches 4 ESM files in the voyageai package to add explicit `.mjs` extensions to all bare relative imports. (c) Added `"postinstall": "node scripts/patch-voyageai-esm.cjs"` to `package.json`. Applied patches directly to `node_modules` for immediate effect.
- **Files modified:** next.config.ts, package.json, scripts/patch-voyageai-esm.cjs (created)
- **Commit:** 88761f8

**2. [Rule 2 - Missing] Products cannot be inserted into chunks table**
- **Found during:** Task 2 implementation analysis
- **Issue:** Plan comment noted `chunks.document_id` is NOT NULL — products don't have a parent document. The plan clarified this means RAG for products uses the `match_products` RPC (from Plan 01's migration 00007), not the chunks table. Products are stored in `products.embedding` only.
- **Fix:** Implemented products endpoint without inserting into chunks table. This is correct behavior per the DB schema.
- **Files modified:** app/api/products/[botId]/route.ts

## Self-Check: PASSED
