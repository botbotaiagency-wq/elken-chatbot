---
phase: 03-webhook-gateway
plan: "01"
subsystem: api-keys
tags: [api-keys, authentication, database, migration, webhook]
dependency_graph:
  requires:
    - supabase/migrations/00002_schema.sql (bots table reference)
    - lib/supabase/service.ts (createServiceClient)
    - app/api/chat/[botId]/route.ts (extended validation block)
  provides:
    - supabase/migrations/00008_api_keys.sql
    - lib/api-keys/generate.ts (generateApiKey)
    - app/api/keys/[botId]/route.ts (GET/POST/DELETE)
    - Updated chat endpoint with api_keys table validation
  affects:
    - app/api/chat/[botId]/route.ts (validation logic extended)
    - tests/api/chat-auth.test.ts (mock updated to be table-aware)
tech_stack:
  added: []
  patterns:
    - "Soft-delete via revoked_at (no hard deletes on api_keys)"
    - "Fire-and-forget last_used_at update (not awaited)"
    - "timingSafeEqual with length guard for constant-time comparison"
    - "Table-aware Supabase mock pattern for multi-table routes"
key_files:
  created:
    - supabase/migrations/00008_api_keys.sql
    - lib/api-keys/generate.ts
    - app/api/keys/[botId]/route.ts
    - tests/api/keys.test.ts
  modified:
    - app/api/chat/[botId]/route.ts
    - tests/api/chat-auth.test.ts
decisions:
  - "API key format: ethan_live_ prefix + 24 hex chars (crypto.randomBytes(12))"
  - "api_keys table uses partial indexes (WHERE revoked_at IS NULL) for fast active-key lookups"
  - "Chat endpoint checks api_keys table first, then falls back to bots.api_key_hash — preserves Phase 1/2 dev-mode bypass"
  - "chat-auth.test.ts mock redesigned to be table-aware (.from() routes to different mock shapes per table)"
metrics:
  duration: "352s (~6 min)"
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 6
---

# Phase 3 Plan 01: API Key Infrastructure Summary

API key lifecycle backend using ethan_live_ prefixed keys, SHA-256 hashing, soft-delete revocation, and dual-path validation (api_keys table first, bots.api_key_hash fallback) with fire-and-forget last_used_at tracking.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Database migration + key generation helper + tests scaffold (TDD) | 9fba053 | 00008_api_keys.sql, lib/api-keys/generate.ts, app/api/keys/[botId]/route.ts, tests/api/keys.test.ts |
| 2 | API route for key lifecycle + update chat endpoint validation | e71796d | app/api/chat/[botId]/route.ts, tests/api/chat-auth.test.ts |

## Verification Results

- `npx vitest run tests/api/keys.test.ts` — 17/17 passed
- `npx vitest run tests/api/chat-auth.test.ts` — 9/9 passed
- `npx vitest run` — 89/89 passed (no regressions across 10 test files)
- `grep -r "key_hash" app/api/keys/[botId]/route.ts | grep "select("` — empty (key_hash never in GET response)
- `supabase/migrations/00008_api_keys.sql` exists with table, indexes, RLS

## Key Artifacts

**Migration (`supabase/migrations/00008_api_keys.sql`):**
- `api_keys` table with `id, bot_id, label, key_prefix, key_hash, last_used_at, created_at, revoked_at`
- Partial index on `(bot_id, key_hash) WHERE revoked_at IS NULL` for fast validation lookups
- Partial index on `(bot_id, revoked_at) WHERE revoked_at IS NULL` for fast listing
- RLS enabled — `tenant_admin_select_api_keys` policy restricts SELECT to own bot keys
- All mutations go through service role (bypasses RLS)

**Key Generation (`lib/api-keys/generate.ts`):**
- `generateApiKey()` returns `{ raw, hash, prefix }`
- `raw` matches `/^ethan_live_[0-9a-f]{24}$/` (35 chars total)
- `prefix` is `raw.slice(11, 19)` (8 chars for display)
- `hash` is SHA-256 hex (64 chars) — only this is stored

**API Routes (`app/api/keys/[botId]/route.ts`):**
- `POST`: validates label, revokes existing same-label key, inserts new key, returns plaintext key once only
- `GET`: returns `{ keys: [{ id, label, key_prefix, last_used_at, created_at }] }` — never exposes `key_hash`
- `DELETE`: soft-deletes via `revoked_at`, isolation guarded by `bot_id` check

**Chat Endpoint Update (`app/api/chat/[botId]/route.ts`):**
- Checks `api_keys` table first with `maybeSingle()` lookup
- On match: `timingSafeEqual` verification + fire-and-forget `last_used_at` update
- On no match: falls back to `bots.api_key_hash` (Phase 1/2 compatibility)
- Dev-mode bypass preserved when both `bots.api_key_hash` is null and no `api_keys` rows exist

## Deviations from Plan

**1. [Rule 2 - Auto-fix] Redesigned chat-auth.test.ts mock to be table-aware**
- **Found during:** Task 2
- **Issue:** Original mock used a single flat chain for all `.from()` calls. The updated chat route now calls `.from('bots')` (single) AND `.from('api_keys')` (maybeSingle + update) — incompatible shapes with the old mock.
- **Fix:** Replaced flat mock with a table-discriminating `from(table)` function that returns different chain shapes per table. `mockApiKeysUpdate` is the `.update()` function itself (receives the payload object), making the fire-and-forget assertion straightforward.
- **Files modified:** tests/api/chat-auth.test.ts
- **Commit:** e71796d

## Self-Check: PASSED

All files verified present. Both task commits confirmed in git history.
