# Phase 1: Data Foundation - Research

**Researched:** 2026-03-18
**Domain:** Supabase (Auth, RLS, pgvector), Next.js 14 App Router, Supabase CLI migrations
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Project Scaffolding
- Phase 1 creates the full Next.js 14 App Router project: `create-next-app`, TypeScript, Tailwind CSS, shadcn/ui, Supabase client (`@supabase/ssr`)
- Phase 1 also scaffolds the `app/dashboard/...` routing skeleton with route groups and placeholder pages so every subsequent phase knows exactly where to add files
- Supabase project will be created by the user before execution — Phase 1 just wires `.env.local` and runs migrations
- Phase 1 does NOT include public-facing pages (login page shell is fine; full auth UI is Phase 4)

#### Auth & Role Model
- Super-admin vs tenant-admin distinction stored as JWT custom claims via a Supabase database hook on `auth.users` (standard Supabase pattern — no extra lookup per request)
- Claims to set: `role` (`super_admin` | `tenant_admin`) and `tenant_id` (null for super-admin Navien)
- No public signup — Navien creates all tenant admin accounts manually (Supabase dashboard or super-admin invite flow)
- RLS policies on client-facing queries read from JWT claims
- Server-side API routes (RAG, webhooks) use the **service role key** + app-level `bot_id` filter — not the user JWT; stateless webhook calls from n8n don't carry user sessions

#### Multi-Tenancy Schema Shape
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can log in to the admin dashboard with email and password via Supabase Auth | Supabase Auth email/password is the default — no extra setup beyond enabling in dashboard. @supabase/ssr handles session cookies in Next.js. |
| AUTH-02 | Tenant admin session is scoped — admin sees only their own tenant's bots and data | Custom Access Token Hook injects `tenant_id` claim into JWT. RLS policies on all scoped tables use `(select auth.jwt()->'app_metadata'->>'tenant_id')::uuid`. |
| AUTH-03 | Super-admin (Navien) can view and manage all tenants and bots across the platform | `role = 'super_admin'` claim in JWT. RLS policies include `OR (select auth.jwt()->'app_metadata'->>'role') = 'super_admin'` bypass. `tenant_id = null` in profiles is the sentinel. |
| AUTH-04 | All database queries are scoped by `bot_id` — RLS enforced on every bot_id-scoped table | RLS enabled on every scoped table with `bot_id` FK. Policy joins bots → tenants → JWT tenant_id. Service role key bypasses RLS for server-side API routes. |
| AUTH-05 | New tenant onboards by creating a tenant + bot + uploading documents, with no code changes required | Schema designed with tenants → bots as data rows, not code. Onboarding is INSERT operations only. feature_flags jsonb default `{}` covers non-Elken tenants from day one. |
</phase_requirements>

---

## Summary

This phase establishes the entire foundation that every subsequent phase depends on: a Next.js 14 project scaffold, a Supabase schema with RLS, a pgvector HNSW index, and a JWT-based role/tenant model. The key insight is that Supabase's Custom Access Token Hook (a Postgres function triggered before every token issue) is the correct, officially-supported mechanism for injecting `role` and `tenant_id` into JWTs at login time — eliminating per-request profile lookups entirely.

Multi-tenancy isolation is implemented in two layers. For user-facing queries (browser sessions), RLS policies read `auth.jwt()->'app_metadata'->>'tenant_id'` which was set by the hook. For server-side routes (n8n webhooks, RAG calls), the service role key bypasses RLS entirely and app-level `bot_id` filtering is applied in code — this is architecturally sound and explicitly documented by Supabase as the correct pattern for trusted server callers. The service role must NEVER be exposed to the browser.

The pgvector HNSW index can and should be created immediately after the `chunks` table is defined — unlike IVFFlat, HNSW does not require data to be present before indexing. Default parameters (m=16, ef_construction=64) are appropriate for 1536-dimensional vectors at v1 dataset sizes; they can be tuned later without a schema change.

**Primary recommendation:** Scaffold Next.js with `npx create-next-app -e with-supabase`, write all schema as Supabase CLI migrations in `supabase/migrations/`, implement the Custom Access Token Hook as migration SQL, and verify isolation with `supabase test db` pgTAP tests.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.x (latest 16.1.7 available, pin 14 per spec) | App Router framework | Locked by project spec |
| typescript | 5.9.3 | Type safety | Locked by project spec |
| @supabase/supabase-js | 2.99.2 | Supabase client SDK | Official Supabase JS SDK |
| @supabase/ssr | 0.9.0 | Cookie-based SSR auth helpers for Next.js | Official Supabase SSR package; replaces deprecated auth-helpers |
| tailwindcss | 4.2.1 | Utility CSS | Locked by project spec |
| shadcn/ui (shadcn CLI) | 4.0.8 | UI component library | Locked by project spec |
| supabase (CLI) | latest | Migration management, local dev, test runner | Official Supabase toolchain; manages `supabase/migrations/` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pgvector (Postgres extension) | bundled with Supabase | Vector similarity search | Always — `CREATE EXTENSION vector` in first migration |
| pgtap (Postgres extension) | bundled with Supabase | SQL-level RLS isolation tests | Phase 1 only — verify tenant isolation before declaring done |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @supabase/ssr | @supabase/auth-helpers-nextjs | auth-helpers is deprecated; ssr is the current official replacement |
| Supabase CLI migrations | Drizzle / Prisma migrations | CLI migrations stay in Supabase's own toolchain; no ORM needed for v1 |
| Custom Access Token Hook | Edge Function hook | Both work; Postgres function hook is lower latency and doesn't require Edge deployment |

**Installation:**
```bash
npx create-next-app -e with-supabase
# The template installs @supabase/supabase-js and @supabase/ssr automatically
# Then add shadcn/ui:
npx shadcn@latest init
# Install Supabase CLI (macOS):
brew install supabase/tap/supabase
```

**Version verification (confirmed 2026-03-18):**
```bash
npm view @supabase/ssr version        # 0.9.0
npm view @supabase/supabase-js version # 2.99.2
npm view next version                  # 16.1.7 (but spec locks Next 14)
npm view tailwindcss version           # 4.2.1
npm view shadcn version                # 4.0.8
```

---

## Architecture Patterns

### Recommended Project Structure

```
elken-chatbot/
├── app/
│   ├── layout.tsx                   # Root layout (HTML shell)
│   ├── page.tsx                     # / → redirect to /dashboard or /login
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx             # Login page shell (full UI in Phase 4)
│   └── dashboard/
│       ├── layout.tsx               # Dashboard shell layout (sidebar placeholder)
│       ├── page.tsx                 # /dashboard root — placeholder
│       ├── bots/
│       │   └── page.tsx             # Phase 2+
│       ├── knowledge/
│       │   └── page.tsx             # Phase 2+
│       ├── settings/
│       │   └── page.tsx             # Phase 4+
│       └── analytics/
│           └── page.tsx             # Phase 6+
├── lib/
│   └── supabase/
│       ├── server.ts                # createServerClient (Server Components, Actions, Route Handlers)
│       ├── client.ts                # createBrowserClient (Client Components)
│       └── service.ts               # createServiceClient (API routes only — service role key)
├── middleware.ts                     # Token refresh proxy (REQUIRED for @supabase/ssr)
├── supabase/
│   ├── config.toml                  # Supabase CLI config
│   ├── migrations/
│   │   ├── 00001_extensions.sql     # enable vector, pgtap
│   │   ├── 00002_schema.sql         # tenants, bots, profiles, chunks tables
│   │   ├── 00003_rls.sql            # RLS enable + all policies
│   │   ├── 00004_indexes.sql        # HNSW index, btree indexes on FK columns
│   │   └── 00005_auth_hook.sql      # custom_access_token_hook function + grant
│   └── tests/
│       └── isolation.test.sql       # pgTAP two-tenant isolation test
└── .env.local                       # NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY
```

### Pattern 1: Custom Access Token Hook (JWT Claims Injection)

**What:** A Postgres function called by Supabase Auth before every token issuance. Reads `profiles` table and injects `role` + `tenant_id` into `app_metadata` of the JWT.

**When to use:** Always — this is how every RLS policy knows the caller's role and tenant without a runtime database lookup.

**Critical constraints:** Do NOT use `SECURITY DEFINER`. Do NOT set the hook from the SQL Editor (the `?` operator breaks). Grant execute ONLY to `supabase_auth_admin`. Enable the hook in Dashboard → Authentication → Hooks.

```sql
-- Source: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_role text;
  user_tenant_id uuid;
begin
  select p.role, p.tenant_id
  into user_role, user_tenant_id
  from public.profiles p
  where p.id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(coalesce(user_role, 'tenant_admin')));

  if user_tenant_id is not null then
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', to_jsonb(user_tenant_id::text));
  else
    -- super-admin: null tenant_id means access to everything
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', 'null'::jsonb);
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Grants required for the hook to execute
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on table public.profiles to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

### Pattern 2: RLS Policy with JWT Claims

**What:** RLS policies read from `auth.jwt()->'app_metadata'` to enforce bot_id-level isolation. Wrap `auth.jwt()` in a `select` subquery for per-statement caching (prevents calling the function once per row).

**When to use:** On every table that has a `bot_id` FK column.

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- Helper function: returns the caller's tenant_id from JWT (null for super_admin)
create or replace function public.jwt_tenant_id()
returns uuid
language sql stable
security invoker
as $$
  select nullif(
    (auth.jwt()->'app_metadata'->>'tenant_id'),
    ''
  )::uuid
$$;

-- Helper function: returns true if caller is super_admin
create or replace function public.is_super_admin()
returns boolean
language sql stable
security invoker
as $$
  select (auth.jwt()->'app_metadata'->>'role') = 'super_admin'
$$;

-- Example: RLS on a bot_id-scoped table (e.g., conversations)
alter table public.conversations enable row level security;

create policy "tenant_isolation" on public.conversations
  for all
  to authenticated
  using (
    (select public.is_super_admin())
    or
    bot_id in (
      select b.id from public.bots b
      join public.tenants t on b.tenant_id = t.id
      where t.id = (select public.jwt_tenant_id())
    )
  );
```

### Pattern 3: Supabase Client Utilities (@supabase/ssr)

**What:** Three separate client utilities for three contexts. Never mix them — especially never use the service role client in a browser context.

```typescript
// Source: https://www.ryankatayi.com/blog/server-side-auth-in-next-js-with-supabase-my-setup
// lib/supabase/server.ts — Server Components, Server Actions, Route Handlers
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch { /* server component — middleware handles refresh */ }
        },
      },
    }
  )
}
```

```typescript
// lib/supabase/client.ts — Client Components only
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/service.ts — API routes ONLY (server-side, never browser)
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

```typescript
// middleware.ts — REQUIRED: refreshes auth tokens and writes them to cookies
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  // MUST call getUser() to refresh the session — never getSession()
  await supabase.auth.getUser()
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### Pattern 4: HNSW Index on chunks.embedding

**What:** Creates the vector similarity index immediately after table creation. HNSW does not require existing data (unlike IVFFlat).

**When to use:** Migration 00004 — right after the chunks table is created.

```sql
-- Source: https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes
-- Enable pgvector
create extension if not exists vector with schema extensions;

-- chunks table (abbreviated — full schema in migration 00002)
create table public.chunks (
  id           uuid primary key default gen_random_uuid(),
  bot_id       uuid not null references public.bots(id) on delete cascade,
  document_id  uuid not null references public.documents(id) on delete cascade,
  content      text not null,
  embedding    extensions.vector(1536),   -- voyage-3 output dimension
  created_at   timestamptz default now()
);

-- HNSW index with cosine distance (standard for text embeddings)
-- m=16, ef_construction=64 are pgvector defaults; appropriate for v1 dataset sizes
-- ef_search can be raised per-query if recall needs improvement
create index chunks_embedding_hnsw_idx
  on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Always index the FK column that RLS and queries filter on
create index chunks_bot_id_idx on public.chunks (bot_id);
```

### Anti-Patterns to Avoid

- **Reading from `user_metadata` in RLS policies:** Users can write to `user_metadata` via `supabase.auth.update()`. Always read authorization data from `app_metadata` only.
- **Using `getSession()` in server code (middleware, Route Handlers):** `getSession()` does NOT revalidate the token with the auth server. Always use `getUser()` in server contexts.
- **Using `security definer` on the auth hook:** This gives the function postgres superuser privileges. Instead, explicitly grant select on profiles to `supabase_auth_admin`.
- **Setting auth hook from the SQL Editor:** The `?` operator in the SQL editor interferes. Write the hook as a migration file and apply via CLI or direct connection.
- **Putting `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_` variable:** Service role key must remain server-side only. If leaked, it bypasses all RLS.
- **Creating an IVFFlat index instead of HNSW:** IVFFlat requires data to be loaded before indexing and suffers recall problems with empty tables. Always use HNSW for new projects.
- **Missing indexes on FK columns in RLS policies:** RLS policy joins (bot_id → bots → tenant_id) become sequential scans without btree indexes on every FK. This is the top RLS performance killer.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cookie management for SSR | Custom JWT cookie logic | `@supabase/ssr` createServerClient + middleware | Token refresh, HttpOnly cookies, and PKCE flow require correct header/response coordination — ssr package handles all edge cases |
| Role/tenant injection into JWT | `auth.users` trigger + app-level lookup | Supabase Custom Access Token Hook | Hook runs atomically before token issue; trigger can miss edge cases; app lookup adds latency |
| Vector similarity search | Custom cosine similarity function | pgvector HNSW index + `<=>` operator | HNSW provides ANN search with recall > 95%; custom SQL distance functions are O(n) full scans |
| Multi-tenant isolation logic | Application-level `WHERE tenant_id = ?` filters | RLS policies at Postgres level | RLS enforces isolation even if application code forgets to filter; defense in depth |
| Migration versioning | Manual SQL files with ad-hoc naming | Supabase CLI `supabase migration new` | CLI tracks applied migrations in `supabase_migrations` table; handles drift detection and remote sync |
| RLS policy testing | Manual INSERT + SELECT checks in production | pgTAP `supabase test db` | Declarative test assertions; reproducible; runs in local Supabase stack without touching production |

**Key insight:** Supabase's opinionated toolchain (CLI + Auth Hooks + RLS) solves multi-tenant isolation, token management, and vector indexing as first-class concerns. The most common mistake is working around these tools instead of through them.

---

## Common Pitfalls

### Pitfall 1: Auth Hook Not Triggering After Migration
**What goes wrong:** The `custom_access_token_hook` function exists in the database but the JWT claims are never set.
**Why it happens:** The hook must be explicitly enabled in the Supabase Dashboard (Authentication → Hooks). Creating the SQL function alone is not sufficient.
**How to avoid:** After applying migration 00005, manually enable the hook in the dashboard as a documented post-migration step.
**Warning signs:** `auth.jwt()->'app_metadata'->>'role'` returns null in RLS policies; all authenticated queries return empty results.

### Pitfall 2: Stale JWT Claims After Profile Update
**What goes wrong:** A user's role or tenant_id is changed in the `profiles` table, but their existing session still shows the old claims.
**Why it happens:** JWT claims are baked into the token at issuance. The hook only runs on new tokens.
**How to avoid:** For Phase 1, document this as a known limitation. For production: force token refresh via `supabase.auth.refreshSession()` or ask the user to re-login after profile changes.
**Warning signs:** User can access resources from their old tenant after a tenant reassignment.

### Pitfall 3: Service Role Key Used in Browser Code
**What goes wrong:** `SUPABASE_SERVICE_ROLE_KEY` is exposed to the browser, bypassing all RLS for every user.
**Why it happens:** Developer puts the service key in a `NEXT_PUBLIC_` variable for convenience.
**How to avoid:** Service key must ONLY appear in `lib/supabase/service.ts`, never in any client-side file. Next.js will NOT strip `NEXT_PUBLIC_` variables — naming is the only guard.
**Warning signs:** Any user can read all tenants' data; Vercel environment variable leaks in bundle analysis.

### Pitfall 4: HNSW Index on Wrong Distance Operator
**What goes wrong:** Index created with `vector_l2_ops` but queries use `<=>` (cosine) operator. Index is not used — full sequential scan runs instead.
**Why it happens:** Mismatch between index operator class and query distance function.
**How to avoid:** Use `vector_cosine_ops` in both the index and all similarity queries: `ORDER BY embedding <=> $1 LIMIT 5`. This is locked for voyage-3 embeddings.
**Warning signs:** `EXPLAIN` shows Seq Scan instead of Index Scan; query time scales linearly with row count.

### Pitfall 5: RLS on Profiles Blocks the Auth Hook
**What goes wrong:** RLS is enabled on `profiles` but the auth hook's postgres function runs as `supabase_auth_admin`, which has no select policy.
**Why it happens:** Adding `alter table profiles enable row level security` without granting the auth admin role access.
**How to avoid:** In migration 00003: grant `select on public.profiles to supabase_auth_admin` BEFORE enabling RLS on profiles, or add a policy that allows `supabase_auth_admin` to read all rows.
**Warning signs:** Login succeeds but JWT contains no `app_metadata` claims; auth hook silently fails.

### Pitfall 6: Missing Middleware Causes Infinite Redirect
**What goes wrong:** Users with valid sessions get redirected to the login page on every page load.
**Why it happens:** Without `middleware.ts`, the auth session token is not refreshed and Server Components receive expired cookies.
**How to avoid:** Always include `middleware.ts` at the project root (not inside `/app`). Verify the `matcher` excludes static assets.
**Warning signs:** Valid login is immediately followed by redirect back to login; `getUser()` returns null on server components despite active session.

---

## Code Examples

### Schema: Core Tables

```sql
-- Migration: 00002_schema.sql
-- Source: Supabase official multi-tenancy pattern

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz default now()
);

create table public.bots (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  api_key_hash  text,                        -- SHA-256 of the API key (Phase 3)
  feature_flags jsonb not null default '{}', -- { "booking_enabled": true }
  created_at    timestamptz default now()
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete set null,  -- null = super_admin
  role        text not null default 'tenant_admin'
                check (role in ('super_admin', 'tenant_admin')),
  full_name   text,
  created_at  timestamptz default now()
);

-- Trigger: auto-create profile row when a user is created in auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### RLS Policies for Bots Table

```sql
-- Migration: 00003_rls.sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security

alter table public.bots enable row level security;

-- Tenant admin sees only their own tenant's bots
create policy "bots_select_tenant" on public.bots
  for select to authenticated
  using (
    (select public.is_super_admin())
    or tenant_id = (select public.jwt_tenant_id())
  );

-- Only super_admin can insert/update/delete bots (Phase 1 scope)
create policy "bots_modify_superadmin" on public.bots
  for all to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
```

### pgTAP Isolation Test

```sql
-- supabase/tests/isolation.test.sql
-- Source: https://supabase.com/docs/guides/local-development/testing/overview

begin;
select plan(4);

-- Setup: two tenants, two bots
insert into public.tenants (id, name, slug) values
  ('11111111-0000-0000-0000-000000000001', 'Tenant A', 'tenant-a'),
  ('22222222-0000-0000-0000-000000000002', 'Tenant B', 'tenant-b');

insert into public.bots (id, tenant_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Bot A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Bot B');

-- Simulate Tenant A admin JWT
set local role authenticated;
set local request.jwt.claims = '{"sub":"user-a","app_metadata":{"role":"tenant_admin","tenant_id":"11111111-0000-0000-0000-000000000001"}}';

select results_eq(
  $$ select count(*)::int from public.bots $$,
  $$ values (1) $$,
  'Tenant A admin sees exactly 1 bot'
);

select is(
  (select name from public.bots limit 1),
  'Bot A',
  'Tenant A admin sees Bot A, not Bot B'
);

-- Switch to Tenant B admin JWT
set local request.jwt.claims = '{"sub":"user-b","app_metadata":{"role":"tenant_admin","tenant_id":"22222222-0000-0000-0000-000000000002"}}';

select results_eq(
  $$ select count(*)::int from public.bots $$,
  $$ values (1) $$,
  'Tenant B admin sees exactly 1 bot'
);

select is(
  (select name from public.bots limit 1),
  'Bot B',
  'Tenant B admin sees Bot B, not Bot A'
);

select * from finish();
rollback;
```

Run with: `supabase test db`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023–2024 | Auth helpers deprecated; ssr is smaller, framework-agnostic, and cookie-method API has changed |
| IVFFlat index for pgvector | HNSW index | pgvector 0.7.0 (Mar 2024) | HNSW has no pre-population requirement and better recall; IVFFlat still exists but is no longer recommended for new projects |
| `getSession()` in server code | `getUser()` in server code | 2024 (SSR package launch) | `getSession()` trusts unvalidated local cookies; `getUser()` revalidates with the auth server |
| Postgres trigger to set app_metadata | Custom Access Token Hook | 2024 | Hooks are synchronous at token issue time; triggers on auth.users require superuser access patterns |
| `get`, `set`, `remove` cookie methods | `getAll`, `setAll` only | @supabase/ssr 0.5+ | New API handles cookie batching correctly in Next.js middleware |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Deprecated, do not use. Replace with `@supabase/ssr`.
- `supabase.auth.getSession()` in middleware/server: Security risk — does not validate token. Use `getUser()`.
- IVFFlat pgvector index: Superseded by HNSW for new projects.

---

## Open Questions

1. **Auth Hook Enabling is Manual**
   - What we know: The hook function can be created via migration SQL, but must be toggled on in Dashboard → Authentication → Hooks manually.
   - What's unclear: Is there a Supabase CLI command or `config.toml` setting that can automate this for CI/CD environments?
   - Recommendation: Document as a manual post-migration step in the PLAN. Flag for automation in v2.

2. **Supabase Project Credentials Timing**
   - What we know: Phase 1 wires `.env.local`. The Supabase project must exist before migrations can run.
   - What's unclear: Navien's exact workflow for creating the Supabase project (dashboard vs CLI `supabase projects create`).
   - Recommendation: Plan task should include a pre-requisite checklist: project created, URL + keys copied to `.env.local`, `supabase link --project-ref <ref>` run.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pgTAP (bundled with Supabase CLI) |
| Config file | None required — tests in `supabase/tests/*.test.sql` |
| Quick run command | `supabase test db` |
| Full suite command | `supabase test db` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | User can log in with email/password | manual smoke | Manual: Supabase dashboard → Auth → Users → create user → test login | ❌ Wave 0 |
| AUTH-02 | Tenant admin session is scoped to own tenant | unit (pgTAP) | `supabase test db` | ❌ Wave 0 |
| AUTH-03 | Super-admin can view all tenants and bots | unit (pgTAP) | `supabase test db` | ❌ Wave 0 |
| AUTH-04 | All bot_id-scoped tables have RLS enforced | unit (pgTAP) | `supabase test db` | ❌ Wave 0 |
| AUTH-05 | New tenant onboards via INSERT only, no code changes | manual smoke | Manual: INSERT into tenants + bots; verify bot is queryable | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `supabase db reset && supabase test db` (local stack only)
- **Per wave merge:** `supabase test db` (full isolation test suite green)
- **Phase gate:** All pgTAP tests green + AUTH-01 manual smoke pass + AUTH-05 manual INSERT test pass

### Wave 0 Gaps
- [ ] `supabase/tests/isolation.test.sql` — covers AUTH-02, AUTH-03, AUTH-04 (two-tenant isolation)
- [ ] `supabase/seed.sql` — minimal seed: 2 test tenants + 2 bots for test reproducibility

*(No additional framework install required — pgTAP is bundled with the Supabase CLI)*

---

## Sources

### Primary (HIGH confidence)
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — hook function signature, grants, dashboard enable
- [Supabase Auth Hooks Overview](https://supabase.com/docs/guides/auth/auth-hooks) — available hooks, permission model, timeout limits
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) — `auth.jwt()` pattern, helper function caching, security definer
- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — hook + RLS policy integration pattern
- [Supabase HNSW Indexes](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes) — CREATE INDEX syntax, HNSW vs IVFFlat
- [Supabase pgvector Extension](https://supabase.com/docs/guides/database/extensions/pgvector) — CREATE EXTENSION, vector column type
- [Supabase SSR Client Creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — getAll/setAll cookie API, server vs browser client
- [Supabase Local Development Testing](https://supabase.com/docs/guides/local-development/testing/overview) — pgTAP, `supabase test db`, JWT simulation
- [Supabase CLI Migration Reference](https://supabase.com/docs/reference/cli/supabase-migration) — migration commands, db push vs migration up

### Secondary (MEDIUM confidence)
- [Ryan Katayi — Server-Side Auth in Next.js with Supabase](https://www.ryankatayi.com/blog/server-side-auth-in-next-js-with-supabase-my-setup) — complete middleware.ts + server.ts + client.ts code (verified against Supabase SSR docs)
- [pgvector GitHub](https://github.com/pgvector/pgvector) — m=16, ef_construction=64 defaults confirmed; WITH clause syntax
- [Crunchy Data HNSW blog](https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector) — parameter recommendations for high-dimensional vectors

### Tertiary (LOW confidence)
- WebSearch: community patterns for `tenant_id = null` super-admin sentinel (common pattern, not officially documented by Supabase)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed via npm registry (2026-03-18)
- Architecture: HIGH — patterns sourced directly from Supabase official docs
- Pitfalls: HIGH — sourced from official troubleshooting docs and official limitations pages
- HNSW parameters: MEDIUM — defaults (m=16, ef_construction=64) confirmed from pgvector docs; optimal values for 1536-dim at scale are dataset-dependent

**Research date:** 2026-03-18
**Valid until:** 2026-04-17 (30 days — Supabase stack is stable, @supabase/ssr has been at 0.9.x for several months)
