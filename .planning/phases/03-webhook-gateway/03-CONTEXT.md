# Phase 3: Webhook Gateway - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add API key lifecycle management (generate, view, revoke) for admins, and an integrations page with copy-paste n8n webhook snippets. The chat endpoint validation logic is already built in Phase 2 — this phase adds the `api_keys` table, the admin UI, and wires validation through the new table.

</domain>

<decisions>
## Implementation Decisions

### API Key Data Model
- Add a new `api_keys` table (separate migration) with columns: `id`, `bot_id`, `label`, `key_prefix` (first 8 chars), `key_hash` (SHA-256), `last_used_at`, `created_at`, `revoked_at` (nullable — null means active)
- Multiple labeled keys per bot — one bot can have many active keys
- Keep `bots.api_key_hash` column for backward compatibility (Phase 2 bots still work), but new validation routes through `api_keys` table
- Chat endpoint (`app/api/chat/[botId]/route.ts`) updated to: check `api_keys` table first (active key with matching hash), fall back to `bots.api_key_hash` if no `api_keys` rows exist (dev-mode bypass preserved)
- `last_used_at` updated on every successful key validation
- Revocation: set `revoked_at = now()` — do not delete; revoked keys are excluded from validation but retained for audit

### Key Generation & Reveal UX
- Key format: `ethan_live_` + 24 random hex chars (per API-01)
- Key prefix stored: first 8 chars after `ethan_live_` prefix (for display in key list)
- Key shown in full exactly once: modal dialog with a prominent copy button and a "I've copied this key" dismiss button
- Modal includes a warning: "This key will not be shown again"
- If admin closes modal without copying: allow regeneration — clicking "Regenerate" generates a new key and invalidates (revokes) the previous one with the same label
- No download or email option for v1

### n8n Payload Schema
- Webhook expects this JSON body from n8n:
  ```json
  {
    "message": "text content of user message",
    "userId": "sender_id from n8n (WhatsApp/Telegram user identifier)",
    "channel": "whatsapp" | "telegram",
    "conversationId": "optional — n8n passes this to maintain thread continuity"
  }
  ```
- This matches what Phase 2's chat endpoint already handles — no changes to parsing logic
- `conversationId` is optional; if absent, the endpoint creates a new conversation
- `channel` stored on the conversation/message record for analytics

### Integrations Page Layout
- Tab-based: "WhatsApp" | "Telegram" — each tab shows its own snippet
- Webhook URL auto-populates with the actual bot ID: `https://yourdomain.com/api/chat/{botId}`
- Each tab shows:
  1. Webhook URL field (read-only, copy button)
  2. Full n8n JSON body snippet with syntax highlighting and copy button
  3. Brief setup note (1-2 sentences on how to wire in n8n)
- n8n JSON body for WhatsApp: `channel: "whatsapp"`, for Telegram: `channel: "telegram"`
- Page lives at `/dashboard/bots/[botId]/integrations` (or similar bot-scoped route)

### Claude's Discretion
- Exact migration number for `api_keys` table (next after `00007_rag_functions.sql`)
- RLS policies on `api_keys` (tenant admin sees only their bot's keys; service role bypasses)
- Exact shadcn/ui components for the modal (Dialog) and tabs (Tabs)
- Snippet syntax highlighting approach (inline code block vs react-syntax-highlighter)
- API route path for key generation/revocation (`/api/keys/[botId]` or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API Key Requirements
- `.planning/REQUIREMENTS.md` §API Keys & Webhooks (API-01 through API-05) — exact acceptance criteria: key format, show-once behavior, prefix display, last-used timestamp, revocation, constant-time validation, integrations page snippets

### Existing Validation Implementation (MUST read before modifying)
- `app/api/chat/[botId]/route.ts` — Phase 2 validation logic already uses `bots.api_key_hash`; Phase 3 extends this to check `api_keys` table first while preserving the null-bypass for dev mode

### Existing Schema (MUST read before writing migrations)
- `supabase/migrations/00002_schema.sql` — `bots.api_key_hash text` column exists; new `api_keys` table must not conflict
- `supabase/migrations/00007_rag_functions.sql` — last migration; new migration is `00008_api_keys.sql`

### Architecture Constraints
- `.planning/PROJECT.md` §Constraints — service role client for all API routes, Next.js App Router patterns, shadcn/ui for all UI
- `.planning/PROJECT.md` §Key Decisions — n8n is the channel bridge; this app exposes REST webhook only

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase/service.ts` — service role client; use for all key generation and validation API routes
- `app/api/chat/[botId]/route.ts` — existing SHA-256 constant-time comparison logic; Phase 3 extends (not replaces) this
- shadcn/ui `Dialog`, `Tabs`, `Button`, `Input` components — already installed; use for key modal and integrations page tabs

### Established Patterns
- API routes at `app/api/[resource]/[botId]/route.ts`
- `params` typed as `Promise<{botId}>` with `await params` (Next.js 16 requirement)
- Service role client for all mutations; never expose SERVICE_ROLE_KEY via NEXT_PUBLIC_
- `bot_id` as universal isolation key on all new tables
- Supabase migrations in `supabase/migrations/` with incrementing numeric prefix

### Integration Points
- `app/api/chat/[botId]/route.ts` — update validation block to check `api_keys` table first
- `app/dashboard/bots/[botId]/` — add `integrations/page.tsx` route
- `app/dashboard/settings/page.tsx` — likely location for API key management UI (or a dedicated `/api-keys` sub-route under the bot)
- New migration: `supabase/migrations/00008_api_keys.sql`

</code_context>

<specifics>
## Specific Ideas

- STATE.md flagged n8n payload field names as a blocker — resolved: `message`, `userId`, `channel`, `conversationId` are the canonical field names; chat endpoint already parses these
- The `channel` field on the n8n payload should be stored in `messages.metadata` or a dedicated column for Phase 6 analytics (intent breakdown by channel)
- Regeneration (when admin loses a key) should create a new key record and revoke the old one atomically — not update the existing record

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-webhook-gateway*
*Context gathered: 2026-03-20*
