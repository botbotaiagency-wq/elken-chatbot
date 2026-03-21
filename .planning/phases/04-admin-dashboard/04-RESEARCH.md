# Phase 4: Admin Dashboard - Research

**Researched:** 2026-03-22
**Domain:** Next.js App Router dashboard UI — config forms, CRUD modals, streaming chat console
**Confidence:** HIGH

## Summary

Phase 4 builds entirely on patterns established in Phases 1-3. Every UI primitive needed is already installed (shadcn/ui dialog, tabs, badge, card, button, input, label, sonner). The route pattern is locked: `'use client' + useParams()` pages under `app/dashboard/bots/[botId]/`. The mutation pattern is locked: API routes using service role client, never exposing SERVICE_ROLE_KEY.

The main technical challenges are: (1) deciding where to store the new config fields (adding columns to the existing `bots` table vs. a new `bot_config` table), (2) consuming the existing streaming chat endpoint correctly in the testing console, and (3) exposing the per-response metadata (intent, rag_found, latency, source_chunks) that the endpoint already emits via response headers and post-stream logging.

The schema gap is the critical path item: the `bots` table currently has only `id, tenant_id, name, api_key_hash, feature_flags, created_at`. All personality and guardrails fields need to be added via migration 00009. The `faqs` and `response_templates` tables already exist with the correct structure.

**Primary recommendation:** Add personality and guardrails columns directly to the `bots` table via migration 00009. The FAQs and response_templates tables are already correctly structured for CRUD. Build the testing console as a 'use client' component that calls `POST /api/chat/[botId]` with a service-role-issued API key (or bypass), consuming the stream via `fetch` + `ReadableStream` and reading headers for metadata.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Config Page Navigation**
- Each config section is a separate route under the bot: `/bots/[botId]/personality`, `/bots/[botId]/guardrails`, `/bots/[botId]/faqs`, `/bots/[botId]/templates`, `/bots/[botId]/testing`
- This continues the established Phase 3 pattern (api-keys and integrations are already separate routes under `[botId]`)
- Bot detail page (`/bots/[botId]`) shows horizontal tabs across the top for sub-navigation: Personality | Guardrails | FAQs | Templates | Testing | API Keys | Integrations
- Phase 4 also builds the `/bots` list page — a table/card list of bots with name, status, and a link to each bot's detail page — as the entry point to all bot config pages
- Existing sidebar nav (Overview, Bots, Knowledge, Bookings, Analytics, Settings) stays unchanged; "Bots" links to `/bots` list

**Config Save UX**
- Save button per section: each config section (Personality, Guardrails) has its own "Save changes" button at the bottom of the form
- Admin edits the entire section form then clicks save — no auto-save on blur
- On save: writes to DB immediately, toast confirms "Bot configuration saved." — takes effect immediately on next bot request
- No draft/publish workflow — changes go live instantly

**Personality Form Layout**
- Three separate labeled textareas stacked vertically for per-language greetings: Greeting (EN), Greeting (BM), Greeting (ZH) — all visible simultaneously for easy comparison
- Same pattern applies anywhere else with EN/BM/ZH variants in the personality form
- Personality fields: bot name (text input), greeting per language (3 textareas), tone (select: Professional / Friendly / Formal), fallback message (textarea)

**Testing Console Layout**
- Chat UI styled like WhatsApp/Telegram — user messages right-aligned, bot messages left-aligned, in a scrollable chat window
- Debug metadata (source chunks, intent, latency, rag_found) appears in an expandable panel below each bot response — a small "View details" toggle expands to show: intent classification, RAG found status, latency in ms, and source chunks (doc name + similarity score + content preview)
- Details collapsed by default — admin expands on demand; most natural chat feel with debug on demand
- Language override: dropdown in the console toolbar — "Language: Auto | EN | BM | ZH". Auto = detect from message; selecting a language forces all responses into that language
- Streaming: typing indicator ("...") shown while waiting for first token, then text streams into the chat bubble in real time as tokens arrive — matching the live RAG stream from `app/api/chat/[botId]/route.ts`
- Reset button in toolbar: clears conversation history and starts a fresh session (new conversationId)

**Guardrails Form Layout**
- Guardrails fields: blocked topic keywords (multi-line textarea, one keyword per line), custom refuse message (textarea), mandatory disclaimer text (textarea), max response length (number input), off-topic deflection message (textarea)
- Save button per section, same pattern as Personality

**FAQ Management**
- FAQ list: table with columns — Question, Language (badge), Answer preview, Edit/Delete actions
- Language filter dropdown above the list: All | EN | BM | ZH — filters the visible rows
- Modal dialog for create/edit: question (textarea), answer (textarea), language (select: EN / BM / ZH)
- Modal uses shadcn/ui Dialog — consistent with Phase 3 API key show-once modal pattern
- Delete: inline confirm row (same inline-confirm pattern as Phase 3 key revocation — no separate dialog)

**Response Template Management**
- Templates list: table with columns — Intent, Language variants present (badges), Edit action
- 5 intents: `no_product_found`, `slot_full`, `booking_confirmed`, `reminder_24h`, `post_survey`
- Language filter dropdown above the list: All | EN | BM | ZH
- Modal dialog for editing: shows all three variants simultaneously — EN textarea, BM textarea, ZH textarea stacked vertically (same pattern as personality greetings)
- No delete (templates are tied to fixed intents — edit-only, not deleteable)

### Claude's Discretion
- Exact DB API routes for config CRUD (route naming, HTTP method choices)
- shadcn/ui component variants (e.g., textarea sizing, card layout density)
- Empty state illustrations/messaging for empty FAQ/template lists
- Exact chunk content preview length in the debug panel
- Pagination vs infinite scroll for FAQ/template lists (small seeded list — plain list is fine)
- Whether to use `react-hook-form` + `zod` or plain controlled state for config forms

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONF-01 | Admin can configure bot name, greeting message per language (EN/BM/ZH), and tone (Professional/Friendly/Formal) | Personality fields go on `bots` table via migration 00009; form is 'use client' with controlled state, PATCH to `/api/config/[botId]/personality` |
| CONF-02 | Admin can configure a fallback message for when RAG finds nothing | Single textarea field on `bots` table; part of the personality form save |
| CONF-03 | Admin can configure guardrails: blocked topic keywords, custom refuse message, mandatory disclaimer, max response length, off-topic deflection | Guardrails fields go on `bots` table (jsonb column `guardrails` or individual columns); PATCH to `/api/config/[botId]/guardrails` |
| CONF-04 | Admin can create, edit, and delete response templates tied to specific intents with EN/BM/ZH variants | `response_templates` table already exists with `(bot_id, intent_key, language)` unique constraint; CRUD via `/api/config/[botId]/templates` |
| CONF-05 | Admin can create, edit, and delete FAQ pairs with language tag; pre-seeded Elken FAQs | `faqs` table already exists; CRUD via `/api/config/[botId]/faqs`; seed data in migration 00009 or separate seed script |
| TEST-01 | Admin can send messages in a live chat UI styled like WhatsApp/Telegram | 'use client' component calls `POST /api/chat/[botId]`; messages/responses stored in component state |
| TEST-02 | Each response shows: source chunks, intent, response time, rag_found | Chat endpoint already emits `X-Intent`, `X-Rag-Found`, `X-Language`, `X-Conversation-Id` headers; latency calculated client-side; source_chunks require a second fetch from messages table after stream completes |
| TEST-03 | Language can be overridden (EN/BM/ZH) in the testing console | Pass `language_override` field in POST body; chat route must accept and honor it |
| TEST-04 | Admin can reset the conversation to start a fresh test session | Clear component state + generate new conversationId (uuid or null to trigger new conversation) |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.x (installed) | Page routing, API routes | Already in use; established patterns |
| React | 19.x (installed) | Component state, hooks | Already in use |
| shadcn/ui | installed | UI components | Project mandate — no other component library |
| Tailwind CSS | 3.4.x (installed) | Styling | Project mandate |
| Supabase JS | latest (installed) | DB queries | Already in use; service role for mutations |
| sonner | 2.0.7 (installed) | Toast notifications | Already used in Phase 3 |
| lucide-react | 0.511.0 (installed) | Icons | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | (Claude's discretion) | Form state management | If form complexity justifies it; simple forms can use controlled state |
| zod | (Claude's discretion) | Schema validation | Pairs with react-hook-form; also usable standalone in API routes |

**Decision guidance on react-hook-form + zod:** The config forms (Personality, Guardrails) are flat forms with 5-8 fields each. Controlled state with `useState` is sufficient and matches Phase 3's pattern. `react-hook-form` adds value if form validation UX (inline errors, dirty-state tracking) is important. Given Claude's discretion, prefer controlled state for simpler forms (Personality, Guardrails) and add validation in the API route.

**No new packages required.** Everything needed is already installed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Controlled state | react-hook-form | react-hook-form adds dirty detection and field-level errors; controlled state is simpler to follow |
| bots table columns | Separate bot_config table | One new table vs. columns on existing table; columns simpler for a single-bot config, table better for multi-bot with config versioning |

**Installation:**
```bash
# No new installs required
```

---

## Architecture Patterns

### Recommended Project Structure

Phase 4 adds these files to the existing structure:

```
app/
├── dashboard/bots/
│   ├── page.tsx                          # BUILD OUT: bots list (currently placeholder)
│   └── [botId]/
│       ├── page.tsx                      # CREATE: bot detail with horizontal tabs (Personality | Guardrails | FAQs | Templates | Testing | API Keys | Integrations)
│       ├── personality/
│       │   └── page.tsx                  # CREATE: personality config form
│       ├── guardrails/
│       │   └── page.tsx                  # CREATE: guardrails config form
│       ├── faqs/
│       │   └── page.tsx                  # CREATE: FAQ CRUD table + modal
│       ├── templates/
│       │   └── page.tsx                  # CREATE: template CRUD table + modal
│       ├── testing/
│       │   └── page.tsx                  # CREATE: live chat testing console
│       ├── api-keys/
│       │   └── page.tsx                  # EXISTING — no changes
│       └── integrations/
│           └── page.tsx                  # EXISTING — no changes
app/api/
├── chat/[botId]/route.ts                 # EXISTING — minor: add language_override body param
└── config/
    └── [botId]/
        ├── personality/route.ts          # CREATE: GET + PATCH personality fields
        ├── guardrails/route.ts           # CREATE: GET + PATCH guardrails fields
        ├── faqs/route.ts                 # CREATE: GET + POST + DELETE
        └── templates/route.ts           # CREATE: GET + PATCH (no delete)
supabase/migrations/
└── 00009_bot_config.sql                  # CREATE: new columns on bots + RLS
```

### Pattern 1: Config Section Page (Personality / Guardrails)

The config form pages follow the exact same shape as `api-keys/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Toaster } from '@/components/ui/sonner'

export default function PersonalityPage() {
  const params = useParams()
  const botId = params.botId as string

  const [botName, setBotName] = useState('')
  const [greetingEn, setGreetingEn] = useState('')
  // ... other fields
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/config/${botId}/personality`)
      .then(r => r.json())
      .then(data => {
        setBotName(data.name ?? '')
        setGreetingEn(data.greeting_en ?? '')
        // ...
      })
  }, [botId])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/personality`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: botName, greeting_en: greetingEn, /* ... */ }),
      })
      if (!res.ok) throw new Error()
      toast.success('Bot configuration saved.')
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Toaster />
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Personality</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* form fields */}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
```

### Pattern 2: Bot Detail Page with Horizontal Tabs

The bot detail page `app/dashboard/bots/[botId]/page.tsx` is the tab container. The existing `Tabs` component is already installed and used in `integrations/page.tsx` — but for tab-based page navigation (not just visual tabs), we need either router-based navigation or client-side tab state that conditionally renders sub-routes.

**Important architectural decision:** The locked decision says each config section is a **separate route** AND the bot detail page shows **horizontal tabs**. This creates a design choice:

Option A: Bot detail page (`/bots/[botId]`) renders tab UI where each tab click navigates to the sub-route. Tabs highlight the active route based on `usePathname()`. Each sub-route page renders only the tab content (the tab bar is in the parent layout).

Option B: Bot detail page is a pure redirect to the first tab (`/personality`), and a shared layout for `[botId]` renders the tab navigation.

**Recommendation:** Use a `layout.tsx` at `app/dashboard/bots/[botId]/layout.tsx` that renders the horizontal tab bar, with tab links pointing to the sub-routes (`/bots/[botId]/personality`, etc.). The `[botId]/page.tsx` redirects to `/bots/[botId]/personality`. This keeps each config page independent (separate routes as required) while maintaining the shared tab bar.

```typescript
// app/dashboard/bots/[botId]/layout.tsx
'use client'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS = [
  { label: 'Personality', path: 'personality' },
  { label: 'Guardrails', path: 'guardrails' },
  { label: 'FAQs', path: 'faqs' },
  { label: 'Templates', path: 'templates' },
  { label: 'Testing', path: 'testing' },
  { label: 'API Keys', path: 'api-keys' },
  { label: 'Integrations', path: 'integrations' },
]

export default function BotLayout({ children }: { children: React.ReactNode }) {
  const { botId } = useParams() as { botId: string }
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b">
        {TABS.map(tab => {
          const href = `/dashboard/bots/${botId}/${tab.path}`
          const active = pathname.startsWith(href)
          return (
            <Link
              key={tab.path}
              href={href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
```

### Pattern 3: FAQ CRUD — Table + Modal + Inline Confirm

Follow the `api-keys/page.tsx` inline confirm pattern exactly. The modal for create/edit uses `shadcn/ui Dialog` already installed:

```typescript
// Pattern: FAQ delete with inline confirm (mirrors revokingKeyId pattern)
const [deletingFaqId, setDeletingFaqId] = useState<string | null>(null)

// In table row:
{deletingFaqId === faq.id && (
  <tr key={`${faq.id}-confirm`} className="bg-destructive/5">
    <td colSpan={4} className="px-2 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-destructive">Delete this FAQ?</span>
        <Button variant="destructive" size="sm" onClick={() => handleDelete(faq.id)}>
          Yes, delete
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDeletingFaqId(null)}>
          Cancel
        </Button>
      </div>
    </td>
  </tr>
)}
```

### Pattern 4: Streaming Testing Console

The most technically complex page. The chat endpoint at `POST /api/chat/[botId]` returns:
- Body: streamed plain text (Claude tokens, `text/plain; charset=utf-8`)
- Headers: `X-Conversation-Id`, `X-Intent`, `X-Language`, `X-Rag-Found`
- **Latency:** Not in headers — must be measured client-side (`Date.now()` before/after fetch)
- **Source chunks:** Not in headers — stored in `messages` table after stream completes; must be fetched via a second API call after stream ends

The console needs to:
1. `fetch` the chat endpoint with `{method: 'POST', body: JSON.stringify({...})}` — do NOT use `response.json()`, use `response.body` as a `ReadableStream`
2. Read `response.headers` immediately after fetch (before consuming body) to get `X-Intent`, `X-Rag-Found`, `X-Conversation-Id`
3. Consume `response.body` via `ReadableStream` + `TextDecoder` to stream tokens into a state string
4. After stream completes, fetch source chunks from `/api/config/[botId]/messages/[conversationId]/last` (new utility endpoint needed)

```typescript
async function sendMessage(text: string) {
  const startTime = Date.now()
  const msgId = crypto.randomUUID()

  // Optimistically add user message
  setMessages(prev => [...prev, { id: msgId, role: 'user', content: text }])

  // Add pending bot message
  const botMsgId = crypto.randomUUID()
  setMessages(prev => [...prev, { id: botMsgId, role: 'assistant', content: '', pending: true }])

  const res = await fetch(`/api/chat/${botId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': activeApiKey,  // must have an active key
    },
    body: JSON.stringify({
      message: text,
      userId: 'admin-test',
      channel: 'web',
      conversationId: currentConversationId || undefined,
      language_override: languageOverride !== 'auto' ? languageOverride : undefined,
    }),
  })

  // Read metadata from headers immediately
  const intent = res.headers.get('X-Intent')
  const ragFound = res.headers.get('X-Rag-Found') === 'true'
  const conversationId = res.headers.get('X-Conversation-Id')
  setCurrentConversationId(conversationId)

  // Stream the body
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    fullText += chunk
    setMessages(prev => prev.map(m =>
      m.id === botMsgId ? { ...m, content: fullText, pending: false } : m
    ))
  }

  const latencyMs = Date.now() - startTime

  // After stream: fetch source chunks
  // (requires a new utility API endpoint that queries messages table)
  const chunksRes = await fetch(`/api/config/${botId}/debug?conversationId=${conversationId}`)
  const debugData = chunksRes.ok ? await chunksRes.json() : null

  setMessages(prev => prev.map(m =>
    m.id === botMsgId
      ? { ...m, intent, ragFound, latencyMs, sourceChunks: debugData?.source_chunks ?? [] }
      : m
  ))
}
```

**API key for testing console:** The testing console must call `POST /api/chat/[botId]` with a valid API key. Options:
1. Admin must have at least one active key; the testing page fetches the key list and uses the first active key's prefix — but the plaintext key is never stored, so this doesn't work.
2. Testing console calls a new internal endpoint `/api/config/[botId]/test-chat` that uses the service role client directly, bypassing API key auth. This is cleaner and avoids exposing any key.
3. Testing console generates a temporary internal session token.

**Recommendation (Claude's discretion):** Create `/api/config/[botId]/test-chat` as a thin wrapper that calls the RAG pipeline directly (bypassing the API key check entirely), using the service role client. This keeps the testing console self-contained and avoids storing any API key in browser state.

### Pattern 5: Language Override in Chat Route

The chat route must accept an optional `language_override` field in the POST body. When present, it bypasses auto-detection and forces the specified language into the detection result:

```typescript
// In app/api/chat/[botId]/route.ts — add to body parsing:
const { message, userId, channel, conversationId: inputConversationId, language_override } = body

// Pass to detection:
const detection = language_override
  ? { intent: await detectIntent(message), language: language_override }
  : await detectIntentAndLanguage(message)
```

### Anti-Patterns to Avoid

- **Tabs component for navigation:** Do not use shadcn/ui `Tabs` component for the bot detail tab navigation — it renders all tab content in the DOM and doesn't integrate with the router. Use Link-based navigation with `usePathname()` for active state (pattern shown above).
- **Direct DB access in 'use client' pages:** All mutations go through API routes using service role. Never call Supabase directly from browser components.
- **Storing full plaintext API key in component state for testing console:** Create a dedicated internal test endpoint instead.
- **Reading headers after consuming body:** `response.headers` must be accessed immediately after `fetch()` resolves, before the body stream is consumed. The headers are available as soon as the response starts.
- **Not scoping source_chunks fetch by bot_id:** The debug endpoint must verify the conversation belongs to the requesting bot.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast component | `sonner` (already installed) | Handles positioning, stacking, dismiss |
| Modal dialogs | Custom overlay/portal | `shadcn/ui Dialog` (already installed) | Focus trap, escape key, accessibility |
| Language badges | Custom badge component | `shadcn/ui Badge` (already installed) | Consistent styling |
| Tab navigation styling | CSS active state manual | `usePathname()` + conditional className | Single source of truth for active route |
| Streaming text consumption | EventSource / SSE parsing | Native `fetch` + `ReadableStream` | Endpoint returns `text/plain` stream, not SSE |

**Key insight:** Zero new packages needed. Every piece of UI infrastructure for this phase is already installed. The only "new" technical work is the streaming consumer logic and the bot_config migration.

---

## Common Pitfalls

### Pitfall 1: Reading Metadata After the Stream
**What goes wrong:** Source chunks are logged to the `messages` table *after* the stream completes (see line 175-185 in `chat/[botId]/route.ts` — `logMessage` is called inside `readable.start` after the loop). The client cannot read them from headers because they don't exist until the stream closes.
**Why it happens:** The RAG pipeline accumulates source_chunks and logs them post-stream to avoid blocking the stream start.
**How to avoid:** After the stream body is fully consumed, call a separate API endpoint to fetch the last assistant message's `source_chunks` from the messages table using the `conversationId` from headers.
**Warning signs:** Empty source chunks in the debug panel despite `rag_found = true`.

### Pitfall 2: Bot Config Not Applied to Chat Responses
**What goes wrong:** Admin saves personality/guardrails config but the chat endpoint ignores it because `buildSystemPrompt` in `lib/rag/prompt.ts` doesn't read from the `bots` table.
**Why it happens:** Phase 2 hardcoded the system prompt; Phase 4 needs it to be dynamic.
**How to avoid:** The chat route must fetch the bot's config columns (personality, guardrails) from the `bots` table and pass them to `buildSystemPrompt`. This is a required change to `app/api/chat/[botId]/route.ts` in Phase 4.
**Warning signs:** Config saved successfully but chat responses don't reflect the changes.

### Pitfall 3: Tabs Component vs. Route-Based Navigation
**What goes wrong:** Using shadcn/ui `Tabs` component at the bot detail page level causes all tab panels to be rendered but hidden, and page navigation doesn't update the URL.
**Why it happens:** `Tabs` is a client-side state component, not a router.
**How to avoid:** Use the `layout.tsx` + Link navigation pattern described above. The `Tabs` component is fine for in-page content switching (like the WhatsApp/Telegram tabs in integrations page), but not for page-level navigation.
**Warning signs:** Back button doesn't return to the expected tab; deep-linking to `/bots/[botId]/faqs` doesn't activate the FAQs tab.

### Pitfall 4: Missing `SELECT` Textarea shadcn Component
**What goes wrong:** Plan references a `<select>` or `<Select>` for tone/language dropdowns but `components/ui/select.tsx` is NOT installed (checked: only badge, button, card, checkbox, dialog, dropdown-menu, input, label, sonner, tabs are present).
**Why it happens:** shadcn/ui components are installed individually; Select was not included in earlier phases.
**How to avoid:** Either install `shadcn/ui add select` or use a native `<select>` styled with Tailwind. For a dashboard with minimal dropdowns (tone: 3 options, language filter: 4 options), a styled native `<select>` is fine. Alternatively, use the already-installed `dropdown-menu` for these choices.
**Warning signs:** Import error for `@/components/ui/select`.

### Pitfall 5: `response_templates` Unique Constraint on Edit
**What goes wrong:** When editing a template's language variant, an UPSERT on `(bot_id, intent_key, language)` fails if the row already exists and the UPDATE logic is wrong.
**Why it happens:** The `response_templates` table has `UNIQUE (bot_id, intent_key, language)` (from 00002_schema.sql line 91).
**How to avoid:** Use Supabase's `.upsert()` with `onConflict: 'bot_id,intent_key,language'` or issue a targeted UPDATE by `id`. The edit modal should load the existing row IDs for all three language variants so the API can UPDATE by ID rather than upsert.
**Warning signs:** 409 conflict errors when saving templates.

### Pitfall 6: Testing Console API Key Requirement
**What goes wrong:** `POST /api/chat/[botId]` requires an API key (or dev-mode bypass). After Phase 3, the dev-mode bypass is removed — the endpoint rejects requests without `X-API-Key` when `bot.api_key_hash` is set.
**Why it happens:** Phase 3 tightened API key enforcement.
**How to avoid:** Create a dedicated `/api/config/[botId]/test-chat` route that uses the service role client directly to call the RAG pipeline, bypassing API key validation entirely. This route is only reachable from the authenticated dashboard.
**Warning signs:** Testing console returns 401 even when admin is logged in.

---

## Code Examples

### Config API Route — GET + PATCH Pattern

```typescript
// app/api/config/[botId]/personality/route.ts
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('bots')
    .select('name, greeting_en, greeting_bm, greeting_zh, tone, fallback_message')
    .eq('id', botId)
    .single()

  if (error || !data) {
    return Response.json({ error: 'Bot not found' }, { status: 404 })
  }

  return Response.json(data)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const body = await req.json()
  const { name, greeting_en, greeting_bm, greeting_zh, tone, fallback_message } = body

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('bots')
    .update({ name, greeting_en, greeting_bm, greeting_zh, tone, fallback_message })
    .eq('id', botId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
```

### Migration 00009 — Bot Config Columns

```sql
-- 00009_bot_config.sql
-- Phase 4: Add personality and guardrails config to bots table

-- Personality fields
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS greeting_en        text,
  ADD COLUMN IF NOT EXISTS greeting_bm        text,
  ADD COLUMN IF NOT EXISTS greeting_zh        text,
  ADD COLUMN IF NOT EXISTS tone               text DEFAULT 'Professional'
                                              CHECK (tone IN ('Professional', 'Friendly', 'Formal')),
  ADD COLUMN IF NOT EXISTS fallback_message   text;

-- Guardrails fields
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS blocked_keywords       text,   -- newline-separated keywords
  ADD COLUMN IF NOT EXISTS refuse_message         text,
  ADD COLUMN IF NOT EXISTS disclaimer_text        text,
  ADD COLUMN IF NOT EXISTS max_response_length    integer DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS off_topic_message      text;

-- No new table needed — all config lives on bots
-- faqs and response_templates already exist with correct structure
```

### FAQ API Route Pattern

```typescript
// app/api/config/[botId]/faqs/route.ts
// GET: list all FAQs for bot (filtered by language query param if provided)
// POST: create new FAQ
// DELETE: delete FAQ by id (body: { faqId })
```

### Streaming Consumption in Testing Console

```typescript
// Consume fetch body as stream — no SSE, plain text chunks
const res = await fetch(`/api/config/${botId}/test-chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: text, userId: 'admin-test', channel: 'web', conversationId }),
})

// Headers available immediately
const intent = res.headers.get('X-Intent')
const ragFound = res.headers.get('X-Rag-Found') === 'true'
const newConversationId = res.headers.get('X-Conversation-Id')

// Stream body
const reader = res.body!.getReader()
const decoder = new TextDecoder()
let accumulated = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  accumulated += decoder.decode(value, { stream: true })
  // update state incrementally here
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` for Supabase session | `proxy.ts` + `lib/supabase/middleware.ts` | Next.js 16 | Already handled in Phase 1 |
| `params.botId` direct access | `const { botId } = await params` | Next.js 16 | Already established in Phase 3 — all API routes use `await params` |
| `pdfParse(buffer)` | `new PDFParse({ data: buffer })` | pdf-parse v2 | Phase 2 decision — no impact on Phase 4 |
| shadcn/ui `Select` component | Native `<select>` or dropdown-menu | N/A | `select.tsx` not installed; use native `<select>` styled with Tailwind |

**Deprecated/outdated:**
- Using shadcn/ui `Tabs` for top-level route navigation: wrong tool; use Link + usePathname instead.
- `dev-mode` API key bypass: still present but cannot be relied on for the testing console after Phase 3 enforcement.

---

## Open Questions

1. **Source chunks format for debug panel**
   - What we know: `messages.source_chunks` stores `[{ chunk_id, similarity }]` (see `logMessage` call in route.ts lines 182). The document name is NOT stored in source_chunks — only the chunk UUID and similarity score.
   - What's unclear: To display "doc name + similarity + content preview" as required by TEST-02, we need to JOIN chunks/faqs/products on their IDs. This requires a new query or a utility endpoint.
   - Recommendation: Create `/api/config/[botId]/debug?conversationId=X` that fetches the last assistant message, joins source_chunks IDs against the chunks, faqs, and products tables to get document name + content preview + similarity. This is a read-only endpoint, service role.

2. **How chat route applies config (personality/guardrails)**
   - What we know: `buildSystemPrompt` in `lib/rag/prompt.ts` currently takes `{ retrieval, detection }` and returns a hardcoded system prompt.
   - What's unclear: The exact mechanism for injecting bot name, greeting, tone, guardrails keywords, disclaimer text into the prompt is not yet designed.
   - Recommendation: Modify `buildSystemPrompt` to accept an optional `botConfig` parameter. The chat route fetches config columns from the `bots` table (already fetched for bot existence check) and passes them through. This is a required Phase 4 change.

3. **Bots list page: which bots to show?**
   - What we know: The dashboard uses tenant-scoped RLS. The service role client bypasses RLS.
   - What's unclear: The bots list API should scope to the logged-in user's tenant. Since API routes use service role (which bypasses RLS), tenant scoping must be done explicitly by reading the user's `tenant_id` from the session.
   - Recommendation: The bots list page fetches `/api/bots` which creates a server-side Supabase client, reads the authenticated user's session, looks up their `tenant_id` from `profiles`, then queries `bots` scoped by `tenant_id`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/api/config.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONF-01 | PATCH `/api/config/[botId]/personality` saves name, greetings, tone | unit | `npx vitest run tests/api/config.test.ts` | ❌ Wave 0 |
| CONF-02 | PATCH personality saves fallback_message | unit | `npx vitest run tests/api/config.test.ts` | ❌ Wave 0 |
| CONF-03 | PATCH `/api/config/[botId]/guardrails` saves all guardrail fields | unit | `npx vitest run tests/api/config.test.ts` | ❌ Wave 0 |
| CONF-04 | GET/POST/PATCH `/api/config/[botId]/templates` CRUD | unit | `npx vitest run tests/api/templates.test.ts` | ❌ Wave 0 |
| CONF-05 | GET/POST/DELETE `/api/config/[botId]/faqs` CRUD | unit | `npx vitest run tests/api/faqs.test.ts` | ❌ Wave 0 |
| TEST-01 | `/api/config/[botId]/test-chat` accepts message, returns stream | unit | `npx vitest run tests/api/test-chat.test.ts` | ❌ Wave 0 |
| TEST-02 | test-chat response headers include X-Intent, X-Rag-Found | unit | `npx vitest run tests/api/test-chat.test.ts` | ❌ Wave 0 |
| TEST-03 | language_override in body forces response language | unit | `npx vitest run tests/api/test-chat.test.ts` | ❌ Wave 0 |
| TEST-04 | Reset generates new conversationId (tested by omitting conversationId) | unit | `npx vitest run tests/api/test-chat.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/api/config.test.ts tests/api/faqs.test.ts tests/api/templates.test.ts tests/api/test-chat.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api/config.test.ts` — covers CONF-01, CONF-02, CONF-03 (personality + guardrails API routes)
- [ ] `tests/api/faqs.test.ts` — covers CONF-05 (FAQ CRUD API)
- [ ] `tests/api/templates.test.ts` — covers CONF-04 (template CRUD API)
- [ ] `tests/api/test-chat.test.ts` — covers TEST-01, TEST-02, TEST-03, TEST-04

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `app/api/chat/[botId]/route.ts` — streaming pattern, headers emitted, authentication logic
- Direct code inspection of `supabase/migrations/00002_schema.sql` — existing table structure for bots, faqs, response_templates
- Direct code inspection of `supabase/migrations/00008_api_keys.sql` — last migration number, RLS pattern
- Direct code inspection of `app/dashboard/bots/[botId]/api-keys/page.tsx` — 'use client' + useParams + inline confirm pattern
- Direct code inspection of `app/dashboard/bots/[botId]/integrations/page.tsx` — Tabs usage, CopyButton pattern
- Direct code inspection of `components/ui/` directory listing — confirmed installed components
- Direct code inspection of `package.json` — all package versions, no react-hook-form or zod installed
- Direct code inspection of `vitest.config.ts` + `tests/` directory — test framework and existing files

### Secondary (MEDIUM confidence)
- Next.js App Router layout nesting conventions (layouts wrap child routes; `layout.tsx` at `[botId]/` level applies to all sub-routes) — verified by existing behavior in `app/dashboard/layout.tsx`

### Tertiary (LOW confidence)
- None — all claims are grounded in direct code inspection of the existing codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via package.json inspection
- Architecture: HIGH — patterns verified against existing Phase 3 code
- Pitfalls: HIGH — derived from direct reading of existing route code (e.g., source_chunks format from logMessage calls, API key enforcement from chat route)
- Migration design: HIGH — existing schema read directly; new columns are additive

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack; no fast-moving dependencies added)
