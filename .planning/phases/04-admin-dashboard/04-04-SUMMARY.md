---
phase: 04-admin-dashboard
plan: "04"
subsystem: ui
tags: [nextjs, streaming, rag, anthropic, supabase, testing-console]

# Dependency graph
requires:
  - phase: 04-02
    provides: Bot config columns in chat pipeline and updated chat route with language_override
  - phase: 02-rag-pipeline
    provides: detectIntentAndLanguage, retrieveContext, buildSystemPrompt, logMessage, getOrCreateConversation
provides:
  - Internal test-chat API route at /api/config/[botId]/test-chat (bypasses API key auth)
  - Debug API route at /api/config/[botId]/debug resolving source_chunks with content_preview and document_name
  - Streaming testing console UI at /dashboard/bots/[botId]/testing
affects: [05-booking, any phase that adds new RAG pipeline capabilities]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Internal admin endpoints under /api/config/[botId]/ bypass API key auth (protected by dashboard session instead)
    - Debug data fetched separately via GET after stream completes (not embedded in stream)
    - ReadableStream + TextDecoder pattern for client-side streaming consumption
    - Headers read before body consumption for immediate metadata access

key-files:
  created:
    - app/api/config/[botId]/test-chat/route.ts
    - app/api/config/[botId]/debug/route.ts
    - app/dashboard/bots/[botId]/testing/page.tsx
  modified: []

key-decisions:
  - "test-chat route intentionally duplicates chat route logic rather than extracting shared function — API key validation is woven through the chat route and extraction would be premature refactor"
  - "Debug data fetched after stream completes via separate GET (not embedded in stream) — keeps streaming protocol simple and debug as non-blocking enhancement"
  - "language_override applied after detection so intent classification uses original message language"

patterns-established:
  - "Pattern 1: Internal-only config routes under /api/config/[botId]/ bypass API key validation, relying on dashboard session auth instead"
  - "Pattern 2: debug endpoint joins chunks + documents!inner(filename) for single-query resolution of source chunk metadata"

requirements-completed: [TEST-01, TEST-02, TEST-03, TEST-04]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 04 Plan 04: Testing Console Summary

**Streaming WhatsApp-style testing console with RAG debug panel — admins can test bot responses, inspect intent/rag_found/latency/source chunks, override language, and reset sessions from the dashboard.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-22T04:45:34Z
- **Completed:** 2026-03-22T04:48:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Internal test-chat API route that runs the full RAG pipeline without API key auth
- Debug API route that resolves source_chunks with content preview (120 chars) and document filename via inner join
- Streaming chat UI with language override (Auto/EN/BM/ZH), reset conversation, typing indicator, expandable debug panel

## Task Commits

Each task was committed atomically:

1. **Task 1: Test-chat and debug API routes** - `360d3c2` (feat)
2. **Task 2: Streaming testing console UI page** - `766f42e` (feat)

## Files Created/Modified
- `app/api/config/[botId]/test-chat/route.ts` - Internal test chat endpoint bypassing API key validation; runs full RAG pipeline
- `app/api/config/[botId]/debug/route.ts` - Debug endpoint resolving last assistant message source_chunks with content_preview and document_name
- `app/dashboard/bots/[botId]/testing/page.tsx` - Streaming testing console with WhatsApp-style bubbles, language override, reset, debug panel

## Decisions Made
- test-chat intentionally duplicates chat route logic rather than extracting shared function (API key validation is woven through the original, extraction would be premature)
- Debug data fetched after stream completes via separate GET to keep streaming protocol clean
- language_override applied post-detection so intent still uses original message language

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Testing console is accessible at /dashboard/bots/[botId]/testing
- Full RAG pipeline exercised without needing an API key from the dashboard
- Debug panel surfaces all metadata needed for bot behavior troubleshooting
- Ready for Phase 5 (Booking state machine) — no blockers from this plan

---
*Phase: 04-admin-dashboard*
*Completed: 2026-03-22*

## Self-Check: PASSED
- FOUND: app/api/config/[botId]/test-chat/route.ts
- FOUND: app/api/config/[botId]/debug/route.ts
- FOUND: app/dashboard/bots/[botId]/testing/page.tsx
- FOUND: commit 360d3c2 (feat(04-04): add test-chat and debug API routes)
- FOUND: commit 766f42e (feat(04-04): add streaming testing console UI page)
