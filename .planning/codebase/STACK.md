# Technology Stack

**Analysis Date:** 2026-04-02

## Runtime & Language

**Primary Language:** TypeScript ^5
- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- Target: ES2017, module resolution: bundler
- Path alias: `@/*` maps to project root

**Runtime:** Node.js (server-side) + Browser (client components)
- Next.js App Router hybrid: Server Components, Route Handlers, Middleware

**Package Manager:** npm
- Lockfile: `package-lock.json` present

## Frameworks & Libraries

**Core Framework:**
- `next` (latest, pinned to 15.3.1 in eslint-config-next) — Full-stack React framework with App Router
- `react` ^19.0.0 — UI rendering
- `react-dom` ^19.0.0 — DOM reconciliation

**AI / LLM:**
- `@anthropic-ai/sdk` ^0.80.0 — Claude API client (chat completions, intent detection, booking flows)
  - Model in use: `claude-haiku-4-5-20251001`
- `openai` ^6.33.0 — OpenAI client (voice transcription via Whisper `whisper-1` model)
- `voyageai` ^0.2.1 — Voyage AI client (document and query embeddings, model: `voyage-3-large`, 1024-dim)
- `gpt-tokenizer` ^3.4.0 — Token counting utility

**Database / Backend-as-a-Service:**
- `@supabase/supabase-js` (latest) — Supabase JS client (direct queries, RPC calls)
- `@supabase/ssr` (latest) — SSR-safe Supabase client for Next.js (browser + server + middleware variants)

**Google Integration:**
- `googleapis` ^171.4.0 — Google Calendar API v3, OAuth2, userinfo

**Document Parsing:**
- `pdf-parse` ^1.1.1 — PDF text extraction (text-based PDFs only; scanned not supported)
- `mammoth` ^1.12.0 — DOCX text extraction
- `papaparse` ^5.5.3 — CSV parsing (with `@types/papaparse` ^5.5.2)

**UI Components:**
- `@radix-ui/react-checkbox` ^1.3.1 — Accessible checkbox primitive
- `@radix-ui/react-dropdown-menu` ^2.1.14 — Dropdown menu primitive
- `@radix-ui/react-label` ^2.1.6 — Form label primitive
- `@radix-ui/react-slot` ^1.2.2 — Slot composition primitive
- `radix-ui` ^1.4.3 — Radix UI meta-package
- `class-variance-authority` ^0.7.1 — CVA for variant-based component styling
- `clsx` ^2.1.1 — Conditional className utility
- `tailwind-merge` ^3.3.0 — Tailwind class merge utility
- `lucide-react` ^0.511.0 — Icon library
- `next-themes` ^0.4.6 — Light/dark theme switching
- `sonner` ^2.0.7 — Toast notification library
- `recharts` ^2.15.4 — Chart library for analytics dashboard
- `react-day-picker` ^9.14.0 — Date picker component
- `date-fns` ^4.1.0 — Date utility library

## Build & Tooling

**Build:**
- Next.js built-in webpack/Turbopack bundler
- Server external packages (excluded from bundling): `voyageai`, `pdf-parse`, `mammoth`
  (configured in `next.config.ts` — these are CJS/native modules)

**TypeScript:**
- `typescript` ^5
- Config: `tsconfig.json` (strict, incremental, `next` plugin)

**Linting:**
- `eslint` ^9 with `eslint-config-next` 15.3.1
- Config: `eslint.config.mjs` (flat config format, extends `next/core-web-vitals` and `next/typescript`)

**Styling:**
- `tailwindcss` ^3.4.1 — Utility CSS framework
- `tailwindcss-animate` ^1.0.7 — Animation plugin
- `postcss` ^8 with `autoprefixer` ^10.4.20
- Config files: `tailwind.config.ts`, `postcss.config.mjs`

**Testing:**
- `vitest` ^4.1.0 — Test runner
- `@vitest/coverage-v8` ^4.1.0 — V8 coverage provider
- Config: `vitest.config.ts` (node environment, tests in `tests/**/*.test.ts`, coverage over `lib/**/*.ts`)
- Setup: `tests/setup.ts`

**Scripts:**
- `npm run dev` — `next dev`
- `npm run build` — `next build`
- `npm run start` — `next start`
- `npm run lint` — `eslint .`
- `postinstall` — `node scripts/patch-voyageai-esm.cjs` (patches voyageai ESM compatibility)

**UI Component Config:**
- `components.json` — shadcn/ui component registry configuration

## Infrastructure

**Deployment Platform:** Vercel
- `vercel.json` present (empty config — uses Vercel defaults)
- Environment detection via `VERCEL_ENV` and `VERCEL_URL`
- Notification cron skips non-production environments (`VERCEL_ENV !== 'production'`)

**Database:** Supabase (PostgreSQL)
- Postgres extensions: `pgvector` (vector similarity search, 1024-dim embeddings), `pgtap` (DB testing)
- Migrations in `supabase/migrations/` (15 migration files)
- Row-Level Security (RLS) enabled — see `supabase/migrations/00003_rls.sql`

**Authentication:** Supabase Auth (built-in)
- Session management via `@supabase/ssr` middleware
- Google OAuth2 for Google Calendar integration (separate from auth)

**Cron / Scheduled Jobs:**
- Notifications dispatch cron at `app/api/notifications/dispatch/route.ts`
- Protected by `CRON_SECRET` bearer token
- Intended to be triggered by Vercel Cron or external scheduler

---

*Stack analysis: 2026-04-02*
