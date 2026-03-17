# Technology Stack

**Project:** Multi-Tenant AI Chatbot SaaS Platform (Ask Ethan Digital)
**Researched:** 2026-03-18
**Knowledge cutoff:** August 2025 — external verification tools unavailable during this session; all claims are from training data unless marked otherwise. Verify versions before installing.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 14.2.x (App Router) | Full-stack framework | App Router colocates server/client logic; Route Handlers replace API Routes cleanly; React Server Components reduce client bundle; file-based routing maps cleanly to dashboard pages. **Do not upgrade to Next.js 15** mid-project — breaking changes in cache semantics require migration effort not worth taking mid-build. |
| TypeScript | 5.4+ | Type safety | Strict mode prevents tenant-scoping bugs at compile time. Critical for a multi-tenant system where passing wrong bot_id is a silent data leak. |
| React | 18.x (bundled with Next.js 14) | UI runtime | Server Components + Suspense enable progressive streaming of chat responses without a client-side useEffect waterfall. |

**Confidence:** HIGH — Next.js 14 App Router is stable and production-proven as of August 2025.

---

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Postgres | 15.x | Primary datastore | All relational data: tenants, bots, conversations, messages, FAQs, templates, bookings. RLS enforces tenant isolation at the database layer — the safest place to enforce it. |
| pgvector | 0.7.x | Vector similarity search | Embedded in Supabase Postgres — no external vector store infra. 1536-dim vectors for voyage-3 embeddings. HNSW index preferred over IVFFlat for this use case (see index guidance below). |
| Supabase Storage | — | File storage | PDF/DOCX/TXT uploads. Bucket-per-bot or single bucket with bot_id path prefix. 50MB file limit per upload on free tier; 5GB on Pro. |

**Confidence:** HIGH for Supabase + pgvector combination. MEDIUM for specific pgvector version (0.7.x was current as of mid-2025; verify on Supabase dashboard).

#### pgvector Index Guidance

**Use HNSW, not IVFFlat**, for this project. Reasons:
- HNSW does not require knowing the number of vectors at index creation time — critical because knowledge base size is unknown and grows as tenants upload documents.
- HNSW has no "training" phase — index builds incrementally as rows insert.
- IVFFlat requires `ANALYZE` after bulk inserts to stay accurate; HNSW does not.
- At the scale of a SaaS chatbot (tens of thousands of chunks per bot, not billions), HNSW query performance is excellent.

Recommended HNSW index DDL:

```sql
-- Create per-bot HNSW index on the embedding column
-- m=16, ef_construction=64 are Supabase-recommended defaults for most workloads
CREATE INDEX ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- At query time, set ef_search higher for better recall (at cost of latency)
-- Default is 40; 100 gives better recall for RAG
SET hnsw.ef_search = 100;
```

**Multi-tenancy with pgvector:** Always filter by `bot_id` BEFORE the vector similarity operator. Postgres will use the scalar index first if you structure the WHERE clause correctly:

```sql
SELECT id, content, 1 - (embedding <=> $1) AS similarity
FROM document_chunks
WHERE bot_id = $2   -- filter first
ORDER BY embedding <=> $1
LIMIT 5;
```

This prevents cross-tenant data leakage in search results. RLS policies should also enforce `bot_id` ownership as a belt-and-suspenders measure.

**Confidence:** MEDIUM — HNSW guidance is based on pgvector 0.5+ documentation from training data. The DDL syntax and parameter names were stable as of August 2025 but should be verified against current Supabase pgvector docs.

---

### AI / Embeddings

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Anthropic Claude | claude-haiku-3-5 (claude-haiku-20241022) | Chat completions | Locked per project spec. Fast, cheap, multilingual. Handles EN/BM/ZH without fine-tuning. |
| voyage-3 (via Anthropic API) | voyage-3 | Document + query embeddings | **Recommended over native Claude embeddings.** 1024-dim output (configurable to 1536 for pgvector compatibility), MTEB-leading retrieval performance on multilingual content, available via `anthropic.embeddings` client. Produces embeddings optimized for retrieval — Claude's own embedding endpoint is a general-purpose model, not retrieval-specialized. |

**Embedding model decision — voyage-3 vs Claude embeddings:**

- `voyage-3` is Voyage AI's model, served via the Anthropic API (Anthropic acquired Voyage AI). It is explicitly retrieval-optimized.
- Claude's embedding endpoint (`text-embedding-3-small` equivalent) is a general model; voyage-3 consistently outperforms it on retrieval benchmarks per Anthropic's own documentation.
- For a trilingual (EN/BM/ZH) corpus, voyage-3's multilingual retrieval performance is important — BM (Bahasa Malaysia) is a lower-resource language and benefits from a model with explicit multilingual training.
- Use `input_type: "document"` when embedding knowledge base chunks; `input_type: "query"` when embedding user messages. This asymmetric approach materially improves recall.
- Dimension: voyage-3 produces 1024-dim by default; pgvector column should be `VECTOR(1024)`. Do not upscale to 1536 unnecessarily — larger dimensions increase storage and query cost with no retrieval benefit.

**Confidence:** MEDIUM — voyage-3 via Anthropic API was confirmed available as of August 2025. The recommendation to use voyage-3 over Claude's general embedding endpoint is supported by Anthropic's own documentation. Verify current model names and pricing before implementation.

---

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Auth | Latest (via `@supabase/ssr`) | Dashboard authentication | Handles email/password for admin dashboard. JWT tokens carry `user_id` which maps to `tenant_id`. Use `@supabase/ssr` package (not deprecated `@supabase/auth-helpers-nextjs`) for App Router compatibility. |

**Important:** The package `@supabase/auth-helpers-nextjs` is deprecated. The replacement is `@supabase/ssr`. Many tutorials still reference the old package. Do not use it.

Supabase Auth for multi-tenancy pattern:
1. On user creation, create a row in `tenants` table with `owner_id = auth.uid()`.
2. RLS policies use `auth.uid()` to derive tenant access: `WHERE owner_id = auth.uid()` or via a `tenant_members` junction table.
3. Super-admin (Navien) gets a custom claim `role: 'super_admin'` set via a Supabase Edge Function or direct SQL on the `auth.users` table's `raw_app_meta_data` column. RLS policies bypass isolation for `auth.jwt() ->> 'role' = 'super_admin'`.

**Confidence:** HIGH — `@supabase/ssr` as the replacement for auth-helpers was announced and documented before August 2025.

---

### Streaming (Chat API)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel AI SDK | 3.x (`ai` package) | Streaming chat responses | Provides `streamText`, `StreamingTextResponse` (or `toDataStreamResponse` in v3), and `useChat` hook. Handles the protocol between server Route Handler and client without manual SSE boilerplate. |

**Critical version note:** The Vercel AI SDK had a major API change between v2 and v3:
- v2: `StreamingTextResponse` from `ai`
- v3: `streamText(...).toDataStreamResponse()` — `StreamingTextResponse` still exists as an alias but the idiomatic v3 pattern uses `toDataStreamResponse()`.

Use v3 patterns. The `useChat` hook on the client side is unchanged in interface but requires the server to return the AI SDK data stream format (not raw text/event-stream).

**Recommended server-side pattern (v3):**

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: Request) {
  const { messages, botId } = await req.json();
  // Fetch RAG context, FAQ injections, personality config...

  const result = await streamText({
    model: anthropic('claude-haiku-20241022'),
    messages,
    system: buildSystemPrompt(personality, ragContext, faqs),
  });

  return result.toDataStreamResponse();
}
```

**Confidence:** MEDIUM — v3 API shape was correct as of August 2025. The `StreamingTextResponse` deprecation timeline should be verified; it may have been fully removed by now.

---

### UI Components

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 3.4.x | Styling | Utility-first; pairs perfectly with shadcn/ui. Do not upgrade to Tailwind v4 mid-project — v4 has a completely different config format (PostCSS plugin replaced with Vite plugin; `@theme` directive). v3 is stable and all shadcn/ui components target it. |
| shadcn/ui | Latest CLI (`npx shadcn@latest`) | Component library | Not a dependency — components are copied into `components/ui/`. This means no version lock-in and full customizability. Critical for the 11-page dashboard. |
| Lucide React | 0.400+ | Icons | Default icon set for shadcn/ui. Already installed when you add shadcn/ui components. |
| Recharts | 2.x | Analytics charts | shadcn/ui chart components are built on Recharts. Use the `<ChartContainer>` wrapper from shadcn/ui rather than raw Recharts — it handles theming and responsive containers. |

**shadcn/ui component patterns for this project:**

- Use `<Sheet>` for mobile sidebar nav (slides in from left).
- Use `<Dialog>` for confirmation modals (delete bot, revoke API key).
- Use `<DataTable>` (shadcn/ui Table + TanStack Table) for the analytics and FAQ management pages — do not build custom tables.
- Use `<Tabs>` for the bot configuration page (General | Personality | Guardrails | Integrations).
- Use `<Form>` (shadcn/ui Form + react-hook-form + zod) for all data entry — this handles validation display automatically.

**Tailwind v4 warning:** As of early 2026, Tailwind v4 is released. If the project was initialized before Tailwind v4, keep v3. If starting fresh, check whether shadcn/ui CLI now targets v4 by default — run `npx shadcn@latest init` and follow its prompts rather than manually installing Tailwind.

**Confidence:** HIGH for shadcn/ui patterns. MEDIUM for Tailwind version guidance — verify current shadcn/ui CLI behavior as of March 2026.

---

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 4.x | Client state (dashboard) | Lightweight, no boilerplate. Use for: active bot context, sidebar state, in-progress upload status. Do not use for server data — that belongs in React Query or server components. |
| TanStack Query (React Query) | 5.x | Server state cache | For dashboard data (bot list, FAQ list, analytics). Handles loading/error states, cache invalidation, and optimistic updates. Works with Supabase client calls. |

**What NOT to use for state:**
- Redux — overkill for this scope.
- Jotai/Recoil — no ecosystem advantage here.
- Context API for server state — causes prop drilling and no caching.

**Confidence:** HIGH — Zustand + React Query is the de facto standard for Next.js App Router projects as of August 2025.

---

### File Processing (Ingestion Pipeline)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pdf-parse | 1.1.1 | PDF text extraction | Runs in Node.js (Next.js API Route). No browser dependencies. Extracts raw text from PDF pages. |
| mammoth | 1.x | DOCX text extraction | Converts .docx to plain text or HTML. Better than docx package for text-only extraction. |
| LangChain.js | 0.2.x (text splitters only) | Text chunking | Use `RecursiveCharacterTextSplitter` from `@langchain/textsplitters`. Do NOT pull in the full LangChain framework — just the splitter. This avoids a massive dependency footprint for a utility you only need for chunking. |

**Chunking strategy recommendation:**

- Chunk size: 512 tokens (approximately 400 words)
- Overlap: 50 tokens
- Splitter: `RecursiveCharacterTextSplitter` with separators `['\n\n', '\n', '. ', ' ']`
- Store metadata per chunk: `{ bot_id, document_id, chunk_index, source_filename, page_number }`

**Alternative to LangChain for chunking:** Implement a simple recursive splitter manually (< 50 lines of TypeScript) to eliminate the LangChain dependency entirely. Recommended if you want zero extra dependencies.

**Confidence:** HIGH for pdf-parse and mammoth. MEDIUM for LangChain.js version — the package structure changed significantly in 2024/2025 (moved to `@langchain/` scoped packages). Verify the import path for text splitters.

---

### API Key Management

| Technology | Purpose | Why |
|------------|---------|-----|
| `crypto.randomBytes` (Node.js built-in) | API key generation | Generate 32-byte random key, base64url encode, prefix with `ethan_`. No library needed. |
| `bcrypt` / `argon2` | API key hashing | Store only the hash. Display the plaintext key once at creation (copy-once pattern). argon2 preferred for new projects; bcrypt is acceptable and simpler to set up in Next.js. |

**API key format:** `ethan_<base64url(32 random bytes)>` — 44 characters after prefix. Store prefix + first 8 chars for display (`ethan_xKj3...`); store bcrypt hash of full key for verification.

**Confidence:** HIGH — standard pattern, no library versions to track beyond Node.js built-ins.

---

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | — | Frontend + API hosting | Zero-config Next.js deployment. Streaming Route Handlers work via Vercel's edge/serverless runtime. Use Node.js runtime (not Edge) for API routes that do PDF parsing — Edge runtime lacks Node.js APIs needed by pdf-parse and mammoth. |
| Supabase | Pro tier recommended | Database + Auth + Storage | Free tier has 500MB DB limit and pauses after 1 week inactivity — not suitable for production. Pro ($25/mo) gives 8GB DB, no pausing, daily backups. |

**Vercel function runtime note:** Set `export const runtime = 'nodejs'` (or omit the export, since Node.js is default) on any Route Handler that does file processing or uses pdf-parse/mammoth. The Edge runtime will fail silently on these.

For the streaming chat endpoint, Node.js runtime also works fine — do not use Edge runtime to avoid footgun.

**Confidence:** HIGH — Vercel runtime behavior was stable as of August 2025.

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk` | 0.24+ | Claude API + voyage-3 embeddings | All AI calls. Use streaming via `client.messages.stream()` or via Vercel AI SDK's Anthropic provider. |
| `@supabase/supabase-js` | 2.x | Supabase client | All DB, Auth, Storage calls. |
| `@supabase/ssr` | 0.4+ | Supabase Auth in App Router | Server Components, Route Handlers, Middleware. Replaces deprecated `@supabase/auth-helpers-nextjs`. |
| `zod` | 3.x | Schema validation | Validate all incoming webhook payloads and form inputs. Do not trust n8n input. |
| `react-hook-form` | 7.x | Form state | Paired with shadcn/ui Form component and zod resolver. |
| `date-fns` | 3.x | Date manipulation | Booking availability, last-cutoff calculations. Prefer over moment.js (smaller, tree-shakeable). |
| `@vercel/analytics` | 1.x | Usage analytics | Optional — lightweight pageview tracking without cookie consent overhead. |
| `nanoid` | 5.x | Short ID generation | For API key prefixes, conversation IDs. Shorter than UUID, URL-safe. |

---

## Alternatives Considered and Rejected

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Vector store | pgvector (Supabase) | Pinecone, Weaviate | Extra infra, extra cost, extra auth surface. pgvector in Supabase is sufficient for this scale and eliminates a dependency. |
| Embeddings | voyage-3 | OpenAI text-embedding-3-small | OpenAI adds a second AI vendor dependency. voyage-3 is available via the same Anthropic API key — single vendor, better retrieval performance. |
| Embeddings | voyage-3 | Claude built-in embeddings | Claude's general-purpose embeddings underperform voyage-3 on retrieval benchmarks. voyage-3 is retrieval-specialized and multilingual. |
| Auth | Supabase Auth | NextAuth.js / Auth.js | NextAuth requires self-managed user tables and custom session handling. Supabase Auth is already in the stack and provides RLS integration — no reason to add NextAuth. |
| Component library | shadcn/ui | Chakra UI, MUI, Mantine | shadcn/ui copies components into your repo (full control, no version updates breaking your UI). Tailwind-native. No runtime CSS-in-JS overhead. Best choice for a dashboard product. |
| State management | Zustand + React Query | Redux Toolkit | RTK is overkill for this scope. Zustand is 1KB and handles the small amount of client UI state needed. |
| Text extraction | pdf-parse + mammoth | Apache Tika (via Java) | Tika would require a Java sidecar or separate service. pdf-parse + mammoth run in Node.js inline with the API route — simpler, fewer moving parts, matches the v1 constraint of no separate workers. |
| ORM | Supabase client (direct SQL) | Prisma, Drizzle | Supabase's JS client with typed query builder is sufficient. Prisma adds migration complexity on top of Supabase's built-in migration system (conflict risk). Drizzle is a reasonable alternative if strong type safety on queries is needed — but only add it if the Supabase client's typing proves insufficient. |
| Chat streaming | Vercel AI SDK | Manual SSE | Vercel AI SDK handles the SSE protocol, JSON streaming format, error states, and the `useChat` client hook. Building this manually is 200+ lines of boilerplate for no benefit. |
| Framework | Next.js 14 | Remix, SvelteKit | Locked per spec. Next.js is the correct choice anyway — App Router RSC + Vercel deployment is the canonical stack for this type of SaaS. |
| CSS framework | Tailwind v3 | Tailwind v4 | v4 released in early 2025 with breaking config changes. shadcn/ui targets v3. Start with v3; migrate to v4 in a dedicated phase later if needed. |

---

## Installation

```bash
# Create project
npx create-next-app@14 . --typescript --tailwind --app --src-dir --import-alias "@/*"

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# AI
npm install @anthropic-ai/sdk ai

# Anthropic AI SDK provider for Vercel AI SDK
npm install @ai-sdk/anthropic

# UI components - initialize shadcn/ui
npx shadcn@latest init
# Then add components as needed:
npx shadcn@latest add button card dialog sheet table tabs form input textarea badge

# Forms and validation
npm install react-hook-form zod @hookform/resolvers

# State management
npm install zustand @tanstack/react-query

# File processing
npm install pdf-parse mammoth

# Text chunking (option A: minimal LangChain dependency)
npm install @langchain/textsplitters

# Date handling
npm install date-fns

# Utilities
npm install nanoid

# Dev dependencies
npm install -D @types/pdf-parse @types/node
```

**Note on `@ai-sdk/anthropic`:** The Vercel AI SDK uses provider packages. Install `@ai-sdk/anthropic` to use the `anthropic()` model factory with `streamText`. This is separate from `@anthropic-ai/sdk` (the raw Anthropic client). You may need both.

---

## RLS Policy Patterns for Multi-Tenancy

This is the most critical architectural concern. All RLS policies follow the same pattern:

```sql
-- Example: bots table
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;

-- Tenant can only see their own bots
CREATE POLICY "tenant_isolation" ON bots
  FOR ALL
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' = 'super_admin'
  );

-- Example: document_chunks table (accessed via service role key in API routes)
-- For tables accessed server-side only, use service role key + manual bot_id check
-- rather than RLS (RLS adds overhead; service-side enforcement is sufficient)
```

**Key decision:** Use RLS for client-side Supabase queries (dashboard reads). Use service role key + explicit `bot_id` filters for server-side Route Handlers (ingestion, chat endpoint). Never expose the service role key to the browser.

---

## Sources

All findings from training data (knowledge cutoff August 2025). External verification tools were unavailable during this session.

- Supabase pgvector documentation: https://supabase.com/docs/guides/database/extensions/pgvector
- Anthropic embeddings documentation: https://docs.anthropic.com/en/docs/build-with-claude/embeddings
- Vercel AI SDK documentation: https://sdk.vercel.ai/docs
- shadcn/ui documentation: https://ui.shadcn.com/docs
- Next.js App Router documentation: https://nextjs.org/docs/app
- Supabase SSR package: https://supabase.com/docs/guides/auth/server-side/nextjs

**Confidence summary by area:**

| Area | Level | Reason |
|------|-------|--------|
| Next.js 14 App Router patterns | HIGH | Stable, well-documented, widely used |
| Supabase Auth + RLS patterns | HIGH | Stable API, `@supabase/ssr` replacement confirmed |
| pgvector HNSW indexing | MEDIUM | Syntax correct as of Aug 2025; verify current Supabase pgvector version |
| voyage-3 embeddings | MEDIUM | Available via Anthropic API as of Aug 2025; verify current model name |
| Vercel AI SDK v3 streaming | MEDIUM | `toDataStreamResponse()` pattern correct as of Aug 2025; verify `StreamingTextResponse` status |
| Tailwind v3 vs v4 decision | MEDIUM | v4 released early 2025; shadcn/ui compatibility needs current verification |
| LangChain text splitters import path | LOW | Package restructured significantly in 2024/2025; verify `@langchain/textsplitters` import |
