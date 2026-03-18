# Phase 1: Data Foundation - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Initialize the Next.js 14 application with full dependency setup, then create the Supabase database schema (migrations), RLS policies, HNSW pgvector index, and Supabase Auth configuration — so every subsequent phase has a working project structure to drop into and every DB query is bot-scoped and tenant-isolated by default.

</domain>

<decisions>
## Implementation Decisions

### Project Scaffolding
- Phase 1 creates the full Next.js 14 App Router project: `create-next-app`, TypeScript, Tailwind CSS, shadcn/ui, Supabase client (`@supabase/ssr`)
- Phase 1 also scaffolds the `app/dashboard/...` routing skeleton with route groups and placeholder pages so every subsequent phase knows exactly where to add files
- Supabase project will be created by the user before execution — Phase 1 just wires `.env.local` and runs migrations
- Phase 1 does NOT include public-facing pages (login page shell is fine; full auth UI is Phase 4)

### Auth & Role Model
- Super-admin vs tenant-admin distinction stored as JWT custom claims via a Supabase database hook on `auth.users` (standard Supabase pattern — no extra lookup per request)
- Claims to set: `role` (`super_admin` | `tenant_admin`) and `tenant_id` (null for super-admin Navien)
- No public signup — Navien creates all tenant admin accounts manually (Supabase dashboard or super-admin invite flow)
- RLS policies on client-facing queries read from JWT claims
- Server-side API routes (RAG, webhooks) use the **service role key** + app-level `bot_id` filter — not the user JWT; stateless webhook calls from n8n don't carry user sessions

### Multi-Tenancy Schema Shape
- `tenants` → `bots` is **one-to-many** (a tenant can have multiple bots)
- Every scoped table hangs off `bot_id` FK (not `tenant_id`) — bot_id is the universal isolation key
- `profiles` table: joins `auth.users` to `tenant_id` FK; super-admin Navien has `tenant_id = null`
- One tenant per admin (no many-to-many join table — agency/reseller deferred to v2)
- `bots` table includes a `feature_flags jsonb` column from Phase 1 (e.g. `{ booking_enabled: true }`) — Phase 5 reads/writes it without needing a new migration

### Claude's Discretion
- Exact HNSW index parameters (`m`, `ef_construction`) — use sensible defaults for 1536-dim embeddings
- Migration tooling choice — Supabase CLI migrations (`supabase/migrations/`) is the obvious fit
- Specific RLS policy SQL syntax and helper functions
- Exact `profiles` table columns beyond tenant_id and role

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authentication & Multi-Tenancy Requirements
- `.planning/REQUIREMENTS.md` §Authentication & Multi-Tenancy (AUTH-01 through AUTH-05) — exact acceptance criteria for login, session scoping, super-admin access, RLS enforcement, and tenant onboarding
- `.planning/PROJECT.md` §Constraints — locked tech stack (Next.js 14, TypeScript, Tailwind, shadcn/ui, Supabase), hosting (Vercel), and out-of-scope items
- `.planning/PROJECT.md` §Key Decisions — architectural decisions already locked (ingestion in Next.js routes, pgvector over Pinecone, booking state machine via `conversation.metadata` jsonb)

### Phase Goal
- `.planning/ROADMAP.md` §Phase 1 — success criteria (5 items) that verification will test against

No external specs or ADRs yet — all requirements are captured in the planning documents above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the patterns every subsequent phase follows:
  - Next.js App Router with `app/` directory
  - Supabase client via `@supabase/ssr` (server + browser clients)
  - Tailwind + shadcn/ui for all UI components
  - Service role client for API routes, anon/user client for browser sessions

### Integration Points
- `supabase/migrations/` → Supabase CLI picks these up for `supabase db push`
- `app/dashboard/` → all Phase 4+ dashboard pages land here
- `.env.local` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

</code_context>

<specifics>
## Specific Ideas

- Navien = super-admin; `tenant_id = null` in profiles is the sentinel for super-admin identity
- The `feature_flags` jsonb on `bots` will start as `{}` for non-Elken tenants; the Elken seed script (Phase 7) sets `{ booking_enabled: true }`
- All bots in the system must pass a two-tenant isolation test before Phase 1 is considered complete (success criteria #3 in ROADMAP.md)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-data-foundation*
*Context gathered: 2026-03-18*
