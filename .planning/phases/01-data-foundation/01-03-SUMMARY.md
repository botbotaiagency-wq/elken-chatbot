---
phase: 01-data-foundation
plan: 03
subsystem: auth
tags: [supabase, ssr, nextjs16, middleware, jwt, login, dashboard]

# Dependency graph
requires:
  - phase: 01-data-foundation plan 01
    provides: lib/supabase/server.ts and lib/supabase/client.ts client utilities
  - phase: 01-data-foundation plan 02
    provides: Database schema with RLS, custom_access_token_hook, profiles table

provides:
  - Auth middleware (lib/supabase/middleware.ts) with getUser() token refresh
  - proxy.ts entry point wiring auth to Next.js 16 request lifecycle
  - Working email/password login page at /login via signInWithPassword
  - Auth-gated dashboard layout redirecting unauthenticated users to /login

affects: [all phases — auth layer is prerequisite for all protected routes]

# Tech tracking
tech-stack:
  added: []
  patterns: [Next.js 16 Suspense+AuthGate pattern for dynamic auth in cacheComponents mode, proxy.ts as middleware entry point instead of middleware.ts]

key-files:
  created:
    - lib/supabase/middleware.ts
  modified:
    - proxy.ts
    - app/(auth)/login/page.tsx
    - app/dashboard/layout.tsx

key-decisions:
  - "Next.js 16 uses proxy.ts not middleware.ts — updateSession helper in lib/supabase/middleware.ts, wired via proxy.ts"
  - "Dashboard layout uses Suspense+AuthGate async component pattern to support Next.js 16 cacheComponents partial prerender"
  - "createClient() for browser moved inside event handler to avoid prerender-time instantiation without env vars"

patterns-established:
  - "Pattern 1: Auth gate via Suspense-wrapped async server component — compatible with Next.js 16 cacheComponents"
  - "Pattern 2: lib/supabase/middleware.ts is the auth logic owner; proxy.ts is only the entry point thin wrapper"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 01 Plan 03: Auth Middleware, Login Page, and Dashboard Auth Gate Summary

**Supabase auth middleware (getUser token refresh), email/password login form, and Suspense-gated dashboard layout wired into Next.js 16 proxy.ts**

## Performance

- **Duration:** ~4 min (code) + human verification
- **Started:** 2026-03-18T07:10:32Z
- **Completed:** 2026-03-18T08:22:00Z
- **Tasks:** 2 of 2 (Task 2 human-verify approved by user)
- **Files modified:** 4

## Accomplishments
- Auth middleware helper (`lib/supabase/middleware.ts`) uses `getUser()` (not `getSession()`) to ensure token revalidation with Supabase auth server on every request
- Login page at `/login` fully functional with email/password form, error handling, and loading state — calls `signInWithPassword` via browser Supabase client
- Dashboard layout auth-gates all `/dashboard/*` routes, redirecting unauthenticated users to `/login`
- Build passes with Next.js 16 partial prerender for all dashboard routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth middleware and implement login page with dashboard auth protection** - `5ea688e` (feat)
2. **Task 2: Verify Supabase setup, migration application, and end-to-end auth flow** - human-verify checkpoint, approved by user (2026-03-18)

**Plan metadata:** pending final metadata commit

## Files Created/Modified
- `lib/supabase/middleware.ts` - updateSession helper with getUser(), redirect logic for unauthenticated/authenticated users
- `proxy.ts` - Next.js 16 entry point importing updateSession from lib/supabase/middleware
- `app/(auth)/login/page.tsx` - Working email/password login form with signInWithPassword
- `app/dashboard/layout.tsx` - Auth-gated layout using Suspense+AuthGate async component pattern

## Decisions Made
- Used `proxy.ts` instead of `middleware.ts` (Next.js 16 uses proxy.ts as the edge middleware entry point)
- Used `Suspense + async AuthGate` component pattern in dashboard layout — required by Next.js 16 `cacheComponents: true` config which disables `export const dynamic`
- Moved `createClient()` inside event handler in login page to avoid prerender-time instantiation failure when env vars are absent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js 16 uses proxy.ts not middleware.ts as middleware entry point**
- **Found during:** Task 1 (build verification)
- **Issue:** Creating `middleware.ts` alongside existing `proxy.ts` caused Next.js 16 build error: "Both middleware file and proxy file are detected"
- **Fix:** Deleted `middleware.ts`, updated `proxy.ts` to import `updateSession` from `lib/supabase/middleware.ts` (plan's helper file)
- **Files modified:** proxy.ts (was lib/supabase/proxy.ts import, now lib/supabase/middleware import)
- **Verification:** Build passes
- **Committed in:** 5ea688e

**2. [Rule 1 - Bug] createClient() called at component body level throws during static prerender**
- **Found during:** Task 1 (build verification — second attempt)
- **Issue:** `const supabase = createClient()` at component level runs during SSR prerender, throws when NEXT_PUBLIC_SUPABASE_URL is missing
- **Fix:** Moved `createClient()` call inside the `handleLogin` event handler
- **Files modified:** app/(auth)/login/page.tsx
- **Verification:** Build passes, login page prerendered as static
- **Committed in:** 5ea688e

**3. [Rule 1 - Bug] export const dynamic incompatible with Next.js 16 cacheComponents config**
- **Found during:** Task 1 (build verification — third attempt)
- **Issue:** `export const dynamic = 'force-dynamic'` throws Turbopack build error: "Route segment config dynamic is not compatible with nextConfig.cacheComponents"
- **Fix:** Used `Suspense + async AuthGate` pattern — non-async layout wraps async auth-checking component in Suspense, achieving dynamic auth without route segment config
- **Files modified:** app/dashboard/layout.tsx
- **Verification:** All dashboard routes build as partial prerender (◐), build passes
- **Committed in:** 5ea688e

---

**Total deviations:** 3 auto-fixed (3 bugs — all Next.js 16 compatibility issues)
**Impact on plan:** All auto-fixes necessary for Next.js 16 compatibility. The auth semantics (getUser, redirect to /login, signInWithPassword) are exactly as specified in the plan. No scope creep.

## Issues Encountered
- Next.js 16 (latest) introduced `proxy.ts` over `middleware.ts`, `cacheComponents` config, and stricter prerender rules — all three triggered auto-fixes. The plan was written for Next.js 14 patterns; all deviations were adaptation to Next.js 16 while preserving exact auth semantics.

## User Setup Completed

The following one-time Supabase setup was completed by the user during the Task 2 checkpoint:

1. Supabase project created and linked via `supabase link --project-ref`
2. All 5 migrations applied via `supabase db push`
3. Custom Access Token Hook enabled in Supabase Dashboard -> Authentication -> Hooks
4. Super-admin user (Navien) created in Authentication -> Users
5. Profile updated: `UPDATE public.profiles SET role = 'super_admin', tenant_id = NULL WHERE id = '<uuid>';`
6. `.env.local` populated with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and ANTHROPIC_API_KEY

**Verification results (user confirmed):**
- Login flow: / -> /login redirect confirmed, credentials accepted, /dashboard loads with auth cookies
- pgTAP: all 8 two-tenant isolation tests pass via `supabase test db`
- Super-admin profile: `SELECT * FROM public.profiles WHERE role = 'super_admin'` returns Navien's user

## Next Phase Readiness
- Phase 1 Data Foundation is complete and fully verified end-to-end
- Supabase project is live with all migrations, RLS, and auth hook operational
- Super-admin (Navien) can log in and access the dashboard
- ANTHROPIC_API_KEY is in .env.local — Phase 2 document ingestion / RAG pipeline can start immediately
- All TypeScript types, database schema, RLS policies, auth hook, and auth flow are verified and ready for Phase 2

---
*Phase: 01-data-foundation*
*Completed: 2026-03-18*

## Self-Check: PASSED

- lib/supabase/middleware.ts: FOUND
- proxy.ts: FOUND
- app/(auth)/login/page.tsx: FOUND
- app/dashboard/layout.tsx: FOUND
- .planning/phases/01-data-foundation/01-03-SUMMARY.md: FOUND
- Commit 5ea688e: FOUND
- Task 2 human-verify checkpoint: APPROVED by user (2026-03-18)
