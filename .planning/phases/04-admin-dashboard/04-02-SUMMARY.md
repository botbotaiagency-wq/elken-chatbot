---
phase: 04-admin-dashboard
plan: 02
subsystem: admin-config-ui + chat-pipeline
tags: [personality, guardrails, system-prompt, bot-config, chat-route]
dependency_graph:
  requires: [04-01]
  provides: [personality-page, guardrails-page, dynamic-system-prompt]
  affects: [chat-pipeline, admin-dashboard-nav]
tech_stack:
  added: []
  patterns: [useEffect-load-on-mount, PATCH-save-with-toast, BotConfig-interface, language-override]
key_files:
  created:
    - app/dashboard/bots/[botId]/personality/page.tsx
    - app/dashboard/bots/[botId]/guardrails/page.tsx
  modified:
    - lib/rag/prompt.ts
    - app/api/chat/[botId]/route.ts
decisions:
  - "BotConfig interface uses optional nullable fields (string | null) matching DB column nullability"
  - "Guardrails injected into system prompt between tone and FAQ sections — guardrails before knowledge context"
  - "language_override applied after detection so intent classification still uses original message language"
  - "bot SELECT expanded to include all config columns — single query, no additional DB round-trip"
metrics:
  duration: 236s
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 4
---

# Phase 04 Plan 02: Personality & Guardrails Config UI + Chat Pipeline Wiring Summary

One-liner: Personality and guardrails admin forms with dynamic system prompt injection using BotConfig interface wired to existing bot SELECT query.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Personality and Guardrails config form pages | 58fff29 | personality/page.tsx, guardrails/page.tsx |
| 2 | Wire bot config into chat pipeline (dynamic system prompt) | f5c9602 | lib/rag/prompt.ts, app/api/chat/[botId]/route.ts |

## What Was Built

**Task 1 — Config form pages:**

Both pages follow the api-keys page pattern exactly:
- `personality/page.tsx`: loads name, 3 greeting textareas (EN/BM/ZH), native tone select (Professional/Friendly/Formal), fallback textarea — all fetched via GET on mount. Saves via PATCH with `toast.success('Bot configuration saved.')`.
- `guardrails/page.tsx`: loads blocked keywords (textarea + helper "One keyword per line..."), refuse message, disclaimer textarea (+ "Appended to every bot response" helper), max length number input (+ "Characters. Recommended: 500-1500" helper), off-topic deflection message. Saves via PATCH with `toast.success('Guardrails saved.')`.

**Task 2 — Chat pipeline wiring:**

- Added `BotConfig` interface (11 optional nullable fields) and `botConfig?: BotConfig` to `PromptContext` in `lib/rag/prompt.ts`.
- `buildSystemPrompt` now:
  1. Resolves bot name from `botConfig.name` with backward-compat fallback
  2. Resolves fallback message from `botConfig.fallback_message` with backward-compat fallback
  3. Extracts language-specific greeting (`greeting_en/bm/zh`) by detection language key
  4. Injects tone instruction using `botConfig.tone`
  5. Injects `--- BLOCKED TOPICS ---` section if `blocked_keywords` is non-empty
  6. Injects `--- MANDATORY DISCLAIMER ---` section if `disclaimer_text` set
  7. Injects max response length constraint if `max_response_length` set
  8. Injects off-topic deflection instruction if `off_topic_message` set
- Chat route `app/api/chat/[botId]/route.ts`:
  - Expanded single bot SELECT to include all 11 config columns — no extra DB query
  - Passes complete `botConfig` object to `buildSystemPrompt`
  - Added `language_override` to body destructuring; overrides `detection.language` when valid (`en`/`bm`/`zh`)

## Verification Results

- `npx next build`: passed (all 18 pages compiled)
- `npx vitest run`: 89/89 tests pass, 0 failures

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files created/modified:
- FOUND: app/dashboard/bots/[botId]/personality/page.tsx
- FOUND: app/dashboard/bots/[botId]/guardrails/page.tsx
- FOUND: lib/rag/prompt.ts (contains BotConfig, BLOCKED TOPICS, MANDATORY DISCLAIMER)
- FOUND: app/api/chat/[botId]/route.ts (contains botConfig, language_override)

Commits:
- FOUND: 58fff29 feat(04-02): add personality and guardrails config form pages
- FOUND: f5c9602 feat(04-02): wire bot config into chat pipeline with dynamic system prompt
