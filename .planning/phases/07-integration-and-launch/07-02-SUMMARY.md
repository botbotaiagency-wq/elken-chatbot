---
phase: 07-integration-and-launch
plan: 02
subsystem: docs-and-scripts
tags: [smoke-test, n8n, verification, documentation, launch-readiness]
dependency_graph:
  requires: [07-01]
  provides: [smoke-test-script, manual-checklist, n8n-setup-guide]
  affects: []
tech_stack:
  added: []
  patterns: [bash-curl-smoke-test, n8n-http-request-webhook]
key_files:
  created:
    - scripts/smoke-test.sh
    - docs/manual-checklist.md
    - docs/n8n-setup.md
  modified: []
decisions:
  - Smoke test uses bash + curl (not vitest/node) — portable on macOS and CI without Node dependencies
  - Script reads SMOKE_TEST_URL with VERCEL_URL fallback from .env.local — zero-config for existing projects
  - --max-time 30 per curl call prevents hanging on streaming endpoint responses
  - Manual checklist includes idempotency test (Test 5) to verify seed script safety
  - n8n guide uses troubleshooting table format for quick operator reference
metrics:
  duration: 146s
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 7 Plan 02: Launch Readiness Toolkit Summary

Automated smoke test script (9 curl calls across 3 intents × 3 languages), manual WhatsApp verification checklist (5 test steps + sign-off), and complete n8n HTTP workflow setup guide for both WhatsApp and Telegram channels.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create smoke test script and manual checklist | 0e11c13 | scripts/smoke-test.sh, docs/manual-checklist.md |
| 2 | Create n8n setup guide | 0a64bc4 | docs/n8n-setup.md |

## What Was Built

### scripts/smoke-test.sh

Bash script that sends 9 curl POST calls to the deployed Vercel endpoint:

- **Intents:** product_enquiry, health_concern, booking_intent
- **Languages:** en, bm, zh (3 per intent = 9 total)
- **Reads** `SMOKE_TEST_URL` (with `VERCEL_URL` fallback) and `X_API_KEY` from `.env.local` or environment
- **Payload shape:** `{ message, userId, channel, conversationId }` with `X-API-Key` header — matches the n8n payload contract from integrations page
- **--max-time 30** on each call to handle streaming responses without hanging
- Exits code 1 if any call returns non-200; prints per-call PASS/FAIL and final summary
- Uses BOT_ID `6176aa27-ce33-4dbc-b478-407414f86cac`

### docs/manual-checklist.md

Markdown checklist for verifying the full WhatsApp → n8n → chat endpoint → reply flow:

- **Test 1:** Product enquiry in English — expects Elken product information
- **Test 2:** Health concern in Bahasa Malaysia — expects BM response with product recommendation
- **Test 3:** Booking intent in Chinese — expects booking flow entry with facility options
- **Test 4:** GenQi FAQ (operating hours) — verifies Monday–Sunday 10am–10pm and contact info
- **Test 5:** Seed idempotency — run seed twice, confirm FAQ count unchanged
- **Sign-off section** with checkboxes for all 5 tests, smoke test, and admin dashboard verification

### docs/n8n-setup.md

Step-by-step guide for n8n operators:

- **Section 1: Prerequisites** — n8n instance, messaging account, API key generation steps
- **Section 2: WhatsApp Workflow** — 5-step setup: trigger → HTTP Request → send response, with exact JSON body and `X-API-Key` header config
- **Section 3: Telegram Workflow** — mirrors WhatsApp with Telegram-specific nodes and `"channel": "telegram"`
- **Section 4: Streaming Responses** — explains that n8n HTTP Request node handles stream completion automatically; notes n8n Cloud timeout setting
- **Section 5: Testing** — n8n execution view, what to verify in HTTP Request output
- **Section 6: Troubleshooting** — table covering HTTP 401, 404, timeout, empty response, wrong language, booking flag

## Verification Results

```
scripts/smoke-test.sh exists and is executable       PASS
9 call_chat invocations in smoke-test.sh             PASS (10 grep hits = 9 calls + 1 function def)
docs/manual-checklist.md exists                      PASS
docs/manual-checklist.md contains WhatsApp           PASS (12 occurrences)
docs/manual-checklist.md contains n8n                PASS (5 occurrences)
docs/n8n-setup.md exists                             PASS
docs/n8n-setup.md contains HTTP Request              PASS (11 occurrences)
docs/n8n-setup.md contains X-API-Key                 PASS
docs/n8n-setup.md contains conversationId            PASS
docs/n8n-setup.md contains Telegram                  PASS
docs/n8n-setup.md contains WhatsApp                  PASS
docs/n8n-setup.md contains POST method               PASS
docs/n8n-setup.md contains /api/chat/                PASS
docs/n8n-setup.md contains channel: whatsapp         PASS
docs/n8n-setup.md contains channel: telegram         PASS
docs/n8n-setup.md contains streaming guidance        PASS
docs/n8n-setup.md contains HTTP 401 troubleshooting  PASS
docs/n8n-setup.md contains HTTP 404 troubleshooting  PASS
```

## Deviations from Plan

None - plan executed exactly as written.

Note: The note in the execution prompt indicated `docs/n8n-setup.md` may have been created by plan 07-01. It was not present in this worktree, so it was created here as specified in the plan.

## Self-Check: PASSED

- FOUND: scripts/smoke-test.sh
- FOUND: docs/manual-checklist.md
- FOUND: docs/n8n-setup.md
- FOUND commit: 0e11c13 (Task 1)
- FOUND commit: 0a64bc4 (Task 2)
