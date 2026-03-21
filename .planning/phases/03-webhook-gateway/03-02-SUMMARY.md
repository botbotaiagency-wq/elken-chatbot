---
phase: 03-webhook-gateway
plan: 02
subsystem: ui
tags: [shadcn, dialog, tabs, sonner, lucide-react, api-keys, integrations, next.js]

# Dependency graph
requires:
  - phase: 03-webhook-gateway-01
    provides: "POST/GET/DELETE /api/keys/[botId] endpoints and api_keys table"
provides:
  - "API Keys management page with generate, show-once modal, list, and inline revoke"
  - "Integrations page with webhook URL auto-population and n8n JSON snippets for WhatsApp/Telegram"
  - "shadcn dialog, tabs, sonner components installed"
affects: [03-webhook-gateway-03, future phases needing admin UI patterns]

# Tech tracking
tech-stack:
  added: [shadcn/ui dialog, shadcn/ui tabs, shadcn/ui sonner]
  patterns:
    - "Show-once modal: Dialog locked with onInteractOutside + onEscapeKeyDown preventDefault"
    - "Copy-to-clipboard: navigator.clipboard.writeText + 2s icon swap (Copy->Check)"
    - "Inline revoke confirmation: row expansion with optimistic UI + error recovery"
    - "Tab-based page: shadcn Tabs with defaultValue='whatsapp'"
    - "Webhook URL: window.location.origin + /api/chat/${botId} with SSR fallback"

key-files:
  created:
    - app/dashboard/bots/[botId]/api-keys/page.tsx
    - app/dashboard/bots/[botId]/integrations/page.tsx
    - components/ui/dialog.tsx
    - components/ui/tabs.tsx
    - components/ui/sonner.tsx
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Manual relative time calculation used instead of date-fns import (avoids extra dependency for simple formatting)"
  - "Toaster from sonner added directly to api-keys page (not dashboard layout) to avoid modifying shared layout"
  - "CopyButton extracted as sub-component in integrations page to avoid duplication across URL and snippet blocks"

patterns-established:
  - "Show-once modal pattern: Dialog with both onInteractOutside and onEscapeKeyDown prevented — only explicit dismiss button works"
  - "Copy-to-clipboard icon swap: local useState(false) per button, setTimeout 2000ms, no toast"
  - "Optimistic revoke: filter state immediately, on error restore prevKeys + show error toast"

requirements-completed: [API-01, API-02, API-03, API-05]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 3 Plan 02: API Keys UI and Integrations Page Summary

**shadcn Dialog show-once key reveal modal and tab-based n8n integrations page for self-service webhook setup without developer intervention**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-21T14:19:48Z
- **Completed:** 2026-03-21T14:23:01Z
- **Tasks:** 2 of 3 completed (Task 3 is checkpoint:human-verify — awaiting user)
- **Files modified:** 7

## Accomplishments
- Installed shadcn dialog, tabs, and sonner components
- Built full API key lifecycle UI: generate with labeled input, show-once modal (copy + forced dismiss), list with prefix badges and relative timestamps, inline revoke with optimistic update
- Built integrations page with tab-based WhatsApp/Telegram switcher, auto-populated webhook URL, and n8n JSON body snippets with copy buttons

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn components + API Keys management page** - `b439bc5` (feat)
2. **Task 2: Integrations page with webhook URL and n8n snippets** - `fb9cd8a` (feat)

_Task 3 is a checkpoint:human-verify — no commit (verification only)._

## Files Created/Modified
- `app/dashboard/bots/[botId]/api-keys/page.tsx` - API key management page (generate, show-once modal, list, revoke)
- `app/dashboard/bots/[botId]/integrations/page.tsx` - Integrations page (webhook URL + n8n snippets, WhatsApp/Telegram tabs)
- `components/ui/dialog.tsx` - shadcn Dialog component
- `components/ui/tabs.tsx` - shadcn Tabs component
- `components/ui/sonner.tsx` - shadcn Sonner toast component
- `package.json` / `package-lock.json` - Updated with new shadcn dependencies

## Decisions Made
- Manual relative time calculation used instead of date-fns — avoids extra dependency for a simple display feature with no localization requirement
- Toaster added to api-keys page directly rather than dashboard layout to avoid modifying shared layout during this plan
- CopyButton extracted as a reusable sub-component in integrations page to share icon-swap logic across URL and snippet copy buttons

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both pages build and route correctly at `/dashboard/bots/[botId]/api-keys` and `/dashboard/bots/[botId]/integrations`
- Awaiting visual verification from user (Task 3 checkpoint)
- After approval, Phase 3 Plan 02 is complete and Phase 3 Plan 03 (if any) can proceed

---
*Phase: 03-webhook-gateway*
*Completed: 2026-03-21*
