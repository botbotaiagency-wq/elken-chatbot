---
phase: 02-rag-pipeline
plan: 04
subsystem: api
tags: [anthropic, streaming, readablestream, supabase, rag, chat, logging]

# Dependency graph
requires:
  - phase: 02-rag-pipeline/02-01
    provides: "detectIntentAndLanguage — intent and language classification"
  - phase: 02-rag-pipeline/02-02
    provides: "retrieveContext — FAQ + chunk + product RAG retrieval"
  - phase: 02-rag-pipeline/02-03
    provides: "buildSystemPrompt — FAQ-priority prompt assembly"
  - phase: 01-data-foundation
    provides: "Supabase schema: conversations + messages tables"
provides:
  - "POST /api/chat/[botId] — streaming RAG chat endpoint wiring all pipeline components"
  - "lib/rag/logger.ts — logMessage and getOrCreateConversation utilities"
  - "Full message logging: role, content, intent, source_chunks, rag_found, latency_ms"
affects: [03-api-management, 07-n8n-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ReadableStream for Claude SSE streaming — text_delta events piped to response"
    - "Two-phase message logging: user message before processing, assistant after stream"
    - "params: Promise<{botId}> for Next.js 16 dynamic route handler signature"

key-files:
  created:
    - app/api/chat/[botId]/route.ts
    - lib/rag/logger.ts
    - tests/lib/logger.test.ts
    - tests/api/chat.test.ts
  modified: []

key-decisions:
  - "User message logged before pipeline processing (with null intent/rag fields) so every inbound message is captured even if processing fails"
  - "Assistant message logged after stream closes (latencyMs = full end-to-end duration from request start)"
  - "X-Conversation-Id response header returned so clients can continue multi-turn conversations"
  - "source_chunks aggregates FAQs + chunks + products for full retrieval traceability in RAG-10 logging"
  - "params typed as Promise<{botId}> (Next.js 16 requirement) — await params before use"

patterns-established:
  - "ReadableStream pattern: async start(controller) iterates SSE events, controller.close() triggers post-stream async work"
  - "getOrCreateConversation: verify-then-create pattern — checks bot_id ownership before returning existing conversation"

requirements-completed: [RAG-01, RAG-10]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 2 Plan 4: RAG Chat Endpoint Summary

**Streaming RAG chat endpoint using ReadableStream + Anthropic SDK, logging both user and assistant messages with full intent/source_chunks/latency metadata via Supabase.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T10:46:14Z
- **Completed:** 2026-03-19T10:50:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Message logger module (`logMessage`, `getOrCreateConversation`) with full RAG metadata fields
- POST /api/chat/[botId] wires intent detection, retrieval, prompt assembly, Claude streaming, and logging into one endpoint
- ReadableStream pipes Claude text_delta events to the client while accumulating full response for post-stream logging
- Response headers expose conversation ID, intent, language, and RAG-found status for client use
- 21 unit tests across 2 test files (7 logger, 14 chat API) — all passing; full suite 63/63

## Task Commits

Each task was committed atomically:

1. **Task 1: Create message logger module** - `9fd934e` (feat)
2. **Task 2: Create streaming RAG chat endpoint** - `a56cde1` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `lib/rag/logger.ts` - logMessage (inserts messages row) + getOrCreateConversation (verify-or-create)
- `app/api/chat/[botId]/route.ts` - Full RAG pipeline endpoint with streaming response
- `tests/lib/logger.test.ts` - 7 unit tests for logger module
- `tests/api/chat.test.ts` - 14 unit tests for chat endpoint

## Decisions Made
- User message logged before pipeline processing (null intent/rag) so every inbound is captured even on downstream failure
- Assistant message logged after `controller.close()` — latency captures full end-to-end duration
- `X-Conversation-Id` header returned to client for multi-turn conversation continuation
- `source_chunks` aggregates all three retrieval types (FAQs, chunks, products) for complete RAG traceability per RAG-10
- `params: Promise<{botId}>` with `await params` to satisfy Next.js 16 route handler type signature

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Next.js 16 params type in route handler**
- **Found during:** Task 2 (TypeScript build check)
- **Issue:** Plan spec used `params: { botId: string }` but Next.js 16 requires `params: Promise<{ botId: string }>` — build failed with type incompatibility error
- **Fix:** Changed params type to `Promise<{ botId: string }>` and added `const { botId } = await params`; updated test `makeParams` to use `Promise.resolve({ botId })`
- **Files modified:** `app/api/chat/[botId]/route.ts`, `tests/api/chat.test.ts`
- **Verification:** `npm run build` passes; all 14 chat tests still pass
- **Committed in:** a56cde1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for correct TypeScript compilation under Next.js 16. No scope change.

## Issues Encountered
None beyond the params type deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full RAG pipeline complete (Plans 01-04): ingestion, detection, retrieval, prompt, chat endpoint
- Plan 05 will add the FAQ management API (CRUD + embedding)
- Phase 3 (API Management) will add X-API-Key authentication to this endpoint

---
*Phase: 02-rag-pipeline*
*Completed: 2026-03-19*
