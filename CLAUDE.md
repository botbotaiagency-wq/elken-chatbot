# CLAUDE.md — BotBase v2 Project Memory
# BotBase by Iceberg AI Solutions

This file is the persistent memory for Claude Code across all sessions.
Read this FIRST before writing any code. Then read BOTBASE_V2_SPEC.md.

---

## WHAT THIS IS

BotBase v2 — a multi-tenant AI chatbot SaaS platform. WhatsApp/Telegram/Web.
Built on top of the v1 Elken chatbot system. See BOTBASE_V2_SPEC.md for full spec.

Repo: https://github.com/botbotaiagency-wq/elken-chatbot.git (main branch)

---

## TECH STACK

- Next.js (latest, App Router), TypeScript strict
- Supabase (Postgres + pgvector + Realtime + Storage + Auth)
- Claude API: claude-haiku-4-5-20251001 (chat), claude-sonnet-4-6 (complex)
- VoyageAI: voyage-3-large (embeddings, 1024-dim)
- Tailwind CSS + shadcn/ui
- Vercel (hosting + cron)
- ReactFlow (flow builder — new in v2)
- Resend (email — new in v2)

---

## CRITICAL PATTERNS — NEVER VIOLATE

### 1. Next.js App Router params
```typescript
// ALWAYS await params in route handlers
export async function POST(
  request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params  // MUST await
}
```

### 2. Two Supabase clients — use correct one
```typescript
// Dashboard pages / Server Components → SSR client
import { createClient } from '@/lib/supabase/server'

// API routes / cron / webhook handlers → Service role
import { createServiceClient } from '@/lib/supabase/service'

// NEVER use service role in client components
// NEVER expose SUPABASE_SERVICE_ROLE_KEY via NEXT_PUBLIC_*
```

### 3. Bot_id isolation — EVERY query
```typescript
// ALWAYS scope by bot_id. No exceptions.
const { data } = await supabase
  .from('contacts')
  .select('*')
  .eq('bot_id', botId)  // MANDATORY
```

### 4. Booking state BEFORE intent detection
```typescript
// In pipeline: check booking state FIRST
const bookingState = context.metadata?.booking
if (bookingState) {
  return handleBookingFlow(bookingState, message)
}
// Only then detect intent
const { intent, language } = await detectIntentAndLanguage(message)
```

### 5. voyageai ESM patch
- `scripts/patch-voyageai-esm.cjs` — DO NOT REMOVE
- `postinstall` script in package.json — DO NOT REMOVE
- `serverExternalPackages` in next.config.ts — DO NOT REMOVE

### 6. Stream first, log after
```typescript
// Fire-and-forget logging — never await in stream path
const stream = new ReadableStream({ ... })
// After stream: logMessage().catch(console.error)  // not awaited
return new Response(stream)
```

### 7. Service role only for trusted operations
- Chat API routes: use anon client with RLS
- Ingest/admin/cron: use service role client
- Webhook handlers: use service role client

---

## FILE STRUCTURE (KEY PATHS)

```
app/api/chat/[botId]/route.ts      — Main chat endpoint
app/api/webhook/whatsapp/route.ts  — WhatsApp native webhook (v2)
app/api/webhook/telegram/route.ts  — Telegram native webhook (v2)
app/api/widget/[botId]/chat/route.ts — Web widget endpoint (v2)
lib/pipeline/index.ts              — 10-step pipeline orchestrator (v2)
lib/channels/whatsapp.ts           — Meta Cloud API integration (v2)
lib/channels/telegram.ts           — Telegram Bot API (v2)
lib/crm/contacts.ts                — Contact upsert logic (v2)
lib/scripts/executor.ts            — Flow builder execution engine (v2)
supabase/migrations/               — SQL migrations (00001-00024 in v2)
types/database.ts                  — All TypeScript DB types
```

---

## DATABASE TABLES (V2)

### Existing (v1)
- tenants, bots, profiles
- documents, chunks, faqs, products
- conversations, messages
- bookings, facilities_config
- api_keys, response_templates
- audit_log (on bookings)

### New (v2) — see BOTBASE_V2_SPEC.md Section 5
- channel_configs (00016)
- contacts (00017)
- bot_scripts, bot_script_versions (00018)
- broadcast_campaigns, broadcast_recipients, drip_sequences (00019)
- agent_profiles, agent_sessions (00020)
- followup_rules, followup_queue (00021)
- messages.sentiment, conversations.contact_id (00022 ALTER)
- widget_configs (00023)
- tenant_invites, onboarding_progress (00024)

---

## ENVIRONMENT VARIABLES

```bash
# Required (all environments)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=           # https://app.botbase.ai

# Required for features
OPENAI_API_KEY=                # Whisper voice transcription
GOOGLE_CLIENT_ID=              # Google Calendar + SSO
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=                # Email: invites, booking confirmations
WEBHOOK_VERIFY_SECRET=         # WhatsApp webhook HMAC validation
```

---

## SUPABASE PROJECT

- Project ref: cbijybbibblyagkarvtw
- Region: Singapore
- Dashboard: https://supabase.com/dashboard/project/cbijybbibblyagkarvtw

**IMPORTANT:** Run migrations in Supabase SQL Editor directly.
Port 5432 is blocked on some networks. Do NOT use `supabase db push` unless
you've confirmed connectivity. Use SQL Editor → New Query → paste migration SQL.

---

## KNOWN ISSUES / GOTCHAS

1. **match_threshold was 0.55, adjusted to 0.3 for Elken** — stored in bot config per bot
2. **mandatory_disclaimer in guardrails** — if set, it overrides health queries. Keep nullable.
3. **voyageai@0.2.x** — broken ESM directory imports, patched via postinstall
4. **Next.js 16 params** — Promise<{botId}> pattern required
5. **Booking responses are NOT streamed** — plain text Response (state machine output)
6. **Analytics RPCs use SECURITY DEFINER** — bypass RLS intentionally for aggregate queries
7. **cacheComponents: true** in next.config.ts — incompatible with `export const dynamic` on some routes

---

## BOT IDs

- Elken "Ask Ethan Digital": 6176aa27-ce33-4dbc-b478-407414f86cac
- Dr Aiman Klinik TTDI Bangi: (see Bots table after seed)

---

## CURRENT v1 STATUS

All 7 phases complete. System live at elken-whatsapp-chatbot.vercel.app.
Telegram bot working. WhatsApp via n8n (to be replaced with native in v2).
3 notification gaps identified in v1 audit (see v1_0-MILESTONE-AUDIT.md).

---

## BUILD PRIORITY (v2)

1. Database migrations (foundation for everything)
2. Channel engine (WhatsApp native — remove n8n dependency)
3. Pipeline refactor with debug logging
4. Enhanced conversation log (pipeline debug view)
5. CRM / contacts
6. Broadcasts + follow-ups
7. Flow builder
8. Web widget
9. Onboarding wizard
10. Live agent handoff

---

## BRAND

Product: BotBase
Company: Iceberg AI Solutions
Tagline: "The Most Complete AI Agent Platform"
Primary color: #6366f1 (Indigo)
Accent: #22d3ee (Cyan)
Theme: Dark-first, professional

---

*Last updated: 2026-04-08 | v2 spec ready for build*
