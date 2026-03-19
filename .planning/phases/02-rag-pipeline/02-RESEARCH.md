# Phase 2: RAG Pipeline - Research

**Researched:** 2026-03-19
**Domain:** RAG pipeline — file ingestion, embeddings, pgvector retrieval, Claude streaming
**Confidence:** HIGH (most claims verified via official docs; one critical schema mismatch flagged)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Embedding provider:** voyage-3-large via Voyage AI API (`VOYAGE_API_KEY` env var)
- **Schema alignment:** `output_dimension=1536` to match `chunks.embedding vector(1536)` — SEE CRITICAL FLAG BELOW
- **Batch embeddings:** all chunks per document in a single Voyage API call (up to 128 inputs per call)
- **FAQ embeddings:** FAQ entries also embedded; FAQ semantic match wins over RAG chunks when similarity exceeds threshold
- **Ingestion flow:** two-step — file uploads to Supabase Storage first, separate API call triggers processing
- **Document status lifecycle:** `pending` → `processing` → `ready` / `failed`
- **Status polling:** admin polls (no websockets)
- **File size limit:** 10 MB per upload
- **PDF parsing:** `pdf-parse`
- **DOCX parsing:** `mammoth.js`
- **TXT:** raw string read
- **Scanned PDF rejection:** if extracted text < 100 characters, reject with error message
- **Ingestion location:** Next.js API routes only (no Railway worker)
- **Language detection:** Claude Haiku — single inference call returns `{ language, intent }` JSON
- **Language detection scope:** re-detect per message (code-switching supported)
- **RAG search:** language-agnostic — search all chunks; Claude responds in detected language
- **Products table:** dedicated `products` table with structured fields; also embedded as chunks
- **Product data entry:** CSV bulk import AND manual form
- **Product language:** English-only fields for v1; Claude translates on response
- **Top-K:** Claude's discretion (typically 5)
- **Similarity threshold:** 0.75 (locked, RAG-09)
- **FAQ priority:** FAQ semantic match runs first; FAQ answer wins if similarity >= 0.75
- **Message logging:** role, content, intent, source_chunks (IDs + similarity scores), rag_found, latency_ms

### Claude's Discretion
- Exact system prompt structure and context assembly order
- Top-K chunk count (typically 5)
- Chunking implementation details (character/token boundary handling, overlap mechanics)
- Supabase Storage bucket naming and folder structure
- Error retry logic for Voyage API calls
- DOCX image stripping behavior

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| KB-01 | Admin can upload PDF, DOCX, and TXT files to the bot's knowledge base | Two-step upload pattern: signed URL from server, direct client upload to Supabase Storage |
| KB-02 | Files are extracted, chunked (500 tokens, 50 overlap), embedded (voyage-3), stored in pgvector | pdf-parse + mammoth + gpt-tokenizer chunking + VoyageAI SDK batch embed + Supabase RPC insert |
| KB-03 | Each document has a category tag (Beauty/FMCG/GenQi/Healthfood/Home Appliances/Other) | Already in schema; pass category in upload form body |
| KB-04 | Document ingestion status: pending → processing → ready / failed | Status column already in `documents` table; update via service client in process route |
| KB-05 | Chunk count displayed per document after ingestion | `chunk_count` column already in `documents` table; update after bulk insert |
| KB-06 | Admin can delete a document (cascades to all chunks) | Cascade already configured in `00002_schema.sql`; also delete from Storage |
| KB-07 | Structured product data with Product Detail Card retrieval | New `products` table migration (00006); products also stored as chunks; structured card returned on match |
| RAG-01 | Chat endpoint POST /api/chat/[botId] accepts message + userId + channel + conversationId | New App Router route handler; API key validation (Phase 3 prepares key infrastructure) |
| RAG-02 | Language auto-detected (EN/BM/ZH); bot responds in detected language | Claude Haiku intent+language call; `language` field in structured JSON response |
| RAG-03 | Every message classified by intent | Same Haiku call as RAG-02; `intent` field in structured JSON |
| RAG-04 | FAQs injected as priority context above RAG chunks | Embed FAQs; cosine match against `faqs` embeddings first; inject if >= 0.75 |
| RAG-05 | Customer can search any Elken product; bot returns Product Detail Card | Products embedded as chunks; on product intent, fetch full `products` row for card fields |
| RAG-06 | Customer describes health concern; RAG matches to product | Standard RAG retrieval; health_issue intent uses same cosine search pipeline |
| RAG-07 | No product match fallback (rag_found = false) | Check similarity scores; if all < 0.75, set rag_found=false; Claude uses fallback response_template |
| RAG-08 | Customer can request Product Detail Card/brochure/price list | product intent triggers structured card from `products` table |
| RAG-09 | RAG finds no match at similarity < 0.75; rag_found = false; logged | `match_chunks` RPC uses threshold param; check returned rows; log accordingly |
| RAG-10 | All messages logged: role, content, intent, source chunk IDs + similarity, rag_found, latency_ms | `messages` table already has all required columns; insert after response streams |
</phase_requirements>

---

## Summary

Phase 2 builds two distinct pipelines: an ingestion pipeline (upload → extract → chunk → embed → store) and a retrieval pipeline (embed query → FAQ priority check → cosine search → Claude streaming response). Both run exclusively inside Next.js App Router API routes.

The stack is well-defined by locked decisions. The main technical complexity is in the chunking logic (token-accurate splitting with overlap), the two-step upload architecture (required to bypass Vercel's 4.5 MB body limit), and the streaming response assembly (Anthropic SDK stream piped to a Web ReadableStream Response).

**CRITICAL SCHEMA FLAG:** voyage-3-large does NOT support `output_dimension=1536`. Official Voyage AI docs confirm the only supported dimensions for voyage-3-large are 2048, 1024, 512, and 256. The existing `chunks.embedding vector(1536)` schema must be migrated to `vector(1024)` (recommended: 1024 for best quality/cost balance) or `vector(2048)`. The HNSW index at `chunks_embedding_hnsw_idx` must also be dropped and recreated. This migration MUST be the first task in this phase's Wave 0.

**Primary recommendation:** Migrate schema to `vector(1024)`, use `output_dimension=1024`, batch-embed per document in one Voyage call, store via supabase service client, and stream Claude responses via `ReadableStream` piped through the Next.js route handler.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `voyageai` | 0.2.1 | Generate embeddings via voyage-3-large API | Locked decision; best multilingual EN/BM/ZH retrieval |
| `@anthropic-ai/sdk` | 0.80.0 | Claude Haiku intent+language detection + streaming chat | Already in project; official SDK |
| `pdf-parse` | 2.4.5 | Extract text from PDF files | Locked decision; pure JS, no native deps |
| `mammoth` | 1.12.0 | Extract text from DOCX files | Locked decision; `extractRawText({buffer})` returns clean text |
| `papaparse` | 5.5.3 | Parse CSV files for product bulk import | Standard CSV library; TypeScript support; header mode |
| `@supabase/supabase-js` | latest | Storage uploads, RPC calls, DB inserts | Already installed; service client in `lib/supabase/service.ts` |
| `gpt-tokenizer` | 3.4.0 | Token-accurate chunking (cl100k_base tokenizer) | Pure JS, no WASM; BPE tokenizer compatible with Claude token counts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `js-tiktoken` | 1.0.21 | Alternative tokenizer if gpt-tokenizer causes issues | Fallback; WASM-based, slightly heavier |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `gpt-tokenizer` | `@anthropic-ai/sdk` token counting | SDK counts tokens via API call (has cost + latency); gpt-tokenizer is local and instant |
| `voyageai` SDK | Raw `fetch` to Voyage API | SDK handles retry + type safety; fetch is fine but more boilerplate |
| `papaparse` | `csv-parse` (Node stream) | papaparse simpler for one-shot in-memory CSV; csv-parse better for streaming large files (not needed at this scale) |

**Installation (new packages only):**
```bash
npm install voyageai pdf-parse mammoth papaparse gpt-tokenizer
npm install --save-dev @types/pdf-parse @types/mammoth @types/papaparse
```

**Version verification (run before pinning):**
```bash
npm view voyageai version          # 0.2.1 verified 2026-03-19
npm view pdf-parse version         # 2.4.5 verified 2026-03-19
npm view mammoth version           # 1.12.0 verified 2026-03-19
npm view papaparse version         # 5.5.3 verified 2026-03-19
npm view gpt-tokenizer version     # 3.4.0 verified 2026-03-19
```

---

## Architecture Patterns

### Recommended Project Structure
```
app/api/
├── ingest/[botId]/
│   ├── route.ts           # POST: create document record, return signed Storage URL
│   └── process/
│       └── route.ts       # POST: download from Storage, extract, chunk, embed, store
├── chat/[botId]/
│   └── route.ts           # POST: intent/lang detect, FAQ check, RAG, Claude stream
└── products/[botId]/
    └── route.ts           # GET/POST: list products, manual create, CSV bulk import

lib/
├── ingest/
│   ├── extractor.ts       # pdf-parse + mammoth + txt extraction
│   ├── chunker.ts         # token-based chunking with overlap
│   └── embedder.ts        # VoyageAI batch embed wrapper
├── rag/
│   ├── retrieve.ts        # match_chunks + FAQ matching RPC wrappers
│   └── chat.ts            # intent+lang detect, context assembly, Claude stream
└── supabase/
    ├── service.ts          # (existing) service role client
    └── server.ts           # (existing) session client

supabase/migrations/
├── 00006_products.sql     # products table + RLS + HNSW index
└── 00007_schema_fix.sql   # ALTER chunks.embedding from vector(1536) to vector(1024)
                           # (or combined into 00006 if done before any data exists)
```

### Pattern 1: Two-Step File Upload (Bypass Vercel 4.5 MB Limit)

**What:** Instead of sending the file through a Next.js API route (4.5 MB Vercel body limit), the client requests a signed upload URL from the server and uploads directly to Supabase Storage. Only a small metadata JSON is sent through the API route.

**When to use:** All file uploads. Required when file size may exceed 4.5 MB.

**Step 1 — Create document record and return signed URL:**
```typescript
// app/api/ingest/[botId]/route.ts
// Source: https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
export async function POST(req: Request, { params }: { params: { botId: string } }) {
  const supabase = createServiceClient()
  const body = await req.json()
  // body: { filename, category, contentType }

  // 1. Create document record with status=pending
  const { data: doc } = await supabase
    .from('documents')
    .insert({ bot_id: params.botId, filename: body.filename, category: body.category, status: 'pending' })
    .select()
    .single()

  // 2. Generate signed upload URL (valid 2 hours)
  const storagePath = `${params.botId}/${doc.id}/${body.filename}`
  const { data: signedData } = await supabase.storage
    .from('bot-files')
    .createSignedUploadUrl(storagePath)

  return Response.json({ documentId: doc.id, signedUrl: signedData.signedUrl, token: signedData.token, path: storagePath })
}
```

**Step 2 — Client uploads directly to Storage, then triggers processing:**
```typescript
// Client-side: upload file using the signed URL
await supabase.storage.from('bot-files').uploadToSignedUrl(path, token, file)

// Then POST to trigger processing
await fetch(`/api/ingest/${botId}/process`, { method: 'POST', body: JSON.stringify({ documentId }) })
```

**Step 3 — Process route (download → extract → chunk → embed → store):**
```typescript
// app/api/ingest/[botId]/process/route.ts
// 1. Set status = processing
// 2. Download file from Storage: supabase.storage.from('bot-files').download(storagePath)
// 3. Extract text based on MIME type
// 4. Chunk into 500-token pieces with 50-token overlap
// 5. Batch-embed all chunks in one Voyage API call
// 6. Bulk insert into chunks table
// 7. Update document: status=ready, chunk_count=N
```

### Pattern 2: Token-Based Chunking with Overlap

**What:** Split extracted text into chunks of exactly 500 tokens with 50-token overlap. Use gpt-tokenizer (cl100k_base) for BPE token counting — not character counting.

**When to use:** Always for text chunking in KB-02.

```typescript
// lib/ingest/chunker.ts
// Source: https://github.com/niieani/gpt-tokenizer
import { encode, decode } from 'gpt-tokenizer'

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const tokens = encode(text)
  const chunks: string[] = []
  let start = 0

  while (start < tokens.length) {
    const end = Math.min(start + chunkSize, tokens.length)
    chunks.push(decode(tokens.slice(start, end)))
    start += chunkSize - overlap  // advance by (chunkSize - overlap)
    if (start >= tokens.length) break
  }

  return chunks
}
```

### Pattern 3: Voyage AI Batch Embedding

**What:** Embed all chunks for a document in a single API call. Use `input_type: 'document'` for storage, `input_type: 'query'` for search queries.

**CRITICAL:** voyage-3-large supports dimensions 256, 512, 1024, 2048 ONLY. Use `output_dimension: 1024`. Schema must use `vector(1024)`.

```typescript
// lib/ingest/embedder.ts
// Source: https://docs.voyageai.com/reference/embeddings-api
import { VoyageAIClient } from 'voyageai'

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! })

// For documents (ingestion time)
export async function embedDocumentChunks(texts: string[]): Promise<number[][]> {
  const result = await voyage.embed({
    input: texts,
    model: 'voyage-3-large',
    inputType: 'document',
    outputDimension: 1024,
  })
  return result.embeddings as number[][]
}

// For queries (RAG retrieval time)
export async function embedQuery(query: string): Promise<number[]> {
  const result = await voyage.embed({
    input: [query],
    model: 'voyage-3-large',
    inputType: 'query',
    outputDimension: 1024,
  })
  return result.embeddings[0] as number[]
}
```

### Pattern 4: pgvector Semantic Search via Supabase RPC

**What:** Define a SQL function `match_chunks` in a migration; call it via `supabase.rpc()`. Cosine distance with threshold filtering.

```sql
-- In migration 00008_rag_functions.sql
-- Source: https://supabase.com/docs/guides/ai/semantic-search
create or replace function match_chunks(
  query_embedding extensions.vector(1024),
  match_threshold float,
  match_count int,
  p_bot_id uuid
)
returns table(id uuid, content text, document_id uuid, similarity float)
language sql
as $$
  select
    c.id,
    c.content,
    c.document_id,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where
    c.bot_id = p_bot_id
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding asc
  limit least(match_count, 20);
$$;

-- FAQ semantic match function
create or replace function match_faqs(
  query_embedding extensions.vector(1024),
  match_threshold float,
  match_count int,
  p_bot_id uuid
)
returns table(id uuid, question text, answer text, language text, similarity float)
language sql
as $$
  select
    f.id,
    f.question,
    f.answer,
    f.language,
    1 - (f.embedding <=> query_embedding) as similarity
  from public.faqs f
  where
    f.bot_id = p_bot_id
    and f.embedding is not null
    and 1 - (f.embedding <=> query_embedding) >= match_threshold
  order by f.embedding <=> query_embedding asc
  limit least(match_count, 5);
$$;
```

```typescript
// lib/rag/retrieve.ts
const { data: chunks } = await supabase.rpc('match_chunks', {
  query_embedding: queryEmbedding,
  match_threshold: 0.75,
  match_count: 5,
  p_bot_id: botId,
})
```

### Pattern 5: Claude Haiku Intent + Language Detection

**What:** Single Haiku call returns structured JSON with `language` and `intent`. Not a streaming call — must complete before RAG retrieval begins.

```typescript
// lib/rag/chat.ts
// Source: https://platform.claude.com/docs/en/api/sdks/typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function detectIntentAndLanguage(message: string) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-20241022',
    max_tokens: 100,
    messages: [{ role: 'user', content: message }],
    system: `You are a language and intent classifier. Respond with ONLY a JSON object.
Classify the user message into:
- language: "en" | "bm" | "zh"
- intent: "browse_product" | "health_issue" | "book_session" | "faq" | "general"

Example: {"language":"en","intent":"browse_product"}`,
  })
  return JSON.parse((response.content[0] as { type: 'text'; text: string }).text)
  // Returns: { language: 'en', intent: 'browse_product' }
}
```

### Pattern 6: Claude Haiku Streaming Response

**What:** Use `client.messages.create({ stream: true })` and pipe to a Web `ReadableStream` for the Next.js route response.

```typescript
// app/api/chat/[botId]/route.ts
// Source: https://platform.claude.com/docs/en/api/sdks/typescript
export async function POST(req: Request) {
  const startTime = Date.now()
  // ... detect intent, retrieve chunks ...

  const stream = await anthropic.messages.create({
    model: 'claude-haiku-20241022',
    max_tokens: 1024,
    stream: true,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }
      controller.close()
      // After stream ends: log message with latency_ms = Date.now() - startTime
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  })
}
```

### Pattern 7: Products Table + CSV Bulk Import

**What:** Products have structured fields; they are also embedded as chunks for semantic search. CSV import uses papaparse to parse rows and then batch-inserts both products and their chunk embeddings.

```typescript
// CSV import pattern
// Source: https://www.papaparse.com/docs
import Papa from 'papaparse'

const result = Papa.parse<ProductRow>(csvText, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false,
})
// result.data is ProductRow[]
```

### Anti-Patterns to Avoid

- **Streaming embeddings one-by-one:** Always batch per document. One API call per chunk creates rate limit issues and is ~50x slower.
- **Embedding at query time without `inputType: 'query'`:** Omitting `inputType` slightly degrades retrieval quality. Always set `inputType: 'document'` for stored chunks and `inputType: 'query'` for search queries.
- **Using character-count chunking instead of token-count:** 500 characters != 500 tokens. Always use gpt-tokenizer's BPE encoder.
- **Service client in browser code:** `createServiceClient()` uses `SUPABASE_SERVICE_ROLE_KEY`. Never expose via `NEXT_PUBLIC_` env vars. Only call from server-side API routes.
- **Missing `bot_id` scope in RPC functions:** Every DB operation — including RPC functions — must filter by `bot_id`. Omitting it leaks data across tenants.
- **Routing file through Next.js for large uploads:** Always use the signed URL pattern. Vercel rejects request bodies > 4.5 MB.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom word/char splitter | `gpt-tokenizer` (encode/decode) | BPE tokenization is complex; word counting gives wrong token boundaries |
| PDF text extraction | PDF binary parser | `pdf-parse` | PDF format is a minefield of compression formats, fonts, encodings |
| DOCX text extraction | XML zip parser | `mammoth.js` | DOCX is a complex XML spec with many edge cases (tables, tracked changes) |
| CSV parsing | Manual string split | `papaparse` | RFC 4180 has quoting/escaping rules; manual parsing breaks on quoted commas |
| Cosine similarity search | Manual vector distance calc | pgvector + HNSW index | PostgreSQL HNSW index does approximate nearest-neighbour in O(log n) |
| Signed upload URL generation | Custom presigned URL | Supabase Storage `createSignedUploadUrl` | Supabase handles token signing, expiry, bucket policy enforcement |

**Key insight:** Chunking and tokenization are the most deceptively complex problem here — the BPE tokenizer for "500 tokens" produces very different boundaries than naive word or character splitting.

---

## Common Pitfalls

### Pitfall 1: voyage-3-large Does NOT Support `output_dimension=1536`
**What goes wrong:** Voyage API returns a 422 or silently uses default 1024 when you request 1536. All stored embeddings then differ from your schema dimension causing insert failures or silent dimensionality mismatches.
**Why it happens:** The existing schema used `vector(1536)` (originally sized for OpenAI `text-embedding-ada-002`). voyage-3-large supports only 256, 512, 1024, 2048.
**How to avoid:** Migration `00007_schema_fix.sql` must `ALTER TABLE chunks ALTER COLUMN embedding TYPE extensions.vector(1024)` and drop+recreate the HNSW index. Set `outputDimension: 1024` in all embed calls. **This is the first migration to run in Wave 0.**
**Warning signs:** Supabase insert error "expected 1024 dimensions, not 1536" OR voyage returns embeddings of length 1024 that silently fail to match schema length 1536.

### Pitfall 2: Vercel 4.5 MB Body Limit for File Uploads
**What goes wrong:** A 5 MB PDF uploaded through the Next.js API route throws a 413 body size error in production even though it works locally.
**Why it happens:** Vercel serverless functions hard-cap request body at 4.5 MB. The 10 MB file limit is only achievable by bypassing the API route body entirely.
**How to avoid:** Use the two-step pattern: API route creates the document record and returns a signed upload URL → client uploads directly to Supabase Storage → separate API call triggers processing.
**Warning signs:** Upload works on `localhost:3000` but returns 413 on Vercel deployment.

### Pitfall 3: PDF-Parse Returns Empty Text for Scanned PDFs
**What goes wrong:** A scanned/image PDF passes the upload step but produces empty or near-empty text after extraction, resulting in zero chunks being stored.
**Why it happens:** pdf-parse can only extract text from PDFs with embedded text streams. Scanned documents are images inside PDFs — no extractable text.
**How to avoid:** After extraction, check `if (extractedText.trim().length < 100)` → set document status to `failed` with error message "Scanned PDFs are not supported — please upload a text-based PDF". (Locked decision in CONTEXT.md.)
**Warning signs:** `data.text` from pdf-parse is empty string or just whitespace characters.

### Pitfall 4: Processing Route Has No Timeout Guard on Vercel
**What goes wrong:** Large documents with many chunks take > 10 seconds to extract + embed + store, causing the Vercel function to time out mid-processing, leaving the document stuck in `processing` status.
**Why it happens:** Vercel Hobby/Pro default function timeout is 10-15 seconds. Voyage batch embedding of 50+ chunks + DB bulk insert can exceed this.
**How to avoid:** Add `export const maxDuration = 60` to the process route (requires Vercel Pro or higher). Alternatively, limit document size to keep processing time under 10s. For the 10 MB limit with 500-token chunks, a 10 MB text file could generate ~5000+ chunks — batch them into groups of 128.
**Warning signs:** Document status stuck at `processing` after upload; CloudWatch/Vercel logs show function timeout.

### Pitfall 5: Inconsistent `inputType` Between Ingestion and Retrieval
**What goes wrong:** Chunks stored with `inputType: 'document'` and queries embedded without `inputType` (or with `inputType: 'document'`) produce lower cosine similarity scores than expected, causing more misses than necessary.
**Why it happens:** voyage-3-large prepends different instructional prompts for 'document' vs 'query' mode. Mismatching modes degrades retrieval accuracy.
**How to avoid:** Always use `inputType: 'document'` in `embedder.ts` (ingestion). Always use `inputType: 'query'` in the RAG retrieval embed call. FAQs stored with `inputType: 'document'`; FAQ queries use `inputType: 'query'`.
**Warning signs:** Cosine similarity scores consistently lower than 0.75 even for obviously relevant documents.

### Pitfall 6: Message Logging After Streaming Starts
**What goes wrong:** Attempting to log the message (with source_chunks and latency_ms) inside the streaming loop writes partial data because the stream hasn't ended when the first log fires.
**Why it happens:** Streaming sends response tokens while RAG retrieval data is already known but latency isn't final until stream ends.
**How to avoid:** Collect all RAG metadata before streaming begins. Log the message AFTER the stream finishes (inside the ReadableStream `start()` callback after `controller.close()`). Pass accumulated text via closure.
**Warning signs:** `latency_ms` is always 0 or very small; `source_chunks` is null in logs.

### Pitfall 7: faqs Table Missing `embedding` Column
**What goes wrong:** FAQ semantic matching requires a vector column on `faqs`, but the current schema (`00002_schema.sql`) only has `question`, `answer`, `language` columns — no `embedding` column.
**Why it happens:** Phase 1 schema was built before the FAQ embedding decision was made.
**How to avoid:** Migration `00006_products.sql` or a separate `00008_faq_embeddings.sql` must add `embedding extensions.vector(1024)` to `faqs` table, plus an HNSW index and a `match_faqs` RPC function.
**Warning signs:** `ERROR: column "embedding" of relation "faqs" does not exist` on FAQ embed attempt.

---

## Code Examples

### Supabase Storage Bucket Creation (one-time setup)
```sql
-- Run in Supabase Studio or a seed script — NOT in a migration
-- Private bucket (service role uploads only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bot-files',
  'bot-files',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
);
```

### DOCX Extraction with Mammoth
```typescript
// Source: https://www.npmjs.com/package/mammoth
import mammoth from 'mammoth'

export async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value  // plain text, paragraphs separated by \n\n
}
```

### PDF Extraction with pdf-parse
```typescript
// Source: https://www.npmjs.com/package/pdf-parse
import pdfParse from 'pdf-parse'

export async function extractPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  if (data.text.trim().length < 100) {
    throw new Error('Scanned PDFs are not supported — please upload a text-based PDF')
  }
  return data.text
}
```

### Schema Migration: Fix Dimension + Add Products + Add FAQ Embedding
```sql
-- 00006_products_and_schema_fix.sql
-- CRITICAL: run before any embeddings are stored

-- Fix dimension mismatch: voyage-3-large max is 2048, default is 1024
-- Drop HNSW index first (can't alter vector column with active index)
drop index if exists chunks_embedding_hnsw_idx;
alter table public.chunks
  alter column embedding type extensions.vector(1024)
  using null;  -- clear any existing test data (Phase 1 had none)

-- Recreate HNSW index for 1024-dim
create index chunks_embedding_hnsw_idx
  on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Add embedding column to faqs
alter table public.faqs
  add column if not exists embedding extensions.vector(1024);

create index faqs_embedding_hnsw_idx
  on public.faqs
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Products table
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  bot_id            uuid not null references public.bots(id) on delete cascade,
  name              text not null,
  description       text,
  key_ingredients   text,
  health_benefits   text,
  pricing           text,
  suggested_usage   text,
  category          text not null default 'Other'
                    check (category in ('Beauty','FMCG','GenQi','Healthfood','Home Appliances','Other')),
  created_at        timestamptz default now()
);

-- Products also embedded for RAG
alter table public.products
  add column embedding extensions.vector(1024);

create index products_embedding_hnsw_idx
  on public.products
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index products_bot_id_idx on public.products (bot_id);

-- RLS on products
alter table public.products enable row level security;

create policy "products_tenant_isolation" on public.products
  for all to authenticated
  using (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  )
  with check (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  );
```

### match_chunks RPC Function
```sql
-- 00007_rag_functions.sql
create or replace function match_chunks(
  query_embedding extensions.vector(1024),
  match_threshold float,
  match_count int,
  p_bot_id uuid
)
returns table(id uuid, content text, document_id uuid, similarity float)
language sql
as $$
  select
    c.id,
    c.content,
    c.document_id,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where
    c.bot_id = p_bot_id
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding asc
  limit least(match_count, 20);
$$;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAI `text-embedding-ada-002` (1536-dim) | voyage-3-large (1024-dim recommended) | 2024-2025 | Better multilingual quality; different schema dimension required |
| langchain/langchain for RAG plumbing | Direct pgvector RPC calls | 2024 | LangChain adds 300+ KB to bundle; direct supabase.rpc() is lighter and fully controlled |
| Python ingestion worker (Railway) | Next.js API routes | Locked for v1 | Simpler deployment; timeout risk on large documents is manageable |
| Python Pages Router API routes | App Router route handlers (route.ts) | Next.js 13+ | App Router is the current standard; Pages Router is legacy |
| `middleware.ts` | `proxy.ts` | Next.js 16 | This project already uses proxy.ts (confirmed Phase 1) |

**Deprecated/outdated:**
- LangChain RAG pipeline: heavy dependency, unnecessary abstraction at this scale
- Pinecone/Weaviate: Supabase pgvector is already available; no extra infra needed
- Python Railway worker: locked out of scope for v1

---

## Open Questions

1. **Vercel Function Timeout for Large Document Processing**
   - What we know: Default Vercel timeout is 10-15 seconds; Hobby plan is 10s, Pro is 60s configurable
   - What's unclear: Current Vercel plan tier for this project
   - Recommendation: Add `export const maxDuration = 60` to process route; document that Pro tier is required for >50-chunk documents. Alternatively cap processing batch size and return early with status polling.

2. **voyage-3-large `output_dimension` Parameter Name**
   - What we know: Voyage AI docs use `output_dimension` (singular); the npm SDK 0.2.1 TypeScript types may use `outputDimension` (camelCase)
   - What's unclear: Exact parameter name in the 0.2.1 TS SDK — docs show snake_case for REST, SDK may camelCase
   - Recommendation: Implement and verify with a quick test call during Wave 0 setup. The official GitHub README shows `outputDimension` in TypeScript examples.

3. **Supabase Storage Bucket Configuration**
   - What we know: Bucket must be created (not in existing migrations); service role bypasses RLS for storage
   - What's unclear: Whether to create bucket in migration SQL or in a separate seed script
   - Recommendation: Create in a seed/setup script (not migration) since bucket config is environment-specific. Document as a manual setup step in the phase.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently installed — Wave 0 must add |
| Config file | `jest.config.ts` — Wave 0 creates this |
| Quick run command | `npx jest --testPathPattern=unit --passWithNoTests` |
| Full suite command | `npx jest --passWithNoTests` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KB-02 | `chunkText()` returns correct chunk count and overlap for known input | unit | `npx jest tests/unit/chunker.test.ts -x` | ❌ Wave 0 |
| KB-02 | `extractPdf()` rejects scanned PDF (text < 100 chars) | unit | `npx jest tests/unit/extractor.test.ts -x` | ❌ Wave 0 |
| KB-04 | Process route sets status=failed on extraction error | integration | `npx jest tests/integration/ingest.test.ts -x` | ❌ Wave 0 |
| RAG-09 | `match_chunks` returns empty array when similarity < 0.75 | unit | `npx jest tests/unit/rag.test.ts -x` | ❌ Wave 0 |
| RAG-10 | Message log contains all required fields (role, intent, source_chunks, rag_found, latency_ms) | unit | `npx jest tests/unit/message-log.test.ts -x` | ❌ Wave 0 |
| RAG-02/03 | Intent+language detection returns valid JSON with correct fields | unit | `npx jest tests/unit/chat.test.ts -x` (mock Anthropic) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --passWithNoTests`
- **Per wave merge:** `npx jest --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `jest.config.ts` — Jest config for TypeScript (ts-jest or babel-jest)
- [ ] `tests/unit/chunker.test.ts` — covers KB-02 chunking logic
- [ ] `tests/unit/extractor.test.ts` — covers KB-02 PDF/DOCX extraction + scanned PDF rejection
- [ ] `tests/unit/rag.test.ts` — covers RAG-09 threshold logic
- [ ] `tests/unit/message-log.test.ts` — covers RAG-10 logging schema
- [ ] `tests/unit/chat.test.ts` — covers RAG-02/03 intent classification (mock Anthropic)
- [ ] Framework install: `npm install --save-dev jest ts-jest @types/jest`

---

## Sources

### Primary (HIGH confidence)
- [Voyage AI Embeddings API Reference](https://docs.voyageai.com/reference/embeddings-api) — output_dimension supported values for voyage-3-large confirmed (1024 default, NOT 1536)
- [Voyage AI Embeddings Docs](https://docs.voyageai.com/docs/embeddings) — input_type parameter, max batch size (1000), model capabilities
- [Anthropic TypeScript SDK](https://platform.claude.com/docs/en/api/sdks/typescript) — streaming API, messages.create with stream:true, error handling
- [Supabase Semantic Search Docs](https://supabase.com/docs/guides/ai/semantic-search) — match_documents RPC pattern, cosine distance formula
- [Supabase Signed Upload URL](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) — two-step upload pattern
- `supabase/migrations/00002_schema.sql` — existing tables, columns confirmed
- `supabase/migrations/00004_indexes.sql` — existing HNSW index confirmed (vector_cosine_ops)
- `package.json` — confirmed installed packages and versions

### Secondary (MEDIUM confidence)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) — 4.5 MB body limit confirmed
- [mammoth npm](https://www.npmjs.com/package/mammoth) — `extractRawText({buffer})` API confirmed
- [pdf-parse npm](https://www.npmjs.com/package/pdf-parse) — `data.text` output confirmed, scanned PDF limitation
- [gpt-tokenizer GitHub](https://github.com/niieani/gpt-tokenizer) — encode/decode API for BPE chunking
- [papaparse docs](https://www.papaparse.com/docs) — CSV parse API with header mode

### Tertiary (LOW confidence)
- WebSearch findings on Next.js multipart formData handling — pattern is well-established but not tested against project's Next.js 16

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry 2026-03-19
- Architecture: HIGH — patterns verified against official Supabase + Anthropic + Voyage docs
- Pitfalls: HIGH — voyage-3-large dimension issue confirmed via official docs; Vercel limit confirmed via official docs
- Schema migration: HIGH — vector column dimension change requirements confirmed via pgvector docs

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (30 days — stack is reasonably stable; re-verify Voyage SDK version before install)

---

## Critical Pre-Planning Note

The CONTEXT.md states `output_dimension=1536` to match the existing schema. This is incorrect — voyage-3-large does not support 1536. The planning phase MUST:

1. Create migration `00006_products_and_schema_fix.sql` as the FIRST wave task to:
   - Drop `chunks_embedding_hnsw_idx`
   - Alter `chunks.embedding` from `vector(1536)` to `vector(1024)`
   - Recreate the HNSW index
   - Add `embedding vector(1024)` to `faqs` table
   - Create `products` table with `embedding vector(1024)`
2. All embed calls use `outputDimension: 1024` (NOT 1536)
3. Update `types/database.ts` Chunk type if needed

This is a zero-data migration (Phase 1 stores no chunks) so `using null` is safe to clear any test vectors.
