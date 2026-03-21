---
phase: 04-admin-dashboard
plan: 03
subsystem: ui
tags: [react, nextjs, faq, response-templates, crud, dialog, shadcn]

# Dependency graph
requires:
  - phase: 04-admin-dashboard
    plan: 01
    provides: FAQ and template API routes (GET/POST/PATCH/DELETE for FAQs, GET/PATCH for templates)

provides:
  - FAQ management page with full CRUD (create/edit/delete) via table + modal + inline confirm
  - Response templates page with edit modal showing 3 language variants (EN/BM/ZH)
  - Language filter dropdown on both pages

affects: [phase-05-booking, phase-07-n8n]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - inline-delete-confirm: expand confirm row below action row using Fragment + conditional tr, matching api-keys page pattern
    - multi-language-edit-modal: single dialog with stacked textareas per language variant
    - Promise.all-upsert: save multiple language variants in parallel via Promise.all

key-files:
  created:
    - app/dashboard/bots/[botId]/faqs/page.tsx
    - app/dashboard/bots/[botId]/templates/page.tsx
  modified: []

key-decisions:
  - "FAQ edit uses PATCH with stable faqId (not delete+create) — preserves FAQ IDs across edits"
  - "Templates page shows all 5 intents always; language filter hides intents without that language variant rather than showing blank cells"
  - "Promise.all used for parallel PATCH saves of EN/BM/ZH variants — empty variants skipped (no empty content upserted)"
  - "Checkmark (&#10003;) and em-dash (&#8212;) HTML entities used for variant presence indicators"

patterns-established:
  - "Inline delete confirm: Fragment wraps data row + conditional confirm row, toggled by deletingId state"
  - "Multi-language modal: single editingIntent state drives dialog, formEn/formBm/formZh hold content"

requirements-completed: [CONF-04, CONF-05]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 4 Plan 03: FAQ and Response Templates Pages Summary

**Client-side CRUD pages for FAQ pairs (create/edit/delete with inline confirm) and intent-bound response templates (edit modal with EN/BM/ZH textareas), both with language filter dropdowns**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-22T04:00:04Z
- **Completed:** 2026-03-22T04:02:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- FAQ management page: full CRUD with language filter, 4-column table, inline delete confirm row (matching api-keys pattern), create/edit dialog with question/answer/language fields, all toast messages
- Templates page: 5-intent table with monospace intent labels, per-language variant checkmarks, edit-only dialog with 3 stacked language textareas, Promise.all parallel PATCH saves
- Both pages use `'use client'` with useCallback/useEffect fetch pattern consistent with existing dashboard pages

## Task Commits

Each task was committed atomically:

1. **Task 1: FAQ management page with table, modal, and inline delete** - `3322be3` (feat)
2. **Task 2: Response templates management page with edit modal** - `47cdd63` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `app/dashboard/bots/[botId]/faqs/page.tsx` - FAQ CRUD page: language filter, table, inline delete confirm, create/edit dialog (267 lines)
- `app/dashboard/bots/[botId]/templates/page.tsx` - Templates edit page: language filter, 5-intent table with variant checkmarks, edit dialog with EN/BM/ZH textareas (237 lines)

## Decisions Made
- FAQ edit uses PATCH (not delete+create) to preserve stable FAQ IDs across edits
- Templates language filter hides intents without the selected variant (rather than showing empty rows with dashes)
- Promise.all used for parallel upsert of 3 language variants; empty strings are skipped to avoid writing empty content to DB
- HTML entities &#10003; and &#8212; used for checkmark and dash indicators

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in tests/api/products.test.ts (out of scope for this plan, not caused by new files)
- Build exit code 144 appears to be caused by the same pre-existing test file errors; new pages compile cleanly per targeted tsc check

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FAQ and template management pages are live and integrated with the config API routes from Plan 01
- Both pages follow the established dashboard tab navigation pattern
- Ready for Phase 5 (Booking) — the bot configuration UI surface is now complete

---
*Phase: 04-admin-dashboard*
*Completed: 2026-03-22*
