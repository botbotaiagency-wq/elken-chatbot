# Project Structure

**Analysis Date:** 2026-04-02

## Directory Layout

```
elken-whatsapp-chatbot/
├── app/                        # Next.js App Router — pages and API routes
│   ├── (auth)/                 # Route group: login/auth pages (not in URL)
│   │   └── login/
│   ├── api/                    # API route handlers
│   │   ├── admin/              # Super-admin endpoints (tenant/user CRUD)
│   │   ├── analytics/[botId]/  # Analytics report queries
│   │   ├── auth/               # Google Calendar OAuth flow
│   │   ├── bookings/[botId]/   # Booking CRUD + survey endpoint
│   │   ├── bots/               # Bot CRUD (list, create)
│   │   ├── bots/[botId]/       # Per-bot endpoints (facilities)
│   │   ├── chat/[botId]/       # Primary RAG chat endpoint (external API)
│   │   ├── config/[botId]/     # Bot config endpoints (personality, FAQs, guardrails, etc.)
│   │   ├── documents/[botId]/  # Document list and delete
│   │   ├── ingest/[botId]/     # Document upload + processing pipeline
│   │   ├── keys/[botId]/       # API key management
│   │   ├── notifications/      # Cron dispatch endpoint
│   │   └── products/[botId]/   # Product CRUD
│   ├── auth/                   # Supabase auth callback pages
│   ├── dashboard/              # Admin dashboard pages
│   │   ├── admin/              # Super-admin pages (users)
│   │   ├── analytics/          # Analytics dashboard page
│   │   ├── bookings/           # Bookings list page
│   │   ├── bots/               # Bot list page
│   │   │   └── [botId]/        # Per-bot detail pages
│   │   │       ├── api-keys/
│   │   │       ├── booking/
│   │   │       ├── faqs/
│   │   │       ├── guardrails/
│   │   │       ├── integrations/
│   │   │       ├── personality/
│   │   │       ├── templates/
│   │   │       └── testing/
│   │   ├── knowledge/          # Knowledge base management (documents + products)
│   │   └── settings/           # Tenant settings
│   ├── protected/              # Example protected page (scaffold)
│   ├── globals.css             # Global Tailwind base styles
│   ├── layout.tsx              # Root layout (ThemeProvider, font)
│   └── page.tsx                # Root page (redirects to /dashboard)
├── components/                 # Shared React components
│   ├── ui/                     # shadcn/ui primitives (button, badge, etc.)
│   ├── tutorial/               # Scaffold tutorial components (from starter kit)
│   ├── auth-button.tsx         # Auth state toggle
│   ├── login-form.tsx          # Login form
│   ├── sign-up-form.tsx        # Sign-up form
│   ├── forgot-password-form.tsx
│   ├── update-password-form.tsx
│   ├── logout-button.tsx
│   └── theme-switcher.tsx      # Light/dark toggle
├── lib/                        # Server-side business logic (never imported client-side)
│   ├── analytics/
│   │   ├── queries.ts          # All analytics SQL queries via Supabase RPC
│   │   └── csv.ts              # CSV export helper
│   ├── api-keys/
│   │   └── generate.ts         # API key generation utility
│   ├── booking/
│   │   ├── state-machine.ts    # Core booking conversation state machine
│   │   ├── slot-checker.ts     # Availability checking and slot finding
│   │   ├── google-calendar.ts  # Google Calendar OAuth2 integration
│   │   ├── notifications.ts    # Reminder and survey dispatch
│   │   └── types.ts            # BookingState, Booking, FacilityType, etc.
│   ├── ingest/
│   │   ├── extractor.ts        # PDF/DOCX/TXT text extraction
│   │   ├── chunker.ts          # Token-based text chunking (gpt-tokenizer)
│   │   ├── embedder.ts         # VoyageAI voyage-3-large embedding wrapper
│   │   └── qna-parser.ts       # Q&A pair extraction from text documents
│   ├── rag/
│   │   ├── detect.ts           # Intent + language classification via Claude
│   │   ├── retrieve.ts         # Semantic search via Supabase RPCs
│   │   ├── prompt.ts           # System prompt assembly with RAG context
│   │   ├── logger.ts           # Message + conversation persistence
│   │   └── transcribe.ts       # OpenAI Whisper voice transcription
│   └── supabase/
│       ├── client.ts           # Browser Supabase client
│       ├── server.ts           # SSR Supabase client (cookie-based)
│       ├── service.ts          # Service-role client (bypasses RLS)
│       ├── middleware.ts       # Session refresh + auth redirect logic
│       └── proxy.ts            # Storage proxy utility
├── supabase/
│   ├── migrations/             # Numbered SQL migration files (15 migrations)
│   │   ├── 00001_extensions.sql    # pgvector, uuid-ossp
│   │   ├── 00002_schema.sql        # Core tables: tenants, bots, profiles, etc.
│   │   ├── 00003_rls.sql           # Row Level Security policies
│   │   ├── 00004_indexes.sql       # Performance indexes
│   │   ├── 00005_auth_hook.sql     # Auto-create profiles trigger
│   │   ├── 00006_schema_fix_products.sql
│   │   ├── 00007_rag_functions.sql # match_chunks, match_faqs, match_products RPCs
│   │   ├── 00008_api_keys.sql      # api_keys table
│   │   ├── 00009_bot_config.sql    # Bot personality/config columns
│   │   ├── 00010_bookings.sql      # Bookings, facility_configs tables
│   │   ├── 00011_analytics.sql     # Analytics view/functions
│   │   ├── 00012_fix_booking_user_channel.sql
│   │   ├── 00013_documents_subcategory.sql
│   │   ├── 00014_new_features.sql
│   │   └── 00015_google_oauth.sql  # Google OAuth token columns on bots
│   └── seed.sql                # Initial seed data
├── types/
│   └── database.ts             # Shared TypeScript types: Bot, Tenant, Profile, Document, Message, etc.
├── scripts/
│   ├── seed-elken.mjs          # Elken-specific seed script (products, FAQs, documents)
│   ├── patch-voyageai-esm.cjs  # Postinstall: patches voyageai ESM compatibility
│   └── smoke-test.sh           # End-to-end smoke test script
├── tests/                      # Vitest test files
├── docs/                       # Project documentation
├── .planning/                  # GSD planning documents (not shipped)
├── next.config.ts              # Next.js config (serverExternalPackages for CJS deps)
├── tsconfig.json               # TypeScript config (path alias: @/ → root)
├── tailwind.config.ts          # Tailwind config with custom animations
├── vitest.config.ts            # Vitest test runner config
├── vercel.json                 # Vercel deployment config
└── package.json                # Dependencies and scripts
```

## Module Organization

**`app/api/` — API Route Handlers**
All routes follow the Next.js App Router convention: `app/api/[resource]/[param]/route.ts`. Every file exports named HTTP methods (`GET`, `POST`, `DELETE`, `PATCH`). Routes that need long processing time set `export const maxDuration = 60`.

Bot-scoped routes use `[botId]` as a dynamic segment. The `botId` is always resolved via `await params` (required in Next.js 15).

Auth is enforced at the handler level — no global middleware for API routes. Dashboard-facing routes use the SSR Supabase client; chat and ingest routes use the service-role client directly.

**`lib/` — Business Logic Modules**
Library code is organized by domain. Each subdirectory is a self-contained module:
- `lib/rag/` — everything needed to answer a chat message
- `lib/booking/` — everything needed to handle a booking conversation
- `lib/ingest/` — everything needed to process a document
- `lib/analytics/` — everything needed to answer an analytics query
- `lib/supabase/` — Supabase client factory functions

No barrel (`index.ts`) files — imports reference individual files directly.

**`app/dashboard/` — Admin Pages**
Server Components that read Supabase directly. Auth check in `app/dashboard/layout.tsx` gates all children. Bot detail pages have a nested `[botId]` layout at `app/dashboard/bots/[botId]/layout.tsx`.

**`components/ui/` — UI Primitives**
shadcn/ui components (Button, Badge, Checkbox, DropdownMenu, etc.). These are the only React components with client-side interactivity. Not modified after generation.

**`types/database.ts` — Shared Types**
Single source of truth for all database entity types. Import from `@/types/database` in both `lib/` and `app/api/`.

## Key Files

| File | Purpose |
|------|---------|
| `app/api/chat/[botId]/route.ts` | Primary external chat API — orchestrates full RAG pipeline |
| `app/api/ingest/[botId]/process/route.ts` | Document processing pipeline (extract → chunk → embed → store) |
| `app/api/notifications/dispatch/route.ts` | Cron handler for booking reminders and post-session surveys |
| `app/dashboard/layout.tsx` | Auth gate + sidebar navigation for all dashboard pages |
| `lib/rag/detect.ts` | Intent and language classifier (Claude API call) |
| `lib/rag/retrieve.ts` | Vector similarity search (VoyageAI embed + Supabase RPCs) |
| `lib/rag/prompt.ts` | System prompt builder — assembles bot config + RAG context |
| `lib/rag/logger.ts` | Message persistence and conversation management |
| `lib/rag/transcribe.ts` | Voice-to-text via OpenAI Whisper |
| `lib/booking/state-machine.ts` | Booking multi-step conversation state machine |
| `lib/booking/types.ts` | All booking domain types: BookingState, FacilityType, etc. |
| `lib/booking/google-calendar.ts` | Google Calendar OAuth2 event creation |
| `lib/ingest/embedder.ts` | VoyageAI voyage-3-large embedding (document and query variants) |
| `lib/ingest/extractor.ts` | PDF/DOCX/TXT text extraction |
| `lib/supabase/service.ts` | Service-role Supabase client (bypasses RLS) — API routes only |
| `lib/supabase/middleware.ts` | Session refresh + auth redirect |
| `types/database.ts` | All shared TypeScript entity types |
| `supabase/migrations/00002_schema.sql` | Core schema definition |
| `supabase/migrations/00007_rag_functions.sql` | pgvector RPC functions for semantic search |
| `scripts/seed-elken.mjs` | Elken tenant data seeding script |

## Naming Conventions

**Files:**
- API route handlers: `route.ts` (required by Next.js App Router)
- Dashboard pages: `page.tsx` and `layout.tsx` (required by Next.js App Router)
- Library modules: `kebab-case.ts` (e.g., `state-machine.ts`, `slot-checker.ts`, `qna-parser.ts`)
- UI components: `kebab-case.tsx` (e.g., `login-form.tsx`, `auth-button.tsx`)
- Type files: `kebab-case.ts` (e.g., `database.ts`)

**Directories:**
- API resource directories: `kebab-case` matching the resource name (e.g., `api-keys`, `google-calendar`)
- Dynamic route segments: `[camelCase]` (e.g., `[botId]`, `[documentId]`)
- Route groups: `(groupName)` — used for `(auth)` to group login pages without affecting URL

**TypeScript:**
- Types and interfaces: PascalCase (e.g., `BookingState`, `DetectionResult`, `BotConfig`)
- Exported functions: camelCase (e.g., `handleBookingFlow`, `retrieveContext`, `buildSystemPrompt`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `SIMILARITY_THRESHOLD`, `TOP_K_CHUNKS`, `BOOKING_TTL_MS`)
- Enum-like string literal unions preferred over TypeScript enums (e.g., `type Intent = 'browse_product' | 'health_issue' | ...`)

**Database:**
- Table names: `snake_case` plural nouns (e.g., `bots`, `chunks`, `conversations`, `api_keys`)
- Column names: `snake_case` (e.g., `bot_id`, `rag_found`, `latency_ms`)
- RPC functions: `snake_case` verb phrases (e.g., `match_chunks`, `match_faqs`)

## Where to Add New Code

**New API endpoint:**
- Create `app/api/[resource]/[botId]/route.ts`
- Use `createServiceClient()` from `lib/supabase/service.ts`
- Bot-scoped: always filter by `botId` from `await params`
- Auth check: import and call `createClient()` from `lib/supabase/server.ts` if behind dashboard auth

**New dashboard page:**
- Create `app/dashboard/[feature]/page.tsx`
- Auth is inherited from `app/dashboard/layout.tsx` — no additional auth check needed
- For bot-specific pages: add under `app/dashboard/bots/[botId]/[feature]/page.tsx`

**New library module:**
- Create `lib/[domain]/[module-name].ts`
- Export named functions only — no default exports
- Use `createServiceClient()` for any Supabase access

**New database entity:**
- Add a numbered migration: `supabase/migrations/000XX_description.sql`
- Add corresponding TypeScript type to `types/database.ts`

**New UI component:**
- shadcn/ui primitives: `components/ui/[component-name].tsx`
- Feature-specific: co-locate with the dashboard page or create `components/[feature-name].tsx`

**New bot configuration field:**
- Add migration altering `bots` table
- Add to `BotConfig` interface in `lib/rag/prompt.ts`
- Wire into `buildSystemPrompt()` prompt assembly
- Add to the `bots` select query in `app/api/chat/[botId]/route.ts`

---

*Structure analysis: 2026-04-02*
