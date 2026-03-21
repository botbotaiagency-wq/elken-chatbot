# Phase 4: Admin Dashboard - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the admin configuration UI for bot personality, guardrails, FAQs, and response templates — so admins can configure every aspect of the bot without touching code. Also deliver a live testing console where admins can send messages and inspect the full RAG debug output (source chunks, intent, latency, rag_found). Includes the bots list page as the entry point to all bot-specific config. Analytics, bookings admin, and knowledge base upload UI are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Config Page Navigation
- Each config section is a **separate route** under the bot: `/bots/[botId]/personality`, `/bots/[botId]/guardrails`, `/bots/[botId]/faqs`, `/bots/[botId]/templates`, `/bots/[botId]/testing`
- This continues the established Phase 3 pattern (api-keys and integrations are already separate routes under `[botId]`)
- Bot detail page (`/bots/[botId]`) shows **horizontal tabs across the top** for sub-navigation: Personality | Guardrails | FAQs | Templates | Testing | API Keys | Integrations
- Phase 4 also builds the `/bots` list page — a table/card list of bots with name, status, and a link to each bot's detail page — as the entry point to all bot config pages
- Existing sidebar nav (Overview, Bots, Knowledge, Bookings, Analytics, Settings) stays unchanged; "Bots" links to `/bots` list

### Config Save UX
- **Save button per section**: each config section (Personality, Guardrails) has its own "Save changes" button at the bottom of the form
- Admin edits the entire section form then clicks save — no auto-save on blur
- On save: writes to DB immediately, toast confirms "Bot configuration saved." — takes effect immediately on next bot request
- No draft/publish workflow — changes go live instantly

### Personality Form Layout
- Three **separate labeled textareas stacked vertically** for per-language greetings: Greeting (EN), Greeting (BM), Greeting (ZH) — all visible simultaneously for easy comparison
- Same pattern applies anywhere else with EN/BM/ZH variants in the personality form
- Personality fields: bot name (text input), greeting per language (3 textareas), tone (select: Professional / Friendly / Formal), fallback message (textarea)

### Testing Console Layout
- Chat UI styled like WhatsApp/Telegram — user messages right-aligned, bot messages left-aligned, in a scrollable chat window
- Debug metadata (source chunks, intent, latency, rag_found) appears in an **expandable panel below each bot response** — a small "View details" toggle expands to show: intent classification, RAG found status, latency in ms, and source chunks (doc name + similarity score + content preview)
- Details collapsed by default — admin expands on demand; most natural chat feel with debug on demand
- **Language override**: dropdown in the console toolbar — "Language: Auto | EN | BM | ZH". Auto = detect from message; selecting a language forces all responses into that language
- **Streaming**: typing indicator ("...") shown while waiting for first token, then text streams into the chat bubble in real time as tokens arrive — matching the live RAG stream from `app/api/chat/[botId]/route.ts`
- **Reset button** in toolbar: clears conversation history and starts a fresh session (new conversationId)

### Guardrails Form Layout
- Guardrails fields: blocked topic keywords (multi-line textarea, one keyword per line), custom refuse message (textarea), mandatory disclaimer text (textarea), max response length (number input), off-topic deflection message (textarea)
- Save button per section, same pattern as Personality

### FAQ Management
- FAQ list: table with columns — Question, Language (badge), Answer preview, Edit/Delete actions
- **Language filter dropdown** above the list: All | EN | BM | ZH — filters the visible rows
- **Modal dialog** for create/edit: question (textarea), answer (textarea), language (select: EN / BM / ZH)
- Modal uses shadcn/ui `Dialog` — consistent with Phase 3 API key show-once modal pattern
- Delete: inline confirm row (same inline-confirm pattern as Phase 3 key revocation — no separate dialog)

### Response Template Management
- Templates list: table with columns — Intent, Language variants present (badges), Edit action
- 5 intents: `no_product_found`, `slot_full`, `booking_confirmed`, `reminder_24h`, `post_survey`
- **Language filter dropdown** above the list: All | EN | BM | ZH
- **Modal dialog** for editing: shows all three variants simultaneously — EN textarea, BM textarea, ZH textarea stacked vertically (same pattern as personality greetings)
- No delete (templates are tied to fixed intents — edit-only, not deleteable)

### Claude's Discretion
- Exact DB API routes for config CRUD (route naming, HTTP method choices)
- shadcn/ui component variants (e.g., textarea sizing, card layout density)
- Empty state illustrations/messaging for empty FAQ/template lists
- Exact chunk content preview length in the debug panel
- Pagination vs infinite scroll for FAQ/template lists (small seeded list — plain list is fine)
- Whether to use `react-hook-form` + `zod` or plain controlled state for config forms

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bot Configuration Requirements
- `.planning/REQUIREMENTS.md` §Bot Configuration (CONF-01 through CONF-05) — exact acceptance criteria for personality config, guardrails, response templates, FAQs including language variants and pre-seeded Elken content

### Testing Console Requirements
- `.planning/REQUIREMENTS.md` §Testing Console (TEST-01 through TEST-04) — acceptance criteria for the live chat UI, metadata display fields, language override, and session reset

### Existing Bot-Scoped Route Patterns (MUST read before adding routes)
- `app/dashboard/bots/[botId]/api-keys/page.tsx` — Phase 3 pattern for a bot-scoped 'use client' page with useParams(), service calls, modal dialogs, and inline confirm rows. Phase 4 config pages follow this exact pattern.
- `app/dashboard/bots/[botId]/integrations/page.tsx` — Phase 3 tab layout and CopyButton sub-component pattern

### Existing shadcn/ui Components (already installed)
- `components/ui/dialog.tsx` — use for FAQ/template create/edit modals
- `components/ui/tabs.tsx` — use for bot detail page sub-navigation
- `components/ui/badge.tsx` — use for language badges in FAQ/template lists
- `components/ui/card.tsx`, `button.tsx`, `input.tsx`, `label.tsx` — all present

### RAG Streaming Endpoint (MUST read before building testing console)
- `app/api/chat/[botId]/route.ts` — existing streaming chat endpoint; testing console calls this directly with the bot's own API key; response includes intent, rag_found, latency, source_chunks in a structured wrapper or headers

### Schema (MUST read before writing any new migrations)
- `supabase/migrations/00002_schema.sql` — existing `bots`, `faqs`, `response_templates` tables; personality/guardrails config stored on `bots` table or a separate `bot_config` record
- `.planning/REQUIREMENTS.md` §Architecture Constraints — service role client for all mutations

### Architecture Constraints
- `.planning/PROJECT.md` §Constraints — Next.js App Router patterns, shadcn/ui only, Tailwind CSS, service role key never in NEXT_PUBLIC_ vars
- `supabase/migrations/00008_api_keys.sql` — last migration; any new Phase 4 migrations start at 00009

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/dialog.tsx` — already installed; use for FAQ/template modals (exact same usage as Phase 3 API key show-once modal)
- `components/ui/tabs.tsx` — already installed; use for bot detail page sub-nav tabs
- `app/dashboard/bots/[botId]/api-keys/page.tsx` — inline confirm row pattern (revokingKeyId state) can be reused for FAQ delete confirmations; `formatRelativeTime` utility can be extracted
- `components/ui/sonner.tsx` + `toast` — already used in Phase 3; use same toast pattern for config save confirmations

### Established Patterns
- **'use client' + useParams()** — all bot-scoped pages use this pattern; no server components for bot-specific data fetches
- **Service role client for mutations** — API routes use `lib/supabase/service.ts`; never expose SERVICE_ROLE_KEY via NEXT_PUBLIC_
- **bot_id isolation** — every DB query scoped by bot_id; RLS enforced
- **params typed as Promise<{botId}>** with `await params` — Next.js 16 requirement in API routes
- **Card + CardHeader + CardContent** layout — standard for all admin sections (api-keys page is the reference)
- **Streaming response consumption** — testing console must use `ReadableStream` / `fetch` with streaming to consume `app/api/chat/[botId]/route.ts`'s streamed response

### Integration Points
- `app/dashboard/bots/page.tsx` — currently a placeholder; Phase 4 builds this out as the bots list
- `app/dashboard/bots/[botId]/` — add `personality/page.tsx`, `guardrails/page.tsx`, `faqs/page.tsx`, `templates/page.tsx`, `testing/page.tsx`
- `app/dashboard/layout.tsx` — sidebar nav already links to `/dashboard/bots`; no changes needed to the outer layout
- `supabase/migrations/` — new migration 00009 if `bots` table needs new config columns (guardrails fields, etc.) or if `bot_config` table is needed
- Testing console calls `POST /api/chat/[botId]` directly with `X-API-Key` header — admin must have an active API key to use the console (or console bypasses with service role)

</code_context>

<specifics>
## Specific Ideas

- The expandable debug panel per bot response ("View details" toggle) should match the visual density of the existing Card/Badge pattern — use a subtle border-top divider inside the chat bubble rather than a separate card
- Language filter dropdown on FAQ/template lists is a simple select, not a full filter bar — keep it lightweight
- The bots list page should be minimal for Phase 4: bot name, status badge (active/inactive), and a "Configure" link to the bot detail page — nothing more

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-admin-dashboard*
*Context gathered: 2026-03-22*
