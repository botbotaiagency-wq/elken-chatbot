---
phase: 02-rag-pipeline
plan: "06"
subsystem: chat-endpoint, prompt-assembly, requirements
tags: [api-key-validation, security, rag-fallback, wellness, requirements]
dependency_graph:
  requires: ["02-05"]
  provides: ["Phase 2 gap closure — API key validation + wellness fallback + RAG-08 scope note"]
  affects: ["app/api/chat/[botId]/route.ts", "lib/rag/prompt.ts", ".planning/REQUIREMENTS.md"]
tech_stack:
  added: []
  patterns:
    - "crypto.timingSafeEqual for constant-time API key comparison"
    - "SHA-256 hashing of incoming API key for comparison against stored hash"
    - "Dev-mode bypass: null api_key_hash allows through with console.warn"
    - "Intent-conditional fallback in prompt assembly (health_issue vs generic)"
key_files:
  created:
    - tests/api/chat-auth.test.ts
  modified:
    - app/api/chat/[botId]/route.ts
    - lib/rag/prompt.ts
    - .planning/REQUIREMENTS.md
    - tests/api/chat.test.ts
decisions:
  - "API key validation placed before body parsing — bot existence check fails fast with 404 before any request processing"
  - "null api_key_hash treated as dev-mode bypass (not rejection) so Phase 1/2 bots continue working pre-Phase 3"
  - "Wellness fallback references GenQi and Healthfood by name — matches actual Elken product categories"
metrics:
  duration: "3m 19s"
  completed_date: "2026-03-20"
  tasks_completed: 3
  files_changed: 5
---

# Phase 2 Plan 06: Gap Closure — API Key Validation, Wellness Fallback, RAG-08 Scope Summary

**One-liner:** API key validation with SHA-256 constant-time comparison + wellness-specific GenQi/Healthfood fallback + RAG-08 Phase 7 deferral note, closing all three Phase 2 verification gaps.

## What Was Built

Closed three verification gaps identified in Phase 2 VERIFICATION.md before moving to Phase 3:

1. **API key validation (BLOCKER)** — Chat endpoint now validates `X-API-Key` header against `bots.api_key_hash` using `crypto.timingSafeEqual`. Returns 404 for non-existent bots, 401 for missing/invalid keys when hash is configured. Bypasses with `console.warn` when `api_key_hash` is null (pre-Phase 3 dev mode).

2. **Wellness fallback (PARTIAL)** — Prompt assembly now branches on `detection.intent === 'health_issue'` when `ragFound` is false. Health queries get a wellness-specific message suggesting GenQi and Healthfood categories. All other intents continue with the original generic fallback.

3. **RAG-08 scope note (DEFERRED)** — REQUIREMENTS.md clarifies that text-based Product Detail Cards satisfy Phase 2. Brochure/PDF file attachment and WhatsApp media message delivery are explicitly deferred to Phase 7 where the n8n bridge handles media message types.

## Task Breakdown

### Task 1: Add API key validation to chat endpoint
- **Commit:** `54a506b`
- **Files:** `app/api/chat/[botId]/route.ts`, `tests/api/chat-auth.test.ts`, `tests/api/chat.test.ts`
- **Approach:** Added `crypto` and `createServiceClient` imports. Validation block runs immediately after `await params` — before body parsing. Supabase lookup fetches `id, api_key_hash` for the bot. If hash is set, incoming key is SHA-256 hashed and compared with `timingSafeEqual`. Buffer length mismatch short-circuits before the comparison.
- **Tests:** 5 new test cases in `chat-auth.test.ts`; existing 14 `chat.test.ts` tests updated with supabase mock returning `api_key_hash: null`.

### Task 2: Add wellness-specific fallback for health_issue intent
- **Commit:** `af74e7a`
- **Files:** `lib/rag/prompt.ts`
- **Approach:** Replaced single-branch fallback block with intent-conditional: `health_issue` branch pushes a wellness message naming GenQi and Healthfood categories; else branch preserves original generic fallback. Build passes.

### Task 3: Add RAG-08 scope clarification to REQUIREMENTS.md
- **Commit:** `d258ca6`
- **Files:** `.planning/REQUIREMENTS.md`
- **Approach:** Added indented `> **Phase 2 scope:**` note below the RAG-08 line explaining the text vs brochure split and Phase 7 deferral.

## Verification Results

- `npx vitest run --reporter=verbose` — **68/68 tests pass** (was 63, +5 new auth tests)
- `npm run build` — no TypeScript errors, build succeeds
- `grep "timingSafeEqual" app/api/chat/[botId]/route.ts` — present (1 match)
- `grep "GenQi" lib/rag/prompt.ts` — present (1 match)
- `grep "Phase 2 scope" .planning/REQUIREMENTS.md` — present (1 match)
- No remaining TODO comments for API key validation in chat endpoint

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Updated existing chat.test.ts with supabase mock**

- **Found during:** Task 1
- **Issue:** The existing `chat.test.ts` tests call the POST route which now invokes `createServiceClient()` before processing the request body. Without a supabase mock, those 14 tests would fail with a real Supabase connection attempt.
- **Fix:** Added `mockSupabaseSelect` via `vi.hoisted()` and `vi.mock('@/lib/supabase/service')` to `chat.test.ts`. Added `mockSupabaseSelect.mockResolvedValue({ data: { id: 'bot-123', api_key_hash: null }, error: null })` in `beforeEach` to simulate a dev-mode bot.
- **Files modified:** `tests/api/chat.test.ts`
- **Commit:** `54a506b` (included in Task 1 commit)

## Self-Check: PASSED

All created/modified files exist on disk. All task commits verified in git log.

| Check | Result |
|-------|--------|
| `app/api/chat/[botId]/route.ts` exists | FOUND |
| `lib/rag/prompt.ts` exists | FOUND |
| `.planning/REQUIREMENTS.md` exists | FOUND |
| `tests/api/chat-auth.test.ts` exists | FOUND |
| Commit `54a506b` (Task 1) | FOUND |
| Commit `af74e7a` (Task 2) | FOUND |
| Commit `d258ca6` (Task 3) | FOUND |
