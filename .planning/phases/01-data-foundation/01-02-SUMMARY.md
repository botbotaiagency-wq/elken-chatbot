---
phase: 01-data-foundation
plan: 02
subsystem: database
tags: [supabase, postgres, rls, pgvector, pgtap, multi-tenancy, auth-hook]
dependency_graph:
  requires: []
  provides: [database-schema, rls-policies, vector-index, auth-hook, isolation-tests]
  affects: [all-phases]
tech_stack:
  added: [pgvector, pgtap]
  patterns: [row-level-security, jwt-claims, hnsw-index, custom-access-token-hook]
key_files:
  created:
    - supabase/migrations/00001_extensions.sql
    - supabase/migrations/00002_schema.sql
    - supabase/migrations/00003_rls.sql
    - supabase/migrations/00004_indexes.sql
    - supabase/migrations/00005_auth_hook.sql
    - supabase/tests/isolation.test.sql
    - supabase/seed.sql
  modified: []
decisions:
  - "bot_id is the universal isolation key: all content tables (documents, chunks, conversations, messages, faqs, response_templates) scope to bot_id, not tenant_id directly — allows per-bot data partitioning"
  - "RLS helper functions jwt_tenant_id() and is_super_admin() use security invoker (not definer) to prevent privilege escalation"
  - "supabase_auth_admin granted SELECT on profiles before RLS is applied — critical for auth hook to read user role/tenant without being blocked"
  - "HNSW index uses cosine distance operator (vector_cosine_ops) to match the <=> query operator used in RAG search"
metrics:
  duration_seconds: 110
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 7
  files_modified: 0
---

# Phase 1 Plan 02: Database Migrations and RLS Summary

**One-liner:** Multi-tenant Postgres schema with pgvector HNSW index, JWT-claim-based RLS on all 9 tables, custom_access_token_hook for role injection, and pgTAP isolation tests verifying two-tenant separation.

## What Was Built

### Migration Files (supabase/migrations/)

**00001_extensions.sql** — Enables `vector` (pgvector) and `pgtap` extensions in the `extensions` schema.

**00002_schema.sql** — Defines 9 tables in the public schema:
- `tenants` — top-level tenant registry with slug unique constraint
- `bots` — per-tenant bots with `feature_flags jsonb` for module flags
- `profiles` — auth.users extension with role (super_admin | tenant_admin) and tenant_id FK; auto-created via `handle_new_user` trigger
- `documents` — per-bot uploaded files with category and processing status
- `chunks` — text chunks with `extensions.vector(1536)` embedding column
- `conversations` — WhatsApp/Telegram/web sessions keyed by (bot_id, user_id, channel)
- `messages` — individual turns with intent, source_chunks, rag_found, latency_ms
- `faqs` — multilingual (en/bm/zh) Q&A pairs per bot
- `response_templates` — intent-keyed multilingual templates with unique (bot_id, intent_key, language)

**00003_rls.sql** — RLS enabled on all 9 tables:
- Helper functions `jwt_tenant_id()` and `is_super_admin()` read from JWT `app_metadata`
- Tenant-scoped tables (tenants, bots, profiles): direct tenant_id match
- Bot-scoped tables (documents, chunks, conversations, messages, faqs, response_templates): subquery join through bots table
- `supabase_auth_admin` granted SELECT on profiles to allow auth hook execution

**00004_indexes.sql** — Performance indexes:
- HNSW index on `chunks.embedding` with cosine distance operator, m=16, ef_construction=64
- Btree indexes on all FK columns used in RLS join subqueries (prevents sequential scans on every authenticated query)

**00005_auth_hook.sql** — Custom Access Token Hook:
- Reads role and tenant_id from profiles table for each token issuance
- Injects into JWT `app_metadata` so RLS policies can read them without a DB call
- Grants execution only to `supabase_auth_admin`; revokes from authenticated, anon, public

### Test and Seed Files

**supabase/tests/isolation.test.sql** — 8 pgTAP assertions:
- Tests 1-2: Tenant A admin sees exactly 1 bot (Bot A only)
- Tests 3-4: Tenant B admin sees exactly 1 bot (Bot B only)
- Tests 5-6: Tenant A cannot see Tenant B's documents (bot_id-scoped table)
- Tests 7-8: Super-admin sees all 2 bots and all 2 documents
- Runs in transaction with rollback (no state left after test run)

**supabase/seed.sql** — Deterministic test data with fixed UUIDs for reproducible local development and CI.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write all 5 database migration files | e633c4d | supabase/migrations/00001-00005 |
| 2 | Write pgTAP isolation tests and seed data | 33a1f0a | supabase/tests/isolation.test.sql, supabase/seed.sql |

## Deviations from Plan

None — plan executed exactly as written.

## Requirements Satisfied

- AUTH-02: Tenant admin scoped to own data (RLS bots_select policy + all bot_id-scoped table policies)
- AUTH-03: Super-admin bypasses all tenant restrictions (is_super_admin() in every policy)
- AUTH-04: RLS enforced at Postgres level — application code cannot bypass
- AUTH-05: Custom Access Token Hook injects role and tenant_id into JWT claims at token issuance

## Self-Check: PASSED

All 7 files confirmed present on disk. Both task commits (e633c4d, 33a1f0a) confirmed in git log.
