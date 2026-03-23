# Phase 7: Integration and Launch - Research

**Researched:** 2026-03-23
**Domain:** Seed data completion, smoke testing, n8n integration documentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Bot database name is `"Ask Ethan Digital"` (bots.name). Prior seed draft used "Ethan" — update to full brand name.
- **D-02:** Bot greeting is exact text provided by client (see Personality Config section). Tone is friendly with emojis.
- **D-03:** `feature_flags.booking_enabled = true` for the Elken bot.
- **D-04:** Deliver BOTH an automated curl script AND a manual test checklist.
- **D-05:** Automated script targets deployed Vercel URL. Reads `VERCEL_URL` or `SMOKE_TEST_URL` from `.env.local`. Must cover: product enquiry, health concern query, and booking intent — each in EN, BM, and ZH (9 curl calls total). Uses payload shape `{ message, userId, channel, conversationId }` with `X-API-Key` header.
- **D-06:** Manual checklist is a markdown file documenting steps to verify via a real WhatsApp message through a live n8n workflow.
- **D-07:** `scripts/seed-elken.mjs` is the canonical seed file (Node.js, reads `.env.local`, Supabase client, idempotent upserts with friendly console output).
- **D-08:** Delete `supabase/elken-seed.sql` — SQL file is redundant and should not be committed.
- **D-09:** Create `docs/n8n-setup.md` — step-by-step guide covering: create n8n HTTP workflow, configure HTTP Request node (method, URL, headers), set `X-API-Key` header, handle streaming response, map WhatsApp/Telegram payload fields to JSON body.

### Claude's Discretion

- FAQ phrasing and translation quality for GenQi location/hours content (EN/BM/ZH variants) — produce natural, customer-facing language while keeping all factual details exact.
- Number and grouping of GenQi FAQs — aim for comprehensive coverage without excessive overlap.
- Smoke test script format (bash/mjs) — use whatever is most portable on macOS + CI.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEED-01 | Elken tenant, bot ("Ask Ethan Digital"), and all default configuration are created via a seed script with no manual steps | Existing `scripts/seed-elken.mjs` must be updated: bot name to "Ask Ethan Digital", add `booking_enabled: true` to feature_flags, add greeting_en/bm/zh and tone columns to bots upsert |
| SEED-02 | All Elken FAQs (locations, hours, facility rules, booking rules) are pre-seeded in EN, BM, and ZH | GenQi OKR and Subang factual data fully specified in CONTEXT.md; seed must add these FAQs in addition to existing general member FAQs |
| SEED-03 | All Elken response templates (slot_full, booking_confirmed_member, booking_confirmed_nonmember, reminder_24h, post_survey, general_enquiry) are pre-seeded in EN, BM, and ZH | Exact verbatim template strings provided in CONTEXT.md; these replace or extend the existing partial template set |
| SEED-04 | Elken personality config (bot name, greetings per language, booking module enabled) is applied by the seed script | Schema confirmed: greeting_en/bm/zh and tone columns exist on bots table (migration 00009); seed upsert must write these with `ignoreDuplicates: false` (update, not skip) |
</phase_requirements>

---

## Summary

Phase 7 completes the Elken launch data layer and validates the live system. All infrastructure (tables, RLS, API key system, booking engine, analytics) was built in phases 1–6. This phase has three focused deliverables: (1) complete and replace the partial `scripts/seed-elken.mjs` with full Elken data, (2) create `docs/n8n-setup.md` as a step-by-step operator guide, and (3) produce a smoke test script + manual checklist to validate the end-to-end WhatsApp/n8n flow.

The seed script is the most complex deliverable. The existing draft seeds tenant, bot (wrong name), 15 general FAQs, and 5 intent templates. It must be extended to: rename the bot, add personality config (greeting_en/bm/zh, tone, booking_enabled), add ~20–30 GenQi location FAQs in three languages, and add the 6 client-provided response templates (slot_full, booking_confirmed_member, booking_confirmed_nonmember, reminder_24h, post_survey, no_product_found) in three languages each.

A critical schema detail: the existing bot upsert uses `ignoreDuplicates: true`, which means re-running will NOT update the bot name or personality columns if the row already exists. The seed must use a two-step approach: upsert to create, then a separate `update` call to ensure the name and config columns are always written correctly on re-runs.

**Primary recommendation:** Extend `seed-elken.mjs` in-place (do not start from scratch), use `upsert` + separate `update` for the bot row to handle the idempotent-yet-updatable requirement, keep all template placeholders as literal strings, and write the smoke test as a bash script for maximum portability.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | latest (in package.json) | Seed script Supabase client | Already used; createClient with service role key |
| Node.js ESM (.mjs) | Node 18+ | Seed script runtime | Consistent with existing seed-elken.mjs; no transpile step |
| bash | macOS/CI built-in | Smoke test script | Most portable for curl-based HTTP testing |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs.readFileSync` | Node built-in | Parse .env.local | Already used in seed; no dotenv dependency needed |
| `curl` | System CLI | HTTP calls in smoke test | Available on macOS and all CI systems |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bash smoke test | .mjs smoke test | .mjs needs Node; bash runs anywhere without setup |
| bash smoke test | jest/vitest integration test | Too heavy for an operator-run smoke test against live Vercel |

**Installation:** No new dependencies required for this phase.

---

## Architecture Patterns

### Existing Seed Structure to Extend

The existing `scripts/seed-elken.mjs` follows this pattern already — keep it:

```
scripts/
└── seed-elken.mjs     # Extend in-place; the canonical seed
docs/
└── n8n-setup.md       # New: step-by-step operator guide
scripts/
└── smoke-test.sh      # New: 9-call curl smoke test
docs/
└── manual-checklist.md  # New: live WhatsApp verification steps
```

### Pattern 1: Idempotent Upsert + Forced Update for Bot Row

The existing bot upsert uses `ignoreDuplicates: true`, which is correct for initial creation but prevents updates on re-runs. The bot name must change from "Ethan" to "Ask Ethan Digital". Personality columns must be written every run.

**What to do:** Keep the upsert for row creation, then add an unconditional `.update()` for the bot row after the upsert:

```javascript
// Step 1: Ensure row exists
await supabase.from('bots').upsert({ id: BOT_ID, tenant_id: TENANT_ID, name: 'Ask Ethan Digital', ... }, { onConflict: 'id', ignoreDuplicates: true })

// Step 2: Always write personality + config (update, not ignore)
await supabase.from('bots').update({
  name: 'Ask Ethan Digital',
  greeting_en: '...',
  greeting_bm: '...',
  greeting_zh: '...',
  tone: 'Friendly',
  feature_flags: { rag: true, multilingual: true, booking_enabled: true }
}).eq('id', BOT_ID)
```

This guarantees re-runs are safe AND correct.

### Pattern 2: FAQ Deduplication

FAQs table has no unique constraint (confirmed from schema migration 00002). The existing seed uses `.insert()` and ignores 23505 duplicate errors — but since there's no unique constraint, re-runs will create duplicate FAQ rows. Use a delete-then-insert strategy for GenQi FAQs, OR add a question+bot_id unique constraint. Simplest safe approach: check if FAQs for this bot already exist, skip if count > 0 (idempotent by count, not by constraint).

```javascript
const { count } = await supabase
  .from('faqs')
  .select('id', { count: 'exact', head: true })
  .eq('bot_id', BOT_ID)

if (count === 0) {
  await supabase.from('faqs').insert(faqs)
  console.log(`✓ FAQs: ${faqs.length} rows inserted`)
} else {
  console.log(`✓ FAQs: ${count} rows already exist, skipping`)
}
```

### Pattern 3: n8n Payload Shape (Canonical — from integrations/page.tsx)

```json
{
  "message": "{{ $json.message.text }}",
  "userId": "{{ $json.message.from.id }}",
  "channel": "whatsapp",
  "conversationId": "{{ $json.message.chat.id }}"
}
```

Header: `X-API-Key: <api_key_value>`
Endpoint: `POST /api/chat/{botId}`

This is the exact shape the smoke test curl calls must use.

### Pattern 4: Smoke Test Shell Script

```bash
#!/usr/bin/env bash
# Usage: bash scripts/smoke-test.sh
# Reads SMOKE_TEST_URL and X_API_KEY from .env.local
set -euo pipefail

# Parse .env.local
ENV_FILE="$(dirname "$0")/../.env.local"
BASE_URL=$(grep '^SMOKE_TEST_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
API_KEY=$(grep '^X_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
BOT_ID="6176aa27-ce33-4dbc-b478-407414f86cac"

call_chat() {
  local label="$1" message="$2" lang="$3"
  printf "Testing %-35s ... " "$label ($lang)"
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BASE_URL}/api/chat/${BOT_ID}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d "{\"message\": \"${message}\", \"userId\": \"smoke-test\", \"channel\": \"whatsapp\", \"conversationId\": \"smoke-${lang}\"}")
  if [ "$HTTP_STATUS" = "200" ]; then echo "PASS ($HTTP_STATUS)"
  else echo "FAIL ($HTTP_STATUS)"; fi
}

# 9 calls: 3 intents × 3 languages
call_chat "product_enquiry" "Tell me about Elken skincare products" "en"
call_chat "product_enquiry" "Ceritakan tentang produk penjagaan kulit Elken" "bm"
call_chat "product_enquiry" "介绍一下Elken护肤产品" "zh"
call_chat "health_concern"  "I have back pain, what products help?" "en"
call_chat "health_concern"  "Saya ada sakit belakang, produk apa yang membantu?" "bm"
call_chat "health_concern"  "我有背痛，有什么产品可以帮助？" "zh"
call_chat "booking_intent"  "I want to book a GenQi session" "en"
call_chat "booking_intent"  "Saya ingin menempah sesi GenQi" "bm"
call_chat "booking_intent"  "我想预约GenQi疗程" "zh"
```

### Anti-Patterns to Avoid

- **Do not start the seed from scratch:** The existing `seed-elken.mjs` has working .env.local parsing, Supabase client setup, and fixed UUIDs. Extend it in-place.
- **Do not use `ignoreDuplicates: true` for the bot update:** Bot name and personality fields must always be written, not skipped.
- **Do not invent FAQ phrasing for GenQi hours:** All factual details (phone, email, hours, facility counts) are provided verbatim in CONTEXT.md. Translate/paraphrase only the prose framing, not the facts.
- **Do not include placeholder substitution logic in the seed:** Template placeholders (`<name>`, `<time>`, `<facility>`) are stored as literal strings. The runtime booking state machine does substitution.
- **Do not use `general_enquiry` as a new intent_key:** CONTEXT.md specifies using the existing `general` intent key (already seeded) for this purpose.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| .env.local parsing | Custom regex parser | The pattern already in seed-elken.mjs (lines 16-22) | Works, tested, no extra deps |
| Supabase client setup | New client factory | `createClient(url, key, { auth: { persistSession: false } })` | Matches lib/supabase/service.ts pattern |
| HTTP smoke testing | Node.js fetch test | `curl` in bash script | No Node process startup, visible output, macOS/CI portable |

**Key insight:** This phase is data and documentation work, not engineering work. The platform is complete. Resist any impulse to build new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Bot Row Not Updated on Re-Run

**What goes wrong:** The existing seed uses `ignoreDuplicates: true` on the bot upsert. If the bot row already exists (from a previous seed run), none of the new fields (name change, greeting_*, tone, feature_flags) will be written. The bot stays named "Ethan" with missing personality config.

**Why it happens:** `ignoreDuplicates: true` is correct for avoiding duplicate key errors but means the entire upsert is skipped if the conflict row exists.

**How to avoid:** After the upsert, always run an explicit `.update()` on the bot row keyed by `id`. This is unconditional and always writes current values.

**Warning signs:** Seed output says "Bot: Ask Ethan Digital" (from console.log) but the database still shows `name = 'Ethan'`. Always verify with a quick Supabase query after the first run.

### Pitfall 2: Duplicate FAQs on Re-Run

**What goes wrong:** `faqs` has no unique constraint. Running the seed twice inserts all FAQ rows twice. After three runs there are 3x the expected FAQ count, and the bot gets duplicate context in RAG.

**Why it happens:** The existing seed does `.insert()` not `.upsert()`, and the "ignore duplicates" comment is misleading — there's no constraint to trigger a conflict.

**How to avoid:** Use the count-guard pattern (check count before insert) or clear GenQi FAQs by bot_id before re-inserting. The count-guard is safer.

**Warning signs:** After running seed twice, query `SELECT count(*) FROM faqs WHERE bot_id = '6176aa27-...'` — count will be 2x expected.

### Pitfall 3: Smoke Test Fails Due to Streaming Response Handling

**What goes wrong:** The chat endpoint returns a streaming response (ReadableStream). A bare curl call with `-o /dev/null` will work for status-code checking. But if the smoke test tries to parse the body, streaming chunked responses can produce unexpected output or hang.

**Why it happens:** `POST /api/chat/[botId]` returns `text/event-stream` or a streaming `ReadableStream`. curl reads the stream until it ends, which may take a few seconds.

**How to avoid:** The smoke test only checks HTTP status code (`-w "%{http_code}"`), not body content. Do not attempt to parse the streaming body in the bash script. Manual checklist covers body content verification.

**Warning signs:** curl hangs for 30+ seconds or exits with connection error. Usually means the API key is wrong or the bot doesn't exist.

### Pitfall 4: tone Column Value Mismatch

**What goes wrong:** Migration 00009 defines `tone CHECK (tone IN ('Professional', 'Friendly', 'Formal'))`. CONTEXT.md D-02 says tone is "friendly" (lowercase). Inserting the lowercase value will fail with a constraint violation.

**Why it happens:** The client spec uses lowercase but the DB constraint requires title case.

**How to avoid:** Use `tone: 'Friendly'` (capital F) in the seed upsert, matching the DB check constraint exactly.

### Pitfall 5: Greeting Text Loses Emoji or Newlines in JSON

**What goes wrong:** The multilingual greeting texts contain emojis (😊) and newlines (numbered menu items). If these are not correctly encoded in the JavaScript string literals, they may be stored truncated or corrupted.

**Why it happens:** Template literals or escaped strings may drop newlines or mangle emoji when written to JSON via Supabase client.

**How to avoid:** Use JavaScript template literals (backtick strings) for all greeting values. Test after seeding by querying `SELECT greeting_en FROM bots WHERE id = '6176aa27-...'` and verifying the full text including emoji.

---

## Code Examples

### Verified: Bot Upsert + Update Pattern

```javascript
// Source: pattern derived from existing seed-elken.mjs + migration 00009

// Step 1: Create row if not exists
const { error: botErr } = await supabase
  .from('bots')
  .upsert({
    id: BOT_ID,
    tenant_id: TENANT_ID,
    name: 'Ask Ethan Digital',
    feature_flags: { rag: true, multilingual: true, booking_enabled: true }
  }, { onConflict: 'id', ignoreDuplicates: true })
if (botErr) throw new Error(`Bot upsert: ${botErr.message}`)

// Step 2: Always update personality fields (runs every seed)
const { error: botUpdateErr } = await supabase
  .from('bots')
  .update({
    name: 'Ask Ethan Digital',
    greeting_en: `Hi! 😊 Thank you for contacting Elken. My name is Ethan, I'll be your assistant for today — what can I do for you?\n1. Product enquiries\n2. GenQi facilities Booking`,
    greeting_bm: `Hai! 😊 Terima kasih kerana menghubungi Elken. Nama saya Ethan, saya akan menjadi pembantu anda untuk hari ini — apakah yang boleh saya bantu?\n1. Pertanyaan Produk\n2. Tempahan Kemudahan GenQi`,
    greeting_zh: `您好！😊 感谢您联系 Elken。我是 Ethan，很高兴为您服务 — 请问今天有什么可以帮到您？\n1. 一般咨询\n2. GenQi 设施预订`,
    tone: 'Friendly',
    feature_flags: { rag: true, multilingual: true, booking_enabled: true }
  })
  .eq('id', BOT_ID)
if (botUpdateErr) throw new Error(`Bot update: ${botUpdateErr.message}`)
console.log('✓ Bot: Ask Ethan Digital (personality configured)')
```

### Verified: FAQ Count Guard Pattern

```javascript
// Source: pattern for idempotent FAQ insert without unique constraint

const { count: faqCount } = await supabase
  .from('faqs')
  .select('id', { count: 'exact', head: true })
  .eq('bot_id', BOT_ID)

if (faqCount === 0) {
  const { error: faqErr } = await supabase.from('faqs').insert(faqs)
  if (faqErr) throw new Error(`FAQs: ${faqErr.message}`)
  console.log(`✓ FAQs: ${faqs.length} rows (en/bm/zh)`)
} else {
  console.log(`✓ FAQs: ${faqCount} rows already present — skipping`)
}
```

### Verified: Response Template Upsert (already idempotent)

```javascript
// Source: existing seed-elken.mjs pattern — unique constraint on (bot_id, intent_key, language)
const { error: tmplErr } = await supabase
  .from('response_templates')
  .upsert(templates, { onConflict: 'bot_id,intent_key,language', ignoreDuplicates: false })
  // ignoreDuplicates: false ensures existing templates are UPDATED with new content
if (tmplErr) throw new Error(`Templates: ${tmplErr.message}`)
```

Note: Use `ignoreDuplicates: false` for templates so the exact client-provided text always overwrites any prior draft content.

### Verified: n8n Payload Shape (from integrations/page.tsx)

```json
{
  "message": "{{ $json.message.text }}",
  "userId": "{{ $json.message.from.id }}",
  "channel": "whatsapp",
  "conversationId": "{{ $json.message.chat.id }}"
}
```

Header: `X-API-Key: <value>`

---

## What Needs to Be Built (Task Map)

| Deliverable | File | Action |
|-------------|------|--------|
| Complete seed script | `scripts/seed-elken.mjs` | Extend in-place: fix bot name, add personality update, add GenQi FAQs (EN/BM/ZH), add 6 client templates × 3 languages |
| Delete SQL seed | `supabase/elken-seed.sql` | Delete this file (D-08) |
| n8n setup guide | `docs/n8n-setup.md` | New file: step-by-step n8n HTTP Request node configuration |
| Automated smoke test | `scripts/smoke-test.sh` | New bash script: 9 curl calls (3 intents × 3 languages), reads env, reports PASS/FAIL |
| Manual checklist | `docs/manual-checklist.md` | New markdown: real WhatsApp → n8n → webhook → response verification steps |

---

## GenQi FAQ Coverage Plan

The seed needs GenQi FAQs covering the following topics in EN, BM, and ZH:

**OKR Location:**
- Contact info (email: genqigex@gmail.com, phone: 012-2208396)
- Operating hours (Mon–Sun 10am–10pm; closed CNY/Raya/Deepavali/Christmas with advance notice)
- Bed Female: 5 units, 1.5hr/session, last booking 8pm, BES on loan: 5 units
- Bed Male: 2 units, 1.5hr/session, last booking 8pm
- Inhaler: 8 chairs, 30min or 1hr session, last booking 8:30pm (1hr) / 9pm (30min)
- Meeting Room Small: max 8 pax, TV + projector
- Meeting Room Large: max 50 pax, TV + projector + table seating
- Meeting Rooms: Elken members only, valid membership ID required

**Subang Location:**
- Contact info (email: genqics@gmail.com, phone: 0122206215)
- Operating hours (Weekdays 10am–6:30pm; Weekends & Public Holidays closed)
- Bed Female: 5 units, 1.5hr/session, last booking 4:45pm, BES on loan: 4 units
- Bed Male: 2 units, 1.5hr/session, last booking 4:45pm
- Bed Unisex: 2 units, one gender at a time only, no gender mixing
- Inhaler: 5 chairs, 30min or 1hr, last booking 3:15pm (1hr) / 3:45pm (30min)
- No meeting rooms at Subang

**General Rules (both locations):**
- No food or drinks on premises
- Arrive 15 minutes early for registration
- Members: confirmed directly; ask about BES device for bed bookings
- Non-members: specialist contacts within 24 hours

Aim for ~8–10 FAQ entries per location plus 3–4 for general rules = approximately 22–26 FAQ rows per language = 66–78 total FAQ rows.

---

## n8n Setup Guide Outline

`docs/n8n-setup.md` must cover:

1. **Prerequisites:** n8n instance running, WhatsApp or Telegram trigger configured, API key generated from the bot's Keys tab in the admin dashboard.
2. **Create HTTP Request node:** Set Method to POST, URL to `https://your-vercel-url/api/chat/{botId}`.
3. **Set headers:** Add `X-API-Key` header with the API key value. Set `Content-Type: application/json`.
4. **Map the request body:** Use the JSON payload from the Integrations page (WhatsApp tab or Telegram tab). Adjust field expressions to match the actual trigger node's output.
5. **Handle streaming response:** n8n's HTTP Request node receives the streaming response body as text. No special streaming configuration needed — n8n waits for the stream to complete.
6. **Test in n8n:** Use n8n's "Execute Workflow" with a sample message. Verify the response appears in the HTTP Response node output.
7. **Wire to outbound message node:** Pass the response text back to the WhatsApp/Telegram Send Message node.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (configured in vitest.config.ts) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEED-01 | Seed script creates tenant + bot with correct name and config | manual-only | Run `node scripts/seed-elken.mjs` and query Supabase | N/A |
| SEED-02 | GenQi FAQs exist in DB after seed in EN/BM/ZH | manual-only | `SELECT count(*) FROM faqs WHERE bot_id = '6176aa27-...'` | N/A |
| SEED-03 | Response templates exist for all 6 intent_keys in EN/BM/ZH | manual-only | `SELECT intent_key, language FROM response_templates WHERE bot_id = '6176aa27-...'` | N/A |
| SEED-04 | Bot personality config is written (name, greetings, tone, booking_enabled) | manual-only | `SELECT name, greeting_en, tone, feature_flags FROM bots WHERE id = '6176aa27-...'` | N/A |

**Note:** The seed script, smoke test, and n8n guide are operational artifacts, not code units testable by vitest. Validation is manual (run seed, query DB, run smoke test, observe output). The vitest suite covers the underlying API routes already — no new vitest tests are needed for this phase.

### Sampling Rate

- **Per task commit:** `npx vitest run` — verify no regressions in existing test suite
- **Per wave merge:** `npx vitest run`
- **Phase gate:** All 3 deliverables (seed, smoke test, n8n guide) verified manually before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. This phase produces operational scripts, not testable code units.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SQL seed file (`supabase/elken-seed.sql`) | Node.js ESM seed (`scripts/seed-elken.mjs`) | This phase (D-08) | SQL file to be deleted; JS seed is canonical |
| Bot name "Ethan" | "Ask Ethan Digital" | This phase (D-01) | Must update bots.name via explicit update |
| Partial templates (5 intents) | Full client-provided templates (6 intents + variants) | This phase (SEED-03) | slot_full, booking_confirmed_member/nonmember, reminder_24h, post_survey, no_product_found added |

**Deprecated/outdated:**
- `supabase/elken-seed.sql`: Replace with JS seed; file must be deleted per D-08.
- Bot name "Ethan" in seed line 54: Must become "Ask Ethan Digital".
- `feature_flags: { rag: true, multilingual: true }` (missing `booking_enabled`): Must add `booking_enabled: true`.

---

## Open Questions

1. **Smoke test env var naming**
   - What we know: CONTEXT.md D-05 says read `VERCEL_URL` or `SMOKE_TEST_URL` from `.env.local`
   - What's unclear: Which env var takes precedence if both exist? `VERCEL_URL` is a Vercel system env var (set automatically in Vercel runtime) and may not be in `.env.local` locally.
   - Recommendation: Prefer `SMOKE_TEST_URL` (explicit override) and fall back to `VERCEL_URL`. Document this in the script header comment.

2. **`ignoreDuplicates` for template upsert update behavior**
   - What we know: Existing seed uses `ignoreDuplicates: true` on templates, meaning existing draft templates are NOT updated.
   - What's unclear: The 5 existing seeded templates (browse_product, health_issue, book_session, faq, general) have generic draft content — not client-provided. The new 6 templates are verbatim client scripts.
   - Recommendation: Use `ignoreDuplicates: false` for the template upsert so all templates (including the existing 5) get updated with correct content. This is safe given the unique constraint.

---

## Sources

### Primary (HIGH confidence)

- `/Users/abiramivasudevan/Elken Whatspp Chatbot/scripts/seed-elken.mjs` — existing seed structure, UUIDs, upsert patterns
- `/Users/abiramivasudevan/Elken Whatspp Chatbot/supabase/migrations/00002_schema.sql` — confirmed: faqs has no unique constraint; response_templates has unique(bot_id, intent_key, language)
- `/Users/abiramivasudevan/Elken Whatspp Chatbot/supabase/migrations/00009_bot_config.sql` — confirmed: greeting_en/bm/zh, tone CHECK ('Professional', 'Friendly', 'Formal'), fallback_message columns exist on bots
- `/Users/abiramivasudevan/Elken Whatspp Chatbot/app/dashboard/bots/[botId]/integrations/page.tsx` — confirmed: n8n payload shape (message, userId, channel, conversationId) and X-API-Key header
- `.planning/phases/07-integration-and-launch/07-CONTEXT.md` — all locked decisions, exact data verbatim

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — accumulated project decisions confirming architecture patterns
- `.planning/REQUIREMENTS.md` — SEED-01 through SEED-04 acceptance criteria

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all tools already in project
- Architecture patterns: HIGH — derived directly from existing code and confirmed schema
- Pitfalls: HIGH — derived from confirmed schema constraints and existing seed code
- FAQ content plan: HIGH — all facts provided verbatim in CONTEXT.md; only prose framing is discretionary

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain; seed data won't change unless client revises)
