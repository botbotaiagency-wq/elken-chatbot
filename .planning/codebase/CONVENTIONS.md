# Coding Conventions

**Analysis Date:** 2026-04-02

## Language & Style

**Language:** TypeScript 5 with strict mode enabled (`"strict": true` in `tsconfig.json`).

**Formatting:** No Prettier config present at the project root. ESLint is configured via `eslint.config.mjs` using `next/core-web-vitals` and `next/typescript` presets — the standard Next.js flat-config setup.

**TypeScript settings (from `tsconfig.json`):**
- Target: `ES2017`
- Module resolution: `bundler`
- `isolatedModules: true`
- `forceConsistentCasingInFileNames: true`
- `noEmit: true` (Next.js manages compilation)
- Path alias: `@/*` maps to project root

**Run lint:**
```bash
npm run lint   # eslint .
```

## Naming Patterns

**Files:**
- Library modules: camelCase — `embedder.ts`, `chunker.ts`, `detect.ts`, `logger.ts`
- Type definitions: camelCase — `database.ts`
- Next.js route files: always `route.ts` (App Router convention)
- Component files: PascalCase implied by Next.js conventions (not deeply explored)

**Functions:**
- camelCase — `detectIntentAndLanguage`, `retrieveContext`, `embedDocumentChunks`, `embedQuery`, `logMessage`, `getOrCreateConversation`, `buildSystemPrompt`
- Named exports only — no default function exports in `lib/`
- Async functions use the `async function` keyword style, not arrow functions at module scope

**Variables:**
- camelCase — `queryEmbedding`, `botId`, `conversationId`, `rawMessage`, `fullResponse`
- Constants use SCREAMING_SNAKE_CASE for tuneable thresholds — `SIMILARITY_THRESHOLD`, `TOP_K_CHUNKS`, `TOP_K_FAQS`, `TOP_K_PRODUCTS` (see `lib/rag/retrieve.ts`)

**Interfaces/Types:**
- PascalCase interfaces — `LogMessageParams`, `DetectionResult`, `RetrievalResult`, `ChunkResult`, `FAQResult`, `ProductResult`
- Union type aliases — `Intent`, `Language`, `UserRole`, `DocumentCategory` (see `types/database.ts`)
- Database shape types live in `types/database.ts` exclusively

## Import Organization

**Observed order:**
1. Node built-ins — `import crypto from 'crypto'`
2. Third-party packages — `import Anthropic from '@anthropic-ai/sdk'`
3. Internal modules via `@/` alias — `import { createServiceClient } from '@/lib/supabase/service'`
4. Type imports — `import type { Intent } from '@/types/database'`

`import type` is used for pure type imports consistently across `lib/` files.

**Path alias:** Always use `@/` for intra-project imports. Never use relative `../` paths.

## Error Handling

**Lib layer:**
- Functions throw on Supabase errors: `if (error) throw error` after logging to `console.error()`
- Specific error messages with `throw new Error('message')` for known failure cases (e.g., scanned PDFs, unsupported MIME types, missing config)
- No custom error class hierarchy — raw Error objects and Supabase error objects are both thrown

**API route layer:**
- Top-level `try/catch` in route handlers — catch logs with `console.error('[route name]', error)` and returns `Response.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })`
- Inline early-return pattern for validation errors before the `try` block — `return Response.json({ error: '...' }, { status: 400 })`
- Pattern: validate → early return 4xx → try/catch → 500 on unexpected errors

**Error extraction pattern:**
```typescript
error instanceof Error ? error.message : 'Internal server error'
```
Used consistently in catch blocks to safely extract error messages from unknown types.

## Logging

**Framework:** `console.*` only — no structured logging library.

**Conventions:**
- `console.error()` for caught errors in lib and API routes
- `console.warn()` for expected-but-noteworthy conditions (e.g., `[DEV MODE]` bypass warnings in `app/api/chat/[botId]/route.ts`)
- Lib-level error logging format: `console.error('Failed to [action]:', error)` before re-throwing
- Route-level error logging format: `console.error('[route POST]', error)` with bracketed route identifier
- Booking/calendar modules use `[module-name]` prefix: `[slot-checker]`, `[Google Calendar]`, `[state-machine]`, `[Notification]`

No structured log levels (info/debug) are used. No log aggregation service is wired up.

## State Management

**Server-side:** No global in-memory state. All state is persisted to Supabase. Booking flow state is stored in `conversations.metadata` JSONB column as a `BookingState` object.

**Client-side:** Next.js App Router with React 19. No Redux or Zustand detected. State management within components uses React built-ins (not deeply analyzed in this audit — focus was on `lib/` and `app/api/`).

## Common Patterns

**Supabase client instantiation:**
- Always use `createServiceClient()` from `@/lib/supabase/service` in `lib/` and API routes — never instantiate the client inline
- Client is created per-request (not module-level singleton) to avoid cross-request contamination

**Module-level singletons (external SDKs):**
- `voyage` and `anthropic` clients in `lib/ingest/embedder.ts` and `lib/rag/detect.ts` are initialized at module scope:
  ```typescript
  const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! })
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  ```
- Note: `app/api/chat/[botId]/route.ts` instantiates `new Anthropic()` per request (inconsistency)

**Non-null assertion for env vars:**
- `process.env.VOYAGE_API_KEY!` — non-null assertion used throughout. No runtime validation of env var presence at startup.

**Interface-based params objects:**
- Functions taking many args use a typed params interface:
  ```typescript
  export interface LogMessageParams { ... }
  export async function logMessage(params: LogMessageParams): Promise<string>
  ```

**Supabase chaining:**
- Always chain `.select('id').single()` after inserts to get back the inserted row's ID
- Soft deletes via `.update({ revoked_at: ... })` — no hard deletes on `api_keys`

**Response headers for chat endpoint:**
- Custom headers `X-Conversation-Id`, `X-Intent`, `X-Language`, `X-Rag-Found` are always set on streaming chat responses
- `X-Transcription` added when voice input is used

**Streaming:**
- Uses `ReadableStream` with `TransformStream`-style async iteration over the Anthropic SDK stream
- Logs assistant message to DB *after* the stream completes (inside `start(controller)` after the for-await loop)

**Feature flags:**
- Accessed via `bot.feature_flags` JSONB field — checked as `featureFlags?.booking_enabled` before routing to booking flow

---

*Convention analysis: 2026-04-02*
