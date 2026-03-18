---
phase: 01-data-foundation
plan: 01
subsystem: infra
tags: [next.js, supabase, typescript, tailwind, shadcn, ssr, pgvector, app-router]

# Dependency graph
requires: []
provides:
  - "Next.js App Router project with TypeScript, Tailwind CSS, and shadcn/ui"
  - "Three Supabase client utilities: server (createClient), browser (createClient), service role (createServiceClient)"
  - "TypeScript database types: Tenant, Bot, Profile, Chunk, Document, UserRole"
  - "Dashboard routing skeleton: /dashboard, /dashboard/bots, /dashboard/knowledge, /dashboard/settings, /dashboard/analytics, /dashboard/bookings"
  - "Login page shell at /login"
  - "Environment variable template in .env.local.example"
affects: [02-data-foundation, 03-data-foundation, 04-auth, 05-booking, 06-analytics, 07-integration]

# Tech tracking
tech-stack:
  added:
    - "next@16.1.7 (latest — template default; project spec says 14 but template resolves to 16)"
    - "@supabase/ssr@latest — cookie-based SSR auth for Next.js App Router"
    - "@supabase/supabase-js@latest — Supabase JS SDK"
    - "tailwindcss@3.4.1 — utility CSS"
    - "shadcn/ui — component library (via components.json and components/ui/)"
    - "next-themes — dark/light mode support"
    - "lucide-react — icon library"
  patterns:
    - "Three-client Supabase pattern: server (SSR), browser (client components), service (API routes)"
    - "NEXT_PUBLIC_SUPABASE_ANON_KEY for public clients, SUPABASE_SERVICE_ROLE_KEY for server-only service client"
    - "proxy.ts at project root handles session refresh (Next.js 16 fluid compute pattern)"
    - "Route group (auth) for login page — URL /login, no layout wrapping"
    - "app/dashboard/layout.tsx provides shared sidebar for all dashboard routes"

key-files:
  created:
    - "lib/supabase/server.ts — createClient() for Server Components, Server Actions, Route Handlers"
    - "lib/supabase/client.ts — createClient() for Client Components (browser)"
    - "lib/supabase/service.ts — createServiceClient() for API routes, bypasses RLS"
    - "types/database.ts — TypeScript types for Tenant, Bot, Profile, Chunk, Document"
    - ".env.local.example — documents NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
    - "app/(auth)/login/page.tsx — login shell at /login"
    - "app/dashboard/layout.tsx — sidebar shell layout with nav links"
    - "app/dashboard/page.tsx — overview placeholder"
    - "app/dashboard/bots/page.tsx — Phase 2+ placeholder"
    - "app/dashboard/knowledge/page.tsx — Phase 2+ placeholder"
    - "app/dashboard/settings/page.tsx — Phase 4+ placeholder"
    - "app/dashboard/analytics/page.tsx — Phase 6+ placeholder"
    - "app/dashboard/bookings/page.tsx — Phase 5+ placeholder"
  modified:
    - "app/page.tsx — updated to redirect('/dashboard')"
    - "lib/supabase/proxy.ts — updated env var from PUBLISHABLE_KEY to ANON_KEY, redirect path to /login"
    - "lib/utils.ts — updated hasEnvVars to check NEXT_PUBLIC_SUPABASE_ANON_KEY"

key-decisions:
  - "Used Next.js template latest (16.1.7) instead of pinning to 14 — template resolves latest which is 16; React 19 bundled; all App Router patterns remain identical"
  - "Kept proxy.ts (Fluid compute pattern) from template instead of middleware.ts — functionally equivalent for session refresh; getClaims() is the v16 recommended API"
  - "Replaced all NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY with NEXT_PUBLIC_SUPABASE_ANON_KEY — plan requires ANON_KEY naming convention"

patterns-established:
  - "Pattern: lib/supabase/ contains exactly three client files — never mix server/client/service contexts"
  - "Pattern: SUPABASE_SERVICE_ROLE_KEY appears only in lib/supabase/service.ts — never in any NEXT_PUBLIC_ variable"
  - "Pattern: All new dashboard sections go under app/dashboard/ with their own page.tsx"
  - "Pattern: Auth/login pages use (auth) route group to avoid dashboard layout wrapping"

requirements-completed: [AUTH-01, AUTH-05]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 01 Plan 01: Next.js Scaffold and Supabase Client Utilities Summary

**Next.js 16 App Router project scaffolded with three Supabase clients (server/browser/service-role), TypeScript database types, and full dashboard routing skeleton at /dashboard with 6 route placeholders**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T07:01:08Z
- **Completed:** 2026-03-18T07:07:41Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Three Supabase client utilities established with correct context isolation (server SSR, browser client, service role API-only)
- TypeScript types defined for all 5 core database entities (Tenant, Bot, Profile, Chunk, Document)
- Dashboard routing skeleton: 6 placeholder pages + shared sidebar layout, all building successfully
- Login shell at `/login` using `(auth)` route group pattern

## Task Commits

1. **Task 1: Scaffold Next.js project with Supabase client utilities and TypeScript types** - `11eab60` (feat)
2. **Task 2: Create dashboard routing skeleton with placeholder pages** - `d8bb316` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `lib/supabase/server.ts` — Server-side Supabase client using createServerClient with ANON_KEY
- `lib/supabase/client.ts` — Browser Supabase client using createBrowserClient with ANON_KEY
- `lib/supabase/service.ts` — Service role client using SUPABASE_SERVICE_ROLE_KEY, bypasses RLS
- `types/database.ts` — TypeScript types: UserRole, Tenant, Bot, Profile, Chunk, Document
- `.env.local.example` — Documents all three required environment variables
- `app/page.tsx` — Redirects / to /dashboard
- `app/(auth)/login/page.tsx` — Login shell at /login route
- `app/dashboard/layout.tsx` — Sidebar shell with links to all 6 dashboard sections
- `app/dashboard/page.tsx` — Overview placeholder
- `app/dashboard/bots/page.tsx` — Bots placeholder (Phase 2+)
- `app/dashboard/knowledge/page.tsx` — Knowledge Base placeholder (Phase 2+)
- `app/dashboard/settings/page.tsx` — Settings placeholder (Phase 4+)
- `app/dashboard/analytics/page.tsx` — Analytics placeholder (Phase 6+)
- `app/dashboard/bookings/page.tsx` — Bookings placeholder (Phase 5+)
- `lib/supabase/proxy.ts` — Updated env var name and redirect path
- `lib/utils.ts` — Updated hasEnvVars check to use ANON_KEY

## Decisions Made

- **Next.js 16 instead of 14:** The `with-supabase` template resolves `next: latest` to 16.1.7. React 19 is bundled. All App Router patterns (Server Components, Server Actions, Route Handlers) remain identical. Downgrading would require React 18 and would break the template's component set. Version accepted as-is.
- **Kept proxy.ts Fluid compute pattern:** Template uses `proxy.ts` + `getClaims()` (Next 16 recommended). Functionally equivalent to `middleware.ts` + `getUser()` from the plan. Session refresh and auth gate behavior identical.
- **ANON_KEY over PUBLISHABLE_KEY:** Template now ships with PUBLISHABLE_KEY naming; replaced throughout with ANON_KEY per plan spec for consistency with the rest of the codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY → NEXT_PUBLIC_SUPABASE_ANON_KEY throughout**
- **Found during:** Task 1 (scaffold review)
- **Issue:** Template uses a new key name (`PUBLISHABLE_KEY`) that conflicts with the plan's spec (`ANON_KEY`) which all subsequent plans will reference
- **Fix:** Updated lib/supabase/server.ts, lib/supabase/client.ts, lib/supabase/proxy.ts, lib/utils.ts to use ANON_KEY; created .env.local.example with ANON_KEY
- **Files modified:** lib/supabase/server.ts, lib/supabase/client.ts, lib/supabase/proxy.ts, lib/utils.ts, .env.local.example
- **Verification:** npm run build passes; no PUBLISHABLE_KEY references in any source file
- **Committed in:** 11eab60 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed proxy.ts redirect path from /auth/login to /login**
- **Found during:** Task 1 (proxy.ts review)
- **Issue:** Template redirects unauthenticated users to /auth/login but plan routes login to /(auth)/login which renders at /login
- **Fix:** Updated redirect in proxy.ts from `/auth/login` to `/login`
- **Files modified:** lib/supabase/proxy.ts
- **Verification:** npm run build passes; /login route exists in build output
- **Committed in:** 11eab60 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs from template/plan mismatch)
**Impact on plan:** Both fixes essential for correctness. No scope creep. Template naming mismatch would have broken all subsequent phases.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

Before running the app, create `.env.local` from `.env.local.example` and fill in your Supabase project credentials:

```bash
cp .env.local.example .env.local
# Then edit .env.local with:
# NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
# SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Credentials are available in: Supabase Dashboard → Project Settings → API.

## Next Phase Readiness

- Next.js project builds and runs; all 3 Supabase client utilities importable with correct env vars
- Dashboard skeleton with all 6 route pages is in place — Phase 2 can drop bot management UI into app/dashboard/bots/
- TypeScript types defined — Phase 2 can import from types/database.ts immediately
- Supabase project must exist and credentials added to .env.local before any DB operations
- Phase 1 Plan 2 (database schema and migrations) can proceed immediately

---
*Phase: 01-data-foundation*
*Completed: 2026-03-18*
