---
phase: 02-rag-pipeline
plan: 03
subsystem: rag-retrieval
tags: [rag, retrieval, intent-detection, prompt-assembly, tdd]
dependency_graph:
  requires: [02-01]
  provides: [lib/rag/detect.ts, lib/rag/retrieve.ts, lib/rag/prompt.ts]
  affects: [03-chat-api]
tech_stack:
  added: []
  patterns: [tdd-vitest, vi-hoisted-mocks, claude-haiku-classification, rpc-semantic-search]
key_files:
  created:
    - lib/rag/detect.ts
    - lib/rag/retrieve.ts
    - lib/rag/prompt.ts
    - tests/lib/detect.test.ts
    - tests/lib/retrieve.test.ts
  modified: []
decisions:
  - "Claude Haiku (claude-haiku-20241022) used for intent/language classification — fast, cheap, fits within 100 token max_tokens"
  - "Products queried only for browse_product and health_issue intents — avoids unnecessary RPC calls for faq/general/book_session"
  - "Invalid language/intent from Claude normalized to en/general defaults — resilient to Claude returning unexpected values"
  - "FAQ results injected ABOVE RAG chunks in system prompt per RAG-04 priority requirement"
metrics:
  duration: "7min"
  completed: "2026-03-19T10:44:05Z"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 02 Plan 03: RAG Retrieval Library Summary

**One-liner:** RAG read-path library — intent/language detection via Claude Haiku, FAQ-priority retrieval via match_faqs/match_chunks/match_products RPCs, and structured system prompt assembly with product detail cards.

## What Was Built

Three library modules forming the complete RAG read-path for the chatbot:

1. **lib/rag/detect.ts** — `detectIntentAndLanguage(message)` calls Claude Haiku with a structured classifier prompt, parses the JSON response, and normalizes invalid language/intent values to safe defaults (en/general). Supports en/bm/zh languages and browse_product/health_issue/book_session/faq/general intents.

2. **lib/rag/retrieve.ts** — `retrieveContext(query, botId, intent)` orchestrates three Supabase RPC calls:
   - `match_faqs` — always called first (priority, threshold 0.75, top 3)
   - `match_chunks` — always called (threshold 0.75, top 5)
   - `match_products` — called only for browse_product and health_issue intents (threshold 0.75, top 3)
   - Returns `{ faqs, chunks, products, ragFound }` where `ragFound` is true when any array is non-empty

3. **lib/rag/prompt.ts** — `buildSystemPrompt(ctx)` assembles a structured system prompt with:
   - Language-aware response instruction (en/bm/zh)
   - FAQ priority section above RAG chunks
   - Product detail cards (name, description, key_ingredients, health_benefits, pricing, suggested_usage)
   - Knowledge base chunk context
   - Fallback messaging when ragFound is false
   - Intent-specific guidance for health_issue, browse_product, and book_session

## Test Coverage

- **tests/lib/detect.test.ts** — 7 tests: English/BM classification, Haiku model verification, invalid JSON fallback, whitespace handling, language normalization, intent normalization
- **tests/lib/retrieve.test.ts** — 10 tests: empty results, FAQ/chunk/product retrieval, full product fields, health_issue intent, intent-based product filtering (general/faq skip match_products), ragFound flag behavior, RPC parameter verification

All 42 tests across 6 test files pass.

## Decisions Made

1. **Claude Haiku for classification** — claude-haiku-20241022 is the fastest/cheapest Anthropic model; 100 max_tokens is sufficient for a small JSON classification response.

2. **Product search is intent-gated** — match_products is only called for browse_product and health_issue intents. For faq/general/book_session, products are irrelevant and the RPC call is skipped.

3. **Invalid Claude output → normalize, not throw** — If Claude returns non-JSON or invalid language/intent values, defaults (en/general) are used silently. This keeps the chatbot functional even if classification degrades.

4. **FAQ injected above chunks** — The system prompt places PRIORITY FAQ ANSWERS before KNOWLEDGE BASE CONTEXT to ensure Claude uses direct FAQ answers preferentially over document-derived context.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- FOUND: lib/rag/detect.ts
- FOUND: lib/rag/retrieve.ts
- FOUND: lib/rag/prompt.ts
- FOUND: tests/lib/detect.test.ts
- FOUND: tests/lib/retrieve.test.ts

Commits exist:
- FOUND: 4b655fb (feat(02-03): implement intent/language detection and RAG retrieval orchestration)
- FOUND: 852c570 (feat(02-03): implement system prompt assembly module)
