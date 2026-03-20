# Phase 3: Webhook Gateway - Research

**Researched:** 2026-03-20
**Domain:** API key lifecycle management, Next.js App Router API routes, Supabase migrations + RLS, shadcn/ui modal/tabs
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**API Key Data Model**
- New `api_keys` table (separate migration `00008_api_keys.sql`) with columns: `id`, `bot_id`, `label`, `key_prefix` (first 8 chars), `key_hash` (SHA-256), `last_used_at`, `created_at`, `revoked_at` (nullable — null means active)
- Multiple labeled keys per bot — one bot can have many active keys
- Keep `bots.api_key_hash` for backward compatibility; new validation routes through `api_keys` table first
- Chat endpoint checks `api_keys` table first (active key matching hash), falls back to `bots.api_key_hash` if no `api_keys` rows exist
- `last_used_at` updated on every successful key validation
- Revocation: set `revoked_at = now()` — do not delete

**Key Generation & Reveal UX**
- Key format: `ethan_live_` + 24 random hex chars
- Key prefix stored: first 8 chars after `ethan_live_` prefix
- Key shown in full exactly once via modal with copy button and "I've copied this key" dismiss
- Modal warns "This key will not be shown again"
- Regeneration creates a new key and revokes the previous one atomically — no update of existing record

**n8n Payload Schema**
```json
{
  "message": "text content",
  "userId": "sender_id",
  "channel": "whatsapp" | "telegram",
  "conversationId": "optional"
}
```
- `channel` stored in `messages.metadata` or dedicated column for Phase 6 analytics

**Integrations Page Layout**
- Tab-based: "WhatsApp" | "Telegram"
- Webhook URL: `https://yourdomain.com/api/chat/{botId}` (auto-populated, read-only, copy button)
- Each tab: Webhook URL + n8n JSON snippet with syntax highlighting + setup note
- Route: `/dashboard/bots/[botId]/integrations`

### Claude's Discretion
- Exact migration number for `api_keys` table (next after `00007_rag_functions.sql`)
- RLS policies on `api_keys` (tenant admin sees only their bot's keys; service role bypasses)
- Exact shadcn/ui components for modal (Dialog) and tabs (Tabs)
- Snippet syntax highlighting approach (inline code block vs react-syntax-highlighter)
- API route path for key generation/revocation (`/api/keys/[botId]` or similar)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| API-01 | Admin can generate an API key with a label; key shown in full once; only SHA-256 hash stored; format: `ethan_live_xxxxxxxxxxxxxxxx` | Key generation pattern using `crypto.randomBytes`, SHA-256 with `crypto.createHash`, show-once modal via shadcn Dialog |
| API-02 | Admin can view existing keys by label and 8-char prefix; last-used timestamp displayed | Supabase SELECT on `api_keys` filtered by `bot_id`, `revoked_at IS NULL`; timestamp display |
| API-03 | Admin can revoke any API key | Supabase UPDATE setting `revoked_at = now()` — soft delete pattern |
| API-04 | Webhook endpoint validates API key using constant-time hash comparison on every request | Existing `crypto.timingSafeEqual` pattern in `route.ts` extended to check `api_keys` table; `last_used_at` UPDATE on success |
| API-05 | Integrations page displays copy-paste webhook URL and n8n JSON body snippets for Telegram and WhatsApp | shadcn Tabs + read-only Input + code snippet copy button; route `/dashboard/bots/[botId]/integrations` |
</phase_requirements>

---

## Summary

Phase 3 is narrowly scoped: add the `api_keys` table, wire it into the existing chat endpoint's validation block, build the admin UI for key management, and create an integrations page. The existing codebase already demonstrates every technical pattern needed — `crypto.randomBytes`, `crypto.createHash('sha256')`, `crypto.timingSafeEqual`, Supabase service client mutations, and shadcn/ui Dialog/Input/Button components.

The chat route (`app/api/chat/[botId]/route.ts`) must be updated to query `api_keys` first and fall back to `bots.api_key_hash`. This is a surgical extension of lines 32-57 of the existing file. The validation change is the most security-critical piece; the `timingSafeEqual` pattern is already correct — Phase 3 applies it to `api_keys.key_hash` rows.

The integrations page and key management UI are pure Next.js + shadcn/ui. No new dependencies are needed. The only discretion-level choice is snippet syntax highlighting — inline `<pre><code>` is sufficient for v1 and avoids adding `react-syntax-highlighter` as a dependency.

**Primary recommendation:** Build all server-side mutations through `createServiceClient()` API routes; never expose key material to the browser after initial generation. Use the `Dialog` component for show-once reveal, `Tabs` for the integrations page, and a single API route at `/api/keys/[botId]` handling GET/POST/DELETE via method dispatch.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` (built-in) | — | SHA-256 hashing, random bytes, timingSafeEqual | Zero dependencies; already in use at line 1 of `route.ts` |
| `@supabase/supabase-js` | latest (already installed) | Supabase mutations for `api_keys` table | Already the project ORM; service client pattern established |
| Next.js App Router | 16.x (already installed) | API route handlers, dynamic segments | Already the project framework |
| shadcn/ui Dialog | already installed (button.tsx, input.tsx present) | Show-once key reveal modal | Already in project; shadcn/ui is the design system |
| shadcn/ui Tabs | needs install | Channel tab switcher on integrations page | shadcn/ui is locked design system |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.511.0 (already installed) | Copy icon, eye/hide icons for key fields | Already in project |
| Inline `<pre><code>` with Tailwind | — | n8n snippet display | Avoids adding react-syntax-highlighter; sufficient for v1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline `<pre><code>` | `react-syntax-highlighter` | Richer highlighting but adds ~70KB; overkill for two static JSON snippets |
| Single `/api/keys/[botId]` route | Separate `/api/keys/[botId]/generate`, `/api/keys/[botId]/revoke` | More REST-pure but more files; single route with method dispatch is simpler here |

**Installation — only new component needed:**
```bash
npx shadcn@latest add dialog tabs
```

**Version verification:** `@supabase/supabase-js` and `next` are pinned to `latest` in package.json. No additional version pinning needed for Phase 3.

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
app/
├── api/
│   └── keys/
│       └── [botId]/
│           └── route.ts          # GET (list), POST (generate), DELETE (revoke)
└── dashboard/
    └── bots/
        └── [botId]/
            └── integrations/
                └── page.tsx      # Integrations page with tabs + snippets

lib/
└── api-keys/
    └── generate.ts               # Key generation helper (randomBytes + hash + prefix)

supabase/
└── migrations/
    └── 00008_api_keys.sql        # api_keys table + RLS policies
```

### Pattern 1: Key Generation (Show-Once)
**What:** Generate `ethan_live_` + 24 hex chars, hash with SHA-256, store hash + prefix, return plaintext key to UI exactly once.
**When to use:** POST handler for new key creation.
**Example:**
```typescript
// Source: Node.js crypto docs + existing route.ts pattern
import crypto from 'crypto'

export function generateApiKey() {
  const raw = `ethan_live_${crypto.randomBytes(12).toString('hex')}` // 24 hex chars
  const prefix = raw.replace('ethan_live_', '').slice(0, 8)
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash, prefix }
}
```

### Pattern 2: Chat Endpoint Validation Extension
**What:** Check `api_keys` table first (active, matching hash), fall back to `bots.api_key_hash` if table is empty for this bot.
**When to use:** Replace lines 32-57 in `app/api/chat/[botId]/route.ts`.
**Example:**
```typescript
// Source: Extends existing route.ts pattern
if (bot.api_key_hash) {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return Response.json({ error: 'Missing X-API-Key header' }, { status: 401 })

  // Phase 3: check api_keys table first
  const providedHash = crypto.createHash('sha256').update(apiKey).digest('hex')

  const { data: keyRow } = await supabase
    .from('api_keys')
    .select('id, key_hash')
    .eq('bot_id', botId)
    .is('revoked_at', null)
    .maybeSingle()   // returns null if no rows — triggers fallback

  if (keyRow) {
    // New path: validate against api_keys row
    if (!crypto.timingSafeEqual(Buffer.from(keyRow.key_hash), Buffer.from(providedHash))) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 })
    }
    // Update last_used_at (fire-and-forget is acceptable)
    supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id)
  } else {
    // Fallback path: validate against bots.api_key_hash (Phase 2 bots)
    if (!crypto.timingSafeEqual(Buffer.from(bot.api_key_hash), Buffer.from(providedHash))) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 })
    }
  }
}
```

### Pattern 3: Soft-Delete Revocation
**What:** Set `revoked_at = now()` — never delete rows; retained for audit.
**When to use:** DELETE handler in `/api/keys/[botId]` route.
**Example:**
```typescript
// Source: Supabase docs on UPDATE + project service client pattern
await supabase
  .from('api_keys')
  .update({ revoked_at: new Date().toISOString() })
  .eq('id', keyId)
  .eq('bot_id', botId) // isolation guard
```

### Pattern 4: Atomic Regeneration
**What:** Revoke existing key with same label AND create new key in a single operation.
**When to use:** POST when label already exists (regeneration flow).
**Example:**
```typescript
// Revoke old key, then insert new key — two sequential mutations (no transaction needed; if insert fails, old key is already revoked — acceptable UX: admin regenerates again)
await supabase.from('api_keys')
  .update({ revoked_at: new Date().toISOString() })
  .eq('bot_id', botId).eq('label', label).is('revoked_at', null)

const { raw, hash, prefix } = generateApiKey()
await supabase.from('api_keys')
  .insert({ bot_id: botId, label, key_prefix: prefix, key_hash: hash })
```

### Pattern 5: shadcn Dialog for Show-Once UX
**What:** Open Dialog after key generation, display full key in a read-only Input, copy button, "I've copied this key" close button.
**When to use:** After successful POST to key generation endpoint.
**Example:**
```tsx
// Source: shadcn/ui Dialog docs
<Dialog open={showKeyModal} onOpenChange={setShowKeyModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Your new API key</DialogTitle>
      <DialogDescription>
        This key will not be shown again. Copy it now.
      </DialogDescription>
    </DialogHeader>
    <div className="flex gap-2">
      <Input value={generatedKey} readOnly />
      <Button onClick={() => navigator.clipboard.writeText(generatedKey)}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
    <DialogFooter>
      <Button onClick={() => setShowKeyModal(false)}>
        I've copied this key
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Anti-Patterns to Avoid
- **Returning the raw key from GET requests:** Generate once, reveal once, store only hash. Never retrieve from DB and re-display.
- **Deleting revoked keys:** Revocation is `revoked_at = now()`. Deletion destroys audit trail.
- **Using `===` for hash comparison:** Always use `crypto.timingSafeEqual` to prevent timing attacks — the existing route.ts already does this correctly.
- **Querying `api_keys` using `api_key_hash IS NULL` fallback inside the same query:** The fallback to `bots.api_key_hash` should be a conditional branch in TypeScript, not a SQL COALESCE — keeps logic explicit and testable.
- **Exposing service role key or full key hash to the browser:** All key operations go through `createServiceClient()` in API routes only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secure random key generation | Custom PRNG or UUID | `crypto.randomBytes(12).toString('hex')` | Node.js built-in CSPRNG; correct entropy |
| Constant-time string comparison | `===` or character loop | `crypto.timingSafeEqual` | Prevents timing side-channel attacks |
| Clipboard copy in browser | `document.execCommand('copy')` | `navigator.clipboard.writeText()` | Async Clipboard API is the modern standard; execCommand is deprecated |
| Modal component | Custom overlay/portal | shadcn/ui `Dialog` | Already installed; accessible (focus trap, ARIA); consistent with project design system |
| Tab navigation on integrations page | Custom CSS tabs | shadcn/ui `Tabs` | Accessible, keyboard-navigable, consistent with project |
| Code snippet display | Custom syntax parser | Tailwind-styled `<pre><code>` | Two static JSON snippets don't warrant a 70KB library |

**Key insight:** Every core cryptographic primitive needed (randomness, hashing, constant-time comparison) is in Node.js `crypto`. Never substitute custom implementations.

---

## Common Pitfalls

### Pitfall 1: `api_keys` Validation Bypassed When Table Is Empty
**What goes wrong:** If the validation logic only queries `api_keys` and the table is empty for a bot, all requests pass through unauthenticated.
**Why it happens:** The fallback to `bots.api_key_hash` gets omitted or the empty-result branch is handled incorrectly.
**How to avoid:** Explicit branch: if `api_keys` returns a row, validate against it. If no rows exist, fall back to `bots.api_key_hash`. If `api_key_hash` is also null, dev-mode bypass (preserve existing behavior).
**Warning signs:** Test `chat-auth.test.ts` must be updated to test both paths — new `api_keys` path AND `bots.api_key_hash` fallback.

### Pitfall 2: `timingSafeEqual` Buffer Length Mismatch
**What goes wrong:** `timingSafeEqual` throws if the two buffers are different lengths (hex SHA-256 is always 64 chars, so this only fires if `key_hash` in the DB is somehow malformed).
**Why it happens:** Existing code guards with a length check before calling `timingSafeEqual` — the new `api_keys` path must do the same.
**How to avoid:** Always check `keyRow.key_hash.length === providedHash.length` or use the `storedHashBuffer.length !== providedHashBuffer.length` guard already in the existing code (lines 48-50 of `route.ts`).
**Warning signs:** Unhandled exception in chat endpoint returning 500 instead of 401.

### Pitfall 3: `last_used_at` Update Blocking Response
**What goes wrong:** Awaiting the `last_used_at` UPDATE adds latency on every authenticated request.
**Why it happens:** The developer awaits the update before streaming starts.
**How to avoid:** Fire-and-forget — do not await `last_used_at` update. Log errors if needed but don't block the stream.
**Warning signs:** Noticeable latency added to all chat responses after Phase 3 deploy.

### Pitfall 4: Modal Closed Without Copying — Key Is Lost
**What goes wrong:** Admin dismisses modal without copying key; key is unrecoverable (only hash stored).
**Why it happens:** User hits Escape or clicks outside dialog.
**How to avoid:** The Dialog `onOpenChange` should not close the modal on outside click (set `onInteractOutside={(e) => e.preventDefault()}`). Only the "I've copied this key" button dismisses. The context already specifies regeneration as the recovery path.
**Warning signs:** Admin support requests for "lost" keys.

### Pitfall 5: RLS Policies Missing on `api_keys`
**What goes wrong:** Tenant admin can query or mutate another tenant's API keys directly via Supabase client.
**Why it happens:** New table created without RLS enabled.
**How to avoid:** Migration `00008_api_keys.sql` must include `ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY` and policies scoping SELECT/INSERT/UPDATE to `bot_id IN (SELECT id FROM bots WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))`. Service role bypasses RLS for API routes.
**Warning signs:** `pgTAP` RLS isolation tests (established Phase 1 pattern) failing or not written.

### Pitfall 6: Next.js 16 Dynamic Params Typing
**What goes wrong:** `params` accessed synchronously causes type error in Next.js 16.
**Why it happens:** Next.js 16 requires `params: Promise<{botId: string}>` with `await params`.
**How to avoid:** The existing pattern in `route.ts` and the project decision log are authoritative — always type as `Promise<{botId: string}>` and `await params` before use. Apply same pattern to new `/api/keys/[botId]/route.ts`.
**Warning signs:** TypeScript compilation errors or runtime undefined `botId`.

---

## Code Examples

Verified patterns from existing codebase and official sources:

### Migration: api_keys Table
```sql
-- Source: Project migration convention (00002_schema.sql pattern)
-- supabase/migrations/00008_api_keys.sql

CREATE TABLE public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  bot_id       uuid not null references public.bots(id) on delete cascade,
  label        text not null,
  key_prefix   text not null,
  key_hash     text not null,
  last_used_at timestamptz,
  created_at   timestamptz default now(),
  revoked_at   timestamptz
);

-- Index for fast validation lookup
CREATE INDEX api_keys_bot_id_revoked_at_idx
  ON public.api_keys (bot_id, revoked_at)
  WHERE revoked_at IS NULL;

-- RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Tenant admin sees only their bot's keys
CREATE POLICY "tenant_admin_select_api_keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (
    bot_id IN (
      SELECT b.id FROM public.bots b
      JOIN public.profiles p ON p.tenant_id = b.tenant_id
      WHERE p.id = auth.uid()
    )
  );

-- Only service role inserts/updates (API routes use service client)
-- No INSERT/UPDATE/DELETE policies for authenticated — mutations go through API routes
```

### API Route: Key Generation (POST)
```typescript
// Source: Project pattern — app/api/[resource]/[botId]/route.ts
// app/api/keys/[botId]/route.ts
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const { label } = await req.json()

  const supabase = createServiceClient()

  // Generate key
  const raw = `ethan_live_${crypto.randomBytes(12).toString('hex')}`
  const prefix = raw.replace('ethan_live_', '').slice(0, 8)
  const hash = crypto.createHash('sha256').update(raw).digest('hex')

  // Revoke any existing active key with same label (atomic regeneration)
  await supabase.from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('bot_id', botId).eq('label', label).is('revoked_at', null)

  // Insert new key
  const { data, error } = await supabase.from('api_keys').insert({
    bot_id: botId,
    label,
    key_prefix: prefix,
    key_hash: hash,
  }).select('id, label, key_prefix, created_at').single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Return plaintext key ONCE — never stored, never retrievable again
  return Response.json({ key: raw, ...data })
}
```

### API Route: Key Listing (GET)
```typescript
// GET /api/keys/[botId] — list active keys (no key_hash returned)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, label, key_prefix, last_used_at, created_at')
    .eq('bot_id', botId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ keys: data })
}
```

### API Route: Key Revocation (DELETE)
```typescript
// DELETE /api/keys/[botId] with body { keyId }
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const { keyId } = await req.json()
  const supabase = createServiceClient()

  const { error } = await supabase.from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('bot_id', botId) // isolation guard — prevents cross-bot revocation
    .is('revoked_at', null)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
```

### Integrations Page: n8n Snippet
```typescript
// Source: CONTEXT.md locked payload schema
const whatsappSnippet = (botId: string, webhookUrl: string) => JSON.stringify({
  message: "{{ $json.message.text }}",
  userId: "{{ $json.message.from.id }}",
  channel: "whatsapp",
  conversationId: "{{ $json.message.chat.id }}"
}, null, 2)

const telegramSnippet = (botId: string, webhookUrl: string) => JSON.stringify({
  message: "{{ $json.message.text }}",
  userId: "{{ $json.message.from.id }}",
  channel: "telegram",
  conversationId: "{{ $json.message.chat.id }}"
}, null, 2)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plain-text API key storage | SHA-256 hash only, never store plaintext | Security standard | Phase 3 enforces this from day one |
| Single API key per bot (`bots.api_key_hash`) | Multiple labeled keys per bot (`api_keys` table) | Phase 3 migration | Enables key rotation without downtime |
| Hard deletion of revoked keys | Soft delete (`revoked_at`) | Phase 3 design | Preserves audit trail |

**Deprecated/outdated within this project:**
- `bots.api_key_hash` direct validation: remains as fallback for Phase 1/2 bots only; new bots validated exclusively through `api_keys` table once Phase 3 is complete.

---

## Open Questions

1. **Where exactly should the API key management UI live?**
   - What we know: CONTEXT.md suggests `/dashboard/settings/page.tsx` or a dedicated `/api-keys` sub-route under the bot; the settings page currently says "Phase 4+"
   - What's unclear: Whether key management is bot-scoped (under `/dashboard/bots/[botId]/`) or global-to-tenant (under `/dashboard/settings/`)
   - Recommendation: Bot-scoped at `/dashboard/bots/[botId]/api-keys` — keys belong to a bot (the `api_keys` table has `bot_id`); mirrors the integrations page structure; consistent with the `bot_id` isolation principle. The planner should make this call explicitly.

2. **Should `last_used_at` fire-and-forget or use a background queue?**
   - What we know: High-frequency chat requests will update `last_used_at` on every call
   - What's unclear: Whether write amplification matters at v1 scale
   - Recommendation: Fire-and-forget (unawaited) is fine for v1. If Supabase throttles at scale, batch or debounce in Phase 6+.

3. **Should `api_keys` validation check ALL active keys for a bot or only the first match?**
   - What we know: Multiple active keys per bot are allowed; validation must accept any valid active key
   - What's unclear: The locked decision says "check `api_keys` table first (active key with matching hash)" — this implies a query that finds the matching hash, not just any active key
   - Recommendation: Query `WHERE bot_id = ? AND key_hash = ? AND revoked_at IS NULL` to find exact hash match in a single query. This is O(1) lookup via the index and is both correct and efficient.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/api/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | Generate key: returns `ethan_live_` prefix + 24 hex, stores only hash | unit | `npx vitest run tests/api/keys.test.ts` | ❌ Wave 0 |
| API-01 | Key shown once: POST response includes `key` field; GET list does NOT include `key` field | unit | `npx vitest run tests/api/keys.test.ts` | ❌ Wave 0 |
| API-02 | List keys: returns `label`, `key_prefix`, `last_used_at`; no `key_hash` | unit | `npx vitest run tests/api/keys.test.ts` | ❌ Wave 0 |
| API-03 | Revoke key: DELETE sets `revoked_at`; key no longer appears in active list | unit | `npx vitest run tests/api/keys.test.ts` | ❌ Wave 0 |
| API-04 | Valid active `api_keys` row → 200 from chat endpoint | unit | `npx vitest run tests/api/chat-auth.test.ts` | ✅ (needs update for `api_keys` path) |
| API-04 | Revoked key → 401 from chat endpoint | unit | `npx vitest run tests/api/chat-auth.test.ts` | ✅ (needs update for `api_keys` path) |
| API-04 | No `api_keys` rows + valid `bots.api_key_hash` → 200 (fallback preserved) | unit | `npx vitest run tests/api/chat-auth.test.ts` | ✅ (existing test, must not regress) |
| API-04 | `last_used_at` updated on successful validation | unit | `npx vitest run tests/api/keys.test.ts` | ❌ Wave 0 |
| API-05 | Integrations page renders tab switcher with WhatsApp and Telegram tabs | manual | — | manual-only (UI component) |

**Manual-only justification (API-05):** The integrations page is a static UI component with no server logic. Render behavior is verified by visual inspection during development. No behavior under test that can't be confirmed by loading `/dashboard/bots/[botId]/integrations` in a browser.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/api/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api/keys.test.ts` — covers API-01, API-02, API-03, API-04 (api_keys path), API-04 (last_used_at update)
- [ ] `tests/api/chat-auth.test.ts` — update existing file to add test cases for the `api_keys` validation path (currently tests only `bots.api_key_hash` path)

---

## Sources

### Primary (HIGH confidence)
- Existing codebase `app/api/chat/[botId]/route.ts` — current SHA-256 + timingSafeEqual pattern
- Existing codebase `supabase/migrations/00002_schema.sql` — `bots.api_key_hash` column, RLS pattern
- Existing codebase `tests/api/chat-auth.test.ts` — existing test infrastructure for API-04 validation
- Existing codebase `tests/setup.ts` + `vitest.config.ts` — test framework setup, patterns confirmed
- `.planning/phases/03-webhook-gateway/03-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- shadcn/ui Dialog component — known to be available; button.tsx and input.tsx confirmed present in `components/ui/`; Dialog and Tabs need `npx shadcn@latest add dialog tabs` (standard shadcn install command, consistent with project setup)
- Node.js `crypto` docs — `randomBytes`, `createHash('sha256')`, `timingSafeEqual` API verified against project's existing usage

### Tertiary (LOW confidence)
- n8n JSON body field names for WhatsApp/Telegram — field names (`$json.message.text`, `$json.message.from.id`, `$json.message.chat.id`) are plausible n8n expression syntax but depend on Navien's actual n8n workflow trigger node type. STATE.md flags this as unresolved. The snippet should note these as placeholder expressions that the admin must adjust to match their n8n trigger node.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; no new dependencies except Dialog/Tabs shadcn components
- Architecture: HIGH — all patterns directly derived from existing codebase code
- Pitfalls: HIGH — identified from existing code review (timingSafeEqual length guard already present, fallback logic analyzed)
- n8n snippet expressions: LOW — placeholder field names, Navien must verify against their trigger node

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack; shadcn/ui and Supabase are not fast-moving for these APIs)
