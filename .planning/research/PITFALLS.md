# Domain Pitfalls

**Domain:** Multi-tenant AI chatbot SaaS (Next.js 14 App Router + Supabase + Claude API + pgvector)
**Project:** Multi-Tenant AI Chatbot SaaS Platform (Elken / Ask Ethan Digital)
**Researched:** 2026-03-18
**Confidence:** HIGH (domain-specific from known failure patterns in this exact stack)

---

## Critical Pitfalls

Mistakes that cause rewrites, data leakage, or security incidents.

---

### Pitfall 1: Multi-Tenancy Data Leakage via Missing bot_id Scoping

**What goes wrong:** A developer forgets to add `WHERE bot_id = $1` to a query. In a multi-tenant system, this silently returns data from ALL tenants. A user of Tenant A can see knowledge base chunks, FAQs, or conversation history from Tenant B.

**Why it happens:** Early in development, there is only one tenant (Elken). Queries "work" without scoping. When Tenant 2 onboards, the missing filter leaks data silently — no error is thrown.

**Consequences:** PDPA/data privacy violation, complete trust collapse, possible security incident. Multi-tenancy is only as strong as the weakest query.

**Prevention:**
- Add a Supabase RLS policy on every table that has a `bot_id` column: `USING (bot_id = current_setting('app.bot_id')::uuid)`. This makes the database enforce isolation even if application code misses it.
- Never bypass RLS with the service role key in chat/query endpoints — use the anon key with RLS for all tenant-scoped reads.
- Write a test that creates two tenants, seeds data for both, and asserts a query scoped to Tenant A returns zero rows from Tenant B.
- Reserve service role key exclusively for admin operations and ingestion pipeline, never for webhook/chat handlers.

**Detection (warning signs):**
- A query returns more rows than expected in local dev.
- Total knowledge base chunks count is suspiciously high for a new tenant.
- Integration test with two tenants does not exist.

**Phase to address:** Foundation / database schema phase — before any feature work. RLS policies must be schema-level commitments, not afterthoughts.

---

### Pitfall 2: Supabase RLS Policies That Kill Query Performance

**What goes wrong:** RLS policies that call `auth.uid()` or reference subqueries on every row cause full table scans. On the `chunks` table with 100K+ vectors, a policy like `USING (bot_id IN (SELECT bot_id FROM bots WHERE owner_id = auth.uid()))` executes a subquery per row.

**Why it happens:** Supabase's auth helpers make it easy to write `auth.uid()` without thinking about execution cost. Works fine at small scale, breaks at prod scale.

**Consequences:** Chat endpoint latency spikes from 100ms to 2-5s at moderate data volumes. The pgvector similarity search is fast; the RLS wrapper destroys that gain.

**Prevention:**
- Use `current_setting('app.bot_id')` as a session-level variable set at the start of each request rather than joining through auth tables.
- For service-role operations (ingestion pipeline), bypass RLS explicitly and enforce `bot_id` at application layer with a typed wrapper function.
- Profile all RLS-enabled queries with `EXPLAIN ANALYZE` before shipping. Look for "Rows Removed by Policy" being large.
- Index every `bot_id` column: `CREATE INDEX ON chunks(bot_id)`. Without this, RLS filters do sequential scans.

**Detection (warning signs):**
- `EXPLAIN ANALYZE` shows "Rows Removed by Policy" > 0 on large tables.
- Chat endpoint p99 latency is high but pgvector search alone is fast.
- Supabase Dashboard slow query log shows RLS-related subqueries.

**Phase to address:** Database schema phase. Add indexes and profile policies before the RAG endpoint is built.

---

### Pitfall 3: pgvector HNSW Index Not Created — Sequential Scan on Every Query

**What goes wrong:** Without an HNSW (or IVFFlat) index, pgvector falls back to exact nearest-neighbour search (sequential scan). This is O(n) over all vectors. Fine at 1,000 chunks, unacceptably slow at 50,000+.

**Why it happens:** `CREATE INDEX` for pgvector uses non-standard syntax. Developers create the vector column, test it with 20 chunks, ship, and never add the index. The problem only emerges after real ingestion.

**Consequences:** Semantic search latency degrades from milliseconds to multiple seconds as knowledge base grows. No error is surfaced — it just gets slower.

**Prevention:**
- Create the HNSW index in the initial migration, not as an afterthought:
  ```sql
  CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
  ```
- Set `ef_search` at query time for quality/speed tradeoff: `SET hnsw.ef_search = 100;`
- Note: HNSW index build is memory-intensive. On Supabase free tier, build it on a small dataset first to confirm the instance has enough memory.
- For multi-tenant: consider a partial index per bot if one tenant dominates volume, or ensure queries always include `bot_id` filter before the vector search so Postgres can prune the index scan.

**Detection (warning signs):**
- `EXPLAIN ANALYZE` shows "Seq Scan on chunks" instead of "Index Scan".
- Semantic search latency increases linearly as documents are ingested.
- `\d chunks` in psql shows no index on the `embedding` column.

**Phase to address:** Database schema phase — include in the initial migration file. Do not wait until RAG endpoint phase.

---

### Pitfall 4: Embedding Dimension Mismatch Between Ingestion and Query

**What goes wrong:** Documents are embedded with one model (e.g., `voyage-3` at 1024 dims) and queries are embedded with another (e.g., `text-embedding-3-small` at 1536 dims). Or the same model is used but the vector column was created with `vector(1536)` while voyage-3 outputs `vector(1024)`. The error is either a silent wrong result (if dims match by coincidence) or a Postgres error on insert.

**Why it happens:** The embedding model is configured in one place for ingestion and another for query time. A config change in one place doesn't propagate to the other. This is especially risky during model migration.

**Consequences:** Cosine similarity scores are nonsensical (all near 0 or near 1). RAG returns completely wrong context chunks. Claude responds with hallucinated or irrelevant answers.

**Prevention:**
- Define the embedding model and dimension as a single shared constant: `EMBEDDING_MODEL = 'voyage-3'` and `EMBEDDING_DIM = 1024`. Both ingestion and query code import from this single source of truth.
- Assert at startup: query the vector column's declared dimension from `pg_attribute` and throw if it doesn't match `EMBEDDING_DIM`.
- Never change embedding model without re-embedding the entire knowledge base. Document this as a breaking migration.
- Use a migration guard: store `embedding_model` in a `bot_config` table. Refuse to ingest if `bot_config.embedding_model` differs from the current model.

**Detection (warning signs):**
- Cosine similarity scores for clearly relevant queries are unexpectedly low (< 0.5) or uniform.
- RAG returns chunks from the wrong topic regardless of query.
- Postgres throws `ERROR: different vector dimensions` on insert.

**Phase to address:** RAG/knowledge base phase — establish the embedding constant before any ingestion code is written.

---

### Pitfall 5: Cosine Similarity Threshold Too Permissive — Hallucination Via Irrelevant Context

**What goes wrong:** The RAG retrieval uses `ORDER BY embedding <=> query_embedding LIMIT 5` with no similarity threshold. The top-5 chunks are always returned, even when the most similar chunk has a cosine similarity of 0.2 (essentially random). Claude is given garbage context and confidently hallucinates an answer.

**Why it happens:** Developers test RAG with queries that are always in-domain ("what is GenQi?"). Off-topic queries ("what is the capital of France?") are never tested during development. In production, real users ask off-topic questions constantly.

**Consequences:** The bot confidently answers questions it should deflect, using irrelevant chunks as fabricated evidence. This is particularly bad for Elken's regulated health products context.

**Prevention:**
- Add a minimum similarity threshold: `WHERE 1 - (embedding <=> query_embedding) >= 0.65`. Tune this empirically with real Elken queries.
- When zero chunks meet the threshold, route to the fallback response defined in personality config — do not pass empty context to Claude.
- Log the top similarity score for every query. Analyse the distribution before setting the threshold in production.
- Consider a two-tier threshold: above 0.75 = use RAG context, 0.60-0.75 = use RAG context but add disclaimer, below 0.60 = fallback only.

**Detection (warning signs):**
- Testing console shows low similarity scores (< 0.5) for clearly relevant queries.
- Bot answers questions well outside the knowledge base without deflecting.
- Similarity score distribution is flat/uniform across all queries.

**Phase to address:** RAG endpoint phase — before connecting to Claude. Validate retrieval quality in isolation first.

---

### Pitfall 6: Multi-Language RAG Failure — BM (Bahasa Malaysia) Embeddings Are Poor

**What goes wrong:** Most embedding models (including voyage-3) are trained predominantly on English text. BM queries produce embeddings that are semantically distant from BM document chunks, even when the content is identical in meaning. English queries find English chunks reliably; BM queries miss relevant BM/EN chunks frequently.

**Why it happens:** BM is a low-resource language in most training corpora. Developers test RAG with English, declare it working, then deploy to BM-speaking users who get consistently worse results. The problem is invisible unless you test by language.

**Consequences:** BM users get worse chatbot responses than EN users, despite using the same knowledge base. This is the primary user cohort for Elken in Malaysia.

**Prevention:**
- Test retrieval precision/recall separately per language (EN, BM, ZH) with a fixed test query set before launch.
- For BM queries, consider query expansion: translate the BM query to EN, embed both, and retrieve using both embeddings (union, deduplicated by chunk_id, re-ranked by max score).
- Store chunks in both original language AND English translation where feasible, so English-dominant embeddings can retrieve them via EN translation but Claude responds in the original language.
- Consider voyage-3's multilingual capabilities — it has better non-English support than `text-embedding-3-small`. Verify with actual BM test queries before committing.
- Language-specific FAQ injection (already planned) is a good mitigation: high-value BM queries hit the FAQ table first (exact/fuzzy match), bypassing the embedding problem.

**Detection (warning signs):**
- Testing console shows lower similarity scores for BM queries than equivalent EN queries.
- BM users trigger "I don't know" fallback responses at higher rates than EN users.
- User feedback or n8n logs show BM conversations being escalated more often.

**Phase to address:** RAG endpoint phase. Create a multilingual test suite before connecting Claude.

---

### Pitfall 7: Streaming Response Breaks on Vercel — Connection Timeout or Buffering

**What goes wrong:** Next.js 14 App Router streaming with `ReadableStream` works locally but on Vercel the response is either buffered (user sees nothing until complete) or times out after 10 seconds (Vercel's default function timeout). Claude haiku responses for complex queries can exceed 10s.

**Why it happens:** Vercel serverless functions have a maximum execution timeout. The Streaming API requires a persistent connection. Vercel Edge Runtime handles streaming differently from Node.js runtime — wrong runtime choice silently kills streaming.

**Consequences:** Chat feels broken. Users see a blank response or loading spinner that never resolves. The experience matches a broken product even if Claude is working correctly.

**Prevention:**
- Use `export const runtime = 'edge'` on the chat API route. Edge functions have no cold start, lower latency, and handle streaming natively.
- Set `export const maxDuration = 30` for non-edge functions if edge is not feasible.
- Use the `StreamingTextResponse` pattern from Vercel AI SDK if applicable, or set correct headers manually: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
- Test streaming specifically on Vercel preview deployments, not just locally, before considering the feature complete.
- Implement a client-side timeout: if no tokens received within 8s, show an error state rather than an infinite spinner.

**Detection (warning signs):**
- Works locally, fails/buffers on Vercel preview.
- Vercel function logs show `Function execution timeout`.
- Response `Content-Type` is `application/json` instead of `text/event-stream` in network tab.

**Phase to address:** RAG chat endpoint phase — test on Vercel immediately after implementing streaming locally.

---

### Pitfall 8: Booking State Machine Race Conditions — Double-Booking on Concurrent Requests

**What goes wrong:** Two users (or one user with a double-tap) submit a booking request at the same time for the last available slot. Both requests check slot availability, find 1 slot free, and both proceed to confirm. The slot is now double-booked.

**Why it happens:** The availability check and reservation are two separate operations. Without a database-level lock or atomic compare-and-swap, a race window exists between check and reserve.

**Consequences:** Overbooking at the GenQi facility. Physical conflict when two people arrive for the same slot. Loss of trust in the booking system.

**Prevention:**
- Use a `SELECT ... FOR UPDATE` lock when checking and reserving a slot, inside a single database transaction:
  ```sql
  BEGIN;
  SELECT id, current_bookings, capacity
  FROM slots
  WHERE slot_id = $1 AND current_bookings < capacity
  FOR UPDATE;
  -- If row returned: UPDATE slots SET current_bookings = current_bookings + 1 WHERE slot_id = $1;
  -- If no row: return "slot full"
  COMMIT;
  ```
- Never implement booking as: (1) check availability, (2) respond to user, (3) confirm booking. Steps 1 and 3 must be atomic.
- Use optimistic locking as a secondary guard: store a `version` column on the slot record. Include `WHERE version = $expected_version` in the UPDATE. If 0 rows updated, the slot changed — retry or reject.
- Add a unique constraint on `(bot_id, slot_id, user_id)` to prevent the same user booking the same slot twice.

**Detection (warning signs):**
- Load testing with concurrent booking requests reveals double bookings.
- `current_bookings > capacity` is possible (indicates missing constraint).
- No transaction wrapping the check+reserve operation.

**Phase to address:** Booking state machine phase — design the slot table with these constraints from day one. Test with concurrent requests before considering booking complete.

---

### Pitfall 9: Booking State Machine Context Loss — Conversation Metadata Corrupted by Concurrent Messages

**What goes wrong:** The booking flow stores state in `conversation.metadata` (jsonb). If the user sends two rapid messages, two concurrent requests both read the same metadata, execute their state transition, and the second write overwrites the first. The state machine jumps to the wrong state or loses the selected slot/date.

**Why it happens:** n8n delivers messages as HTTP webhooks with no built-in serialisation. If a user sends "Book" and then immediately "Subang" before the first webhook completes, two requests race on the same `conversation_id`.

**Consequences:** Booking flow fails mid-session. User selected a facility but the bot asks again. Or state jumps from "awaiting_date" back to "awaiting_facility" because the earlier write wins.

**Prevention:**
- Use `UPDATE conversations SET metadata = $new_metadata WHERE id = $conversation_id AND metadata = $expected_metadata` (optimistic locking on the full jsonb). If 0 rows updated, re-read and retry.
- Alternatively, use a Postgres advisory lock keyed on `conversation_id` at the start of each webhook handler. Release on completion.
- In n8n, configure a message queue or serialise per `conversation_id` using n8n's wait-for-webhook pattern rather than parallel delivery.
- Implement idempotency: if the same message text is received for the same `conversation_id` within 5 seconds, deduplicate and return the cached response.

**Detection (warning signs):**
- Testing with rapid message sends causes state machine to skip steps or loop.
- `UPDATE conversations ... WHERE metadata = $expected` returns 0 rows unexpectedly.
- Booking completion rate drops under simulated concurrent user load.

**Phase to address:** Booking state machine phase — model the concurrency problem before writing state transition code.

---

### Pitfall 10: API Key Security — Storing Plaintext API Keys in Database

**What goes wrong:** The platform generates API keys for tenants to authenticate webhook requests. Developer stores the full plaintext key in the database. If the database is compromised or a slow query log leaks data, all tenant API keys are exposed.

**Why it happens:** Treating internal platform API keys like passwords is non-obvious. Most developers hash passwords but forget that API keys face the same risk.

**Consequences:** Any database read access grants attackers the ability to impersonate any tenant. All tenants' chatbots can be hijacked simultaneously.

**Prevention:**
- Store only a bcrypt hash (or `sha256` with a secret salt) of the API key. The plaintext key is shown ONCE to the tenant on creation and never stored.
- Use a prefix pattern (e.g., `ethan_live_xxxx...`) so keys are identifiable in logs without exposing the secret part. The prefix `ethan_live_` is stored in plaintext; only the hash of the full key is stored.
- On each webhook request: hash the incoming key, compare to stored hash. Timing-safe comparison only (`crypto.timingSafeEqual`).
- Rotate Claude API keys (stored in environment variables, not DB) separately from tenant API keys.

**Detection (warning signs):**
- `api_keys` table has a `key_value` column with plaintext values.
- API key is logged anywhere (request logs, Supabase slow query log, n8n execution history).
- No hash function visible in key generation code.

**Phase to address:** API key and auth phase — establish this pattern before any key is generated. Retrofitting means invalidating all existing keys.

---

### Pitfall 11: Ingestion Pipeline Failure on Large PDFs — Silent Truncation or OOM

**What goes wrong:** Large PDFs (100+ pages, embedded images, scanned pages) either crash the Next.js API route (OOM on Vercel's 256MB serverless limit), time out (10s default timeout), or produce garbled text extraction that silently pollutes the knowledge base.

**Why it happens:** PDF parsing libraries (pdf-parse, pdfjs-dist) load the entire file into memory. Vercel serverless has strict memory and time limits. Text extraction from scanned PDFs returns empty strings — no error is thrown, but chunks of empty/garbage text are embedded and stored.

**Consequences:** Knowledge base contains bad chunks. RAG retrieves them as "relevant" and Claude generates nonsense answers. The admin has no visibility that ingestion failed partially.

**Prevention:**
- Enforce a file size limit (e.g., 10MB) on upload. Display a clear error rather than attempting ingestion.
- For any file, validate extracted text before chunking: if `text.trim().length < 100` per page, flag the page as extraction failure. Log it. Do not embed empty chunks.
- Run ingestion asynchronously: upload to Supabase Storage, enqueue a background job (even a simple Next.js background route using `waitUntil` on Edge), and poll for status rather than waiting synchronously.
- Set Vercel function timeout explicitly for the ingestion route: `export const maxDuration = 60` (Pro plan required for > 10s).
- Test ingestion with: a scanned PDF, a password-protected PDF, a 50-page PDF, a DOCX with embedded images, and a TXT with non-UTF8 encoding before considering the feature complete.

**Detection (warning signs):**
- Ingestion route returns 200 but the knowledge base chunk count is 0 or suspiciously low.
- Admin uploads a 20-page PDF and only 2 chunks appear.
- Vercel function logs show memory usage near the limit during ingestion.
- Non-UTF8 characters appear in stored chunks.

**Phase to address:** Knowledge base / ingestion phase — build validation and failure visibility from the start, not after a user reports bad answers.

---

### Pitfall 12: Language Detection Misclassification — BM Classified as EN or ZH

**What goes wrong:** Bahasa Malaysia shares vocabulary with Indonesian, contains English loanwords, and uses Latin script like English. Simple language detectors (franc, langdetect) frequently misclassify short BM messages as EN or ID. This causes the wrong greeting, wrong FAQ match, and wrong response template to be selected.

**Why it happens:** BM is underrepresented in language detection training data. Short messages ("boleh tolong?", "nak booking") are ambiguous to most detectors. The error only appears in BM testing, not EN testing.

**Consequences:** BM user receives an English response. FAQ priority injection selects English FAQs. Personality greetings are in the wrong language. User experience is degraded for the primary Malaysian user base.

**Prevention:**
- Use a BM-specific word list as a pre-filter: if the message contains any of `["saya", "awak", "boleh", "nak", "tak", "ada", "macam", "dengan", "untuk", "tidak", "ini", "itu", "bagi", "kepada"]`, classify as BM regardless of the general detector's output.
- Fall back gracefully: if confidence < 0.7, default to BM for this deployment (Elken's primary market is Malaysian).
- Log language detection confidence scores. Review misclassifications after first week of production traffic.
- Test the classifier with 20 real BM messages from Elken's historical WhatsApp logs before launch.

**Detection (warning signs):**
- Testing console shows BM messages classified as EN or ID.
- Low-confidence scores (< 0.6) are common for short BM messages.
- n8n logs show BM messages receiving EN template responses.

**Phase to address:** Intent classification / language detection phase — validate against real BM messages before integrating into the chat pipeline.

---

## Moderate Pitfalls

### Pitfall 1: Supabase Storage Misconfiguration — Public Bucket Exposes Uploaded Documents

**What goes wrong:** If the Supabase Storage bucket for uploaded PDFs/DOCXs is set to public, anyone who guesses or discovers the file URL can download a tenant's proprietary documents.

**Prevention:**
- Set the bucket to private. Generate signed URLs for admin preview only, with short expiry (1 hour). Never serve document URLs to end users.
- Separate buckets per tenant or enforce path-based access: `uploads/{bot_id}/{file_id}`. Add a Storage policy: `USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text)`.

**Phase to address:** Knowledge base / ingestion phase.

---

### Pitfall 2: Claude API Cost Overrun — No Per-Tenant Token Tracking

**What goes wrong:** A single high-volume tenant (or a runaway integration) sends thousands of messages, consuming token budget intended for all tenants. The platform operator absorbs the cost.

**Prevention:**
- Log `input_tokens` and `output_tokens` from every Claude API response into a `usage_logs` table with `bot_id` and `timestamp`.
- Implement a per-bot daily token cap. When exceeded, return the bot's fallback message rather than calling Claude.
- Surface usage in the super-admin dashboard so Navien can identify cost anomalies before the monthly bill arrives.

**Phase to address:** Analytics phase — but log tokens from day one of chat implementation.

---

### Pitfall 3: n8n Webhook Retry — Duplicate Messages Processed Twice

**What goes wrong:** n8n retries a webhook if the response takes too long. If the chat endpoint takes 8s (slow Claude response), n8n may retry, resulting in the same user message being processed twice and two responses sent.

**Prevention:**
- Accept the webhook immediately with a 200 response and process asynchronously. Use `waitUntil` (Edge) or a background job.
- Alternatively, implement idempotency using `message_id` from the n8n payload: store processed `message_id` values and return the cached response if the same ID is received again within 60 seconds.

**Phase to address:** Chat endpoint / n8n integration phase.

---

### Pitfall 4: RLS Policy Missing on New Tables — Forgetting as Schema Evolves

**What goes wrong:** RLS is correctly set up on initial tables. Three sprints later, a developer adds a `response_templates` or `guardrails` table without adding RLS policies. These tables are now accessible cross-tenant.

**Prevention:**
- Add a Postgres trigger or CI check that fails if a new table with a `bot_id` column has no RLS policy. Alternatively, use a schema review checklist.
- Default all new tables to `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` as the first statement after `CREATE TABLE`. Make this a non-negotiable convention.

**Phase to address:** Ongoing — document this as a team convention in the codebase.

---

### Pitfall 5: Super-Admin Role Bypass of Tenant Isolation

**What goes wrong:** Navien (super-admin) needs to see all tenants. Developer implements this by granting the service role key to the super-admin session, which bypasses all RLS. A bug in the super-admin UI can now expose cross-tenant mutations to any session that gets the service key.

**Prevention:**
- Super-admin does NOT bypass RLS. Instead, give super-admin a dedicated Supabase role with explicit policies allowing cross-tenant reads: `CREATE POLICY "super_admin_read_all" ON bots USING (is_super_admin(auth.uid()))`.
- The service role key stays in environment variables on the server only. It is never sent to the browser.

**Phase to address:** Auth and super-admin phase.

---

## Minor Pitfalls

### Pitfall 1: pgvector `<=>` Operator Returns Distance, Not Similarity

**What goes wrong:** The `<=>` operator returns cosine DISTANCE (0 = identical, 2 = opposite). Developers apply a threshold of `WHERE embedding <=> query < 0.5` thinking they're filtering for 50% similarity. They are actually filtering for distance < 0.5, which corresponds to similarity > 0.75. The threshold may be too strict, returning no results.

**Prevention:** Document the convention clearly. Use `1 - (embedding <=> query)` to convert to similarity. Apply threshold on similarity, not distance. Add a comment in the query code explaining this.

**Phase to address:** RAG endpoint phase.

---

### Pitfall 2: Chunking Strategy Too Aggressive — Splits Mid-Sentence

**What goes wrong:** Naive chunking by fixed character count (e.g., every 500 chars) splits sentences mid-way. A chunk ends with "GenQi beds are available at Old" and the next starts with "Klang Road and Subang locations." Cosine search retrieves the first chunk for "GenQi bed locations?" and Claude receives incomplete context.

**Prevention:** Use sentence-aware chunking (split on `.`, `!`, `?`, `\n\n`). Apply a soft limit with 100-character overlap between adjacent chunks. For Elken's structured documents (product catalogs, booking policies), respect section headers as hard chunk boundaries.

**Phase to address:** Ingestion pipeline phase.

---

### Pitfall 3: Missing Indexes on Conversation Lookups

**What goes wrong:** `conversations` table lookups by `(bot_id, user_id)` or `(bot_id, conversation_id)` do full scans as volume grows. n8n sends every message to the webhook; each one looks up the active conversation.

**Prevention:** Add a composite index `(bot_id, user_id)` on the `conversations` table. Add `(bot_id, created_at DESC)` for dashboard listing queries.

**Phase to address:** Database schema phase — include in the initial migration.

---

### Pitfall 4: Booking Last-Cutoff Rule Not Enforced at DB Level

**What goes wrong:** The GenQi booking policy has a last-booking cutoff (e.g., no bookings within 30 minutes of the slot). This is enforced in application code only. If anyone calls the API directly (or the application code has a bug), the constraint is violated.

**Prevention:** Add a Postgres check constraint or a `BEFORE INSERT` trigger that rejects bookings where `slot_start_time - NOW() < interval '30 minutes'`. Application code is a second layer, not the only layer.

**Phase to address:** Booking state machine phase.

---

### Pitfall 5: Environment Variable Leak — Claude API Key in Client Bundle

**What goes wrong:** A developer creates a Next.js constant with `NEXT_PUBLIC_CLAUDE_API_KEY` to "make it accessible everywhere." This prefixes the key into the client-side bundle, exposed to anyone who opens DevTools.

**Prevention:** Claude API key must ONLY be accessed in Next.js server-side code (App Router route handlers, server actions, server components). Never use `NEXT_PUBLIC_` prefix for any secret. Enforce this with a linter rule.

**Phase to address:** Project setup / foundation phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Database schema | Missing RLS policies on new tables | Enable RLS + policy as part of CREATE TABLE template |
| Database schema | Missing bot_id index = slow RLS filter | Add index on bot_id for every scoped table in initial migration |
| Database schema | pgvector without HNSW index | Include `CREATE INDEX ... USING hnsw` in initial migration |
| Ingestion pipeline | Large PDF OOM on Vercel | Enforce file size limit; async processing; validate extracted text |
| Ingestion pipeline | Embedding dimension mismatch | Single shared constant for model + dim; assertion at startup |
| RAG endpoint | No similarity threshold = hallucination | Test retrieval quality in isolation before connecting Claude |
| RAG endpoint | BM queries underperform | Test per-language retrieval before connecting Claude |
| RAG endpoint | Streaming breaks on Vercel | Use Edge runtime; test on Vercel preview, not just local |
| Language detection | BM misclassified as EN | BM keyword pre-filter; default to BM for this market |
| Booking state machine | Double-booking race condition | SELECT FOR UPDATE in single transaction; test concurrently |
| Booking state machine | Conversation state race | Optimistic locking on metadata jsonb; advisory locks |
| Booking state machine | Cutoff rule not enforced | DB-level trigger or check constraint, not just app code |
| API key auth | Plaintext key storage | Hash + prefix pattern from day one; never log keys |
| API key auth | Claude API key in client bundle | Never use NEXT_PUBLIC_ for secrets; linter rule |
| n8n integration | Duplicate webhook retry | Idempotency via message_id; async response pattern |
| Analytics | Token cost overrun | Log tokens from day one; per-bot daily cap |
| Super-admin | Service role key in browser | Server-only; super-admin via explicit RLS policy, not service key bypass |

---

## Sources

- Domain knowledge: known failure patterns in Next.js 14 App Router + Supabase + pgvector multi-tenant architectures
- pgvector documentation on HNSW indexing and operator semantics (cosine distance vs similarity)
- Supabase RLS performance guidance: `current_setting` vs `auth.uid()` subquery patterns
- Vercel Edge Runtime and streaming constraints: Edge vs Node.js runtime function timeout behaviour
- Multi-tenant SaaS data isolation patterns: service role key scope, RLS policy completeness
- Bahasa Malaysia NLP: low-resource language challenges in multilingual embedding models
- Booking system design: SELECT FOR UPDATE, optimistic locking, advisory locks for slot reservation
- API key security: hash-then-compare pattern, timing-safe equality, prefix-display conventions
- Confidence: HIGH for Supabase/pgvector/Next.js/Claude API patterns (well-documented, widely-reported); MEDIUM for BM-specific embedding quality (empirically consistent but voyage-3 multilingual claims should be validated with actual BM test queries before launch)
