---
phase: 07-integration-and-launch
plan: 01
subsystem: seed-data
tags: [seed, n8n, integration, elken, genqi]
dependency_graph:
  requires: []
  provides: [scripts/seed-elken.mjs, docs/n8n-setup.md]
  affects: [scripts/seed-elken.mjs]
tech_stack:
  added: []
  patterns: [idempotent-upsert, bot-table-personality-columns]
key_files:
  created:
    - docs/n8n-setup.md
  modified:
    - scripts/seed-elken.mjs
decisions:
  - "Bot personality config (greetings, tone) is stored directly on bots table columns (greeting_en/bm/zh, tone) — not a separate bot_config table (confirmed via migration 00009)"
  - "FAQ insert is guarded by count check on bot_id to prevent duplicate rows on re-run (faqs table has no unique constraint)"
  - "Bot upsert uses ignoreDuplicates then a separate UPDATE for personality fields — upsert ignoreDuplicates skips the row on conflict so personality would never be applied on re-run without the separate UPDATE"
  - "Seed includes all 6 client response templates plus 5 existing templates (browse_product, health_issue, book_session, faq, general) — total 11 intent keys × 3 languages = 33 template rows"
metrics:
  duration: 270s
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_changed: 2
---

# Phase 7 Plan 1: Elken Seed Data and n8n Setup Guide Summary

Complete the Elken seed script with accurate GenQi location data, client-provided greetings, and all 6 response templates; create n8n integration guide.

## What Was Built

### Task 1: Complete Seed Script (SEED-01 through SEED-04)

`scripts/seed-elken.mjs` was rewritten in-place with:

- **Bot identity** (SEED-01): Updated bot name to `Ask Ethan Digital`; `feature_flags.booking_enabled: true` added
- **Personality config** (SEED-04): Exact trilingual greetings (EN/BM/ZH) from client seeded via `UPDATE` on `bots` table columns `greeting_en`, `greeting_bm`, `greeting_zh`, `tone: 'Friendly'`
- **GenQi FAQs** (SEED-02): 12 questions × 3 languages = 36 FAQ rows covering GenQi OKR hours/facilities/BES, GenQi Subang hours/facilities/BES, general visit rules, and Elken membership/products/support
- **Response templates** (SEED-03): 6 client-provided templates (`slot_full`, `booking_confirmed_member`, `booking_confirmed_nonmember`, `reminder_24h`, `post_survey`, `no_product_found`) × 3 languages = 18 new rows; existing 5 intent templates retained = 33 total
- **Idempotent**: FAQs guarded by count check; templates use `upsert` with `ignoreDuplicates: true`

### Task 2: n8n Setup Guide (D-09)

`docs/n8n-setup.md` created with:

- Separate WhatsApp and Telegram sections
- Step-by-step HTTP Request node configuration (method, URL, headers, body)
- Canonical payload shape table (`message`, `userId`, `channel`, `conversationId`)
- X-API-Key header setup
- Streaming response handling notes
- Direct curl test command
- Troubleshooting table covering 401, 404, empty response, wrong language, booking not triggering

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Separate UPDATE required for personality fields on existing bot**
- **Found during:** Task 1
- **Issue:** `upsert` with `ignoreDuplicates: true` skips the entire row on conflict — personality fields (greetings, tone) would never be applied if the bot row already exists
- **Fix:** Two-step approach: `upsert` with `ignoreDuplicates: true` for initial creation, then a separate `UPDATE` with `eq('id', BOT_ID)` that always runs to apply personality config
- **Files modified:** `scripts/seed-elken.mjs`
- **Commit:** df1ddd7

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `scripts/seed-elken.mjs` | Modified | Complete idempotent Elken seed (SEED-01 through SEED-04) |
| `docs/n8n-setup.md` | Created | Step-by-step n8n integration guide |

## Commits

| Hash | Message |
|------|---------|
| df1ddd7 | feat(07-01): complete Elken seed script with GenQi data, greetings, and templates |
| 0cab70d | feat(07-01): add n8n setup guide for WhatsApp and Telegram integration |

## Self-Check: PASSED

- FOUND: scripts/seed-elken.mjs
- FOUND: docs/n8n-setup.md
- FOUND: commit df1ddd7
- FOUND: commit 0cab70d
