# Phase 7: Integration and Launch - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the Elken seed data (SEED-01 through SEED-04), add an n8n setup guide, and validate the full end-to-end chat flow with an automated smoke test script + manual checklist. The n8n payload shape and integrations page snippets are already built (Phase 3/4) — this phase completes the data layer and verifies the live system.

</domain>

<decisions>
## Implementation Decisions

### Bot Identity
- **D-01:** Bot database name is `"Ask Ethan Digital"` (bots.name). Prior seed draft used "Ethan" — update to full brand name.
- **D-02:** Bot greeting is exact text provided by client (see Personality Config section below). Tone is friendly with emojis.
- **D-03:** `feature_flags.booking_enabled = true` for the Elken bot.

### Personality Config (SEED-04)
Bot name: `Ask Ethan Digital`
Tone: `friendly`
booking_enabled: `true`

Greetings (stored in bot_config or equivalent personality table):

**EN:**
> Hi! 😊 Thank you for contacting Elken. My name is Ethan, I'll be your assistant for today — what can I do for you?
> 1. Product enquiries
> 2. GenQi facilities Booking

**BM:**
> Hai! 😊 Terima kasih kerana menghubungi Elken. Nama saya Ethan, saya akan menjadi pembantu anda untuk hari ini — apakah yang boleh saya bantu?
> 1. Pertanyaan Produk
> 2. Tempahan Kemudahan GenQi

**ZH:**
> 您好！😊 感谢您联系 Elken。我是 Ethan，很高兴为您服务 — 请问今天有什么可以帮到您？
> 1. 一般咨询
> 2. GenQi 设施预订

### GenQi FAQ Content (SEED-02)
All GenQi FAQs must be seeded in EN, BM, and ZH. Use the following factual details verbatim:

**GenQi Old Klang Road (OKR)**
- Email: genqigex@gmail.com
- Phone: 012-2208396
- Hours: Monday–Sunday 10am–10pm. Public Holidays: Open (except CNY, Raya, Deepavali, Christmas, or special occasions with advance notice)
- Facilities:
  - Bed (Female): 5 units, 1.5hr/session, last booking 8pm, BES on loan: 5 units
  - Bed (Male): 2 units, 1.5hr/session, last booking 8pm
  - Inhaler: 8 chairs, 30min or 1hr session, last booking 8:30pm (1hr) / 9pm (30min)
  - Meeting Room Small: max 8 pax, TV + projector
  - Meeting Room Large: max 50 pax, TV + projector + table seating
  - Meeting Rooms: Elken members only, valid membership ID required

**GenQi Subang**
- Email: genqics@gmail.com
- Phone: 0122206215
- Hours: Weekdays 10am–6:30pm. Weekends & Public Holidays: Closed
- Facilities:
  - Bed (Female): 5 units, 1.5hr/session, last booking 4:45pm, BES on loan: 4 units
  - Bed (Male): 2 units, 1.5hr/session, last booking 4:45pm
  - Bed (Unisex): 2 units, one gender at a time only, no gender mixing
  - Inhaler: 5 chairs, 30min or 1hr session, last booking 3:15pm (1hr) / 3:45pm (30min)
  - No meeting rooms at Subang

**General Rules (both locations)**
- No food or drinks permitted on premises
- Arrive 15 minutes early for registration
- Elken members: booking confirmed directly; ask about BES device for bed bookings
- Non-members: specialist contacts within 24 hours

### Response Templates (SEED-03)
The following are exact client-provided scripts. Use verbatim — no rewording. Note: `<name>`, `<time>`, `<facility>`, `<date & time>`, `<with BES / no BES>` are template placeholders — keep them as-is in the seed data.

**slot_full**
- EN: `Oops! We're sorry, the selected time slot is fully booked. Next available time slots are <time>. Would you like me to proceed for you? Or, do you have another preferred date and time? 😊`
- BM: `Alamak! Maaf, slot masa yang dipilih telah penuh. Slot masa yang tersedia seterusnya ialah <time>. Adakah anda ingin saya teruskan? Atau, adakah anda mempunyai tarikh dan masa pilihan lain? 😊`
- ZH: `抱歉！您选择的时间段已被预订。下一个可用时间段是 <time>。您希望我为您预订吗？或者您有其他preferred的日期和时间？😊`

**booking_confirmed_member**
- EN: `All set <name> 😊 Your booking is confirmed with details <facility> <date & time> <with BES / no BES>. No food and drinks are permitted in our premises. Please present 15 min earlier before your booking for registration purpose. See you then!`
- BM: `Siap <name> 😊 Tempahan anda telah disahkan dengan butiran <facility> <date & time> <with BES / no BES>. Tiada makanan dan minuman dibenarkan di premis kami. Sila hadir 15 minit lebih awal untuk tujuan pendaftaran. Jumpa nanti!`
- ZH: `好的 <name> 😊 您的预订已确认，详情为 <facility> <date & time> <with BES / no BES>。请勿在场内饮食。请提前15分钟到达进行登记。到时见！`

**booking_confirmed_nonmember**
- EN: `All set <name> 😊 Our specialist will contact you for further details within the next 24 hours.`
- BM: `Siap <name> 😊 Pakar kami akan menghubungi anda untuk maklumat lanjut dalam masa 24 jam.`
- ZH: `好的 <name> 😊 我们的专员将在24小时内联系您以了解更多详情。`

**reminder_24h**
- EN: `Hi <name> 😊 Just a friendly reminder — you have a booking tomorrow at <facility> <time>. Please present 15 min earlier for registration. No food and drinks permitted on premises. See you soon!`
- BM: `Hai <name> 😊 Peringatan mesra — anda mempunyai tempahan esok di <facility> <time>. Sila hadir 15 minit lebih awal untuk pendaftaran. Tiada makanan dan minuman di premis. Jumpa soon!`
- ZH: `你好 <name> 😊 温馨提醒 — 您明天在 <facility> <time> 有一个预约。请提前15分钟到达登记。场内禁止饮食。明天见！`

**post_survey**
- EN: `Hi <name> 😊 Thank you for visiting GenQi today! We hope you had a great experience. Could you take a moment to rate your session? Reply with a number 1-5 (5 being excellent) and any comments you'd like to share.`
- BM: `Hai <name> 😊 Terima kasih kerana melawati GenQi hari ini! Kami harap anda menikmati pengalaman anda. Boleh anda luangkan masa untuk menilai sesi anda? Balas dengan nombor 1-5 (5 cemerlang) dan sebarang komen.`
- ZH: `你好 <name> 😊 感谢您今天光临GenQi！希望您有愉快的体验。请问您能花一点时间评价您的疗程吗？请回复1-5分（5分为优秀）及任何意见。`

**no_product_found**
- EN: `I'm sorry, I couldn't find a specific product match for your query. Here are some of our popular wellness products that might help. Would you like more details on any of these?`
- BM: `Maaf, saya tidak dapat mencari produk yang sepadan dengan pertanyaan anda. Berikut adalah beberapa produk kesihatan popular kami yang mungkin membantu. Adakah anda ingin maklumat lanjut?`
- ZH: `抱歉，我找不到与您查询相符的具体产品。以下是一些可能对您有帮助的热门健康产品。您需要了解更多详情吗？`

### Smoke Test
- **D-04:** Deliver BOTH an automated curl script AND a manual test checklist.
- **D-05:** Automated script targets the deployed Vercel URL. Read `VERCEL_URL` or `SMOKE_TEST_URL` from `.env.local` (or env). The script must cover: product enquiry, health concern query, and booking intent — each in EN, BM, and ZH (9 curl calls total). Uses the n8n payload shape: `{ message, userId, channel, conversationId }` with `X-API-Key` header.
- **D-06:** Manual checklist is a markdown file documenting the steps to verify via a real WhatsApp message through a live n8n workflow.

### Seed Format
- **D-07:** `scripts/seed-elken.mjs` is the canonical seed file (Node.js, reads `.env.local`, Supabase client, idempotent upserts with friendly console output).
- **D-08:** Delete `supabase/elken-seed.sql` — SQL file is redundant and should not be committed.

### n8n Setup Guide
- **D-09:** Create `docs/n8n-setup.md` — a step-by-step guide covering: create n8n HTTP workflow, configure HTTP Request node (method, URL, headers), set `X-API-Key` header, handle streaming response, map WhatsApp/Telegram payload fields to the JSON body.

### Claude's Discretion
- FAQ phrasing and translation quality for the GenQi location/hours content (EN/BM/ZH variants) — Claude should produce natural, customer-facing language while keeping all factual details exact.
- Number and grouping of GenQi FAQs — aim for comprehensive coverage without excessive overlap.
- Smoke test script format (bash/mjs) — use whatever is most portable on macOS + CI.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Seed Draft
- `scripts/seed-elken.mjs` — Partial seed (tenant, bot, basic FAQs, basic templates). Complete and replace; do NOT start from scratch.

### n8n Payload Contract
- `app/dashboard/bots/[botId]/integrations/page.tsx` — Defines canonical JSON payload shape for WhatsApp and Telegram (`message`, `userId`, `channel`, `conversationId`) and `X-API-Key` header. Smoke test must use this exact shape.

### Requirements
- `.planning/REQUIREMENTS.md` §Elken Seed Data — SEED-01 through SEED-04 are the acceptance criteria for the seed script.

### No external specs — all data fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/seed-elken.mjs` — Existing partial seed. Has tenant, bot, 15 basic FAQs, 15 basic response templates. Extend in-place; do not delete and recreate.
- `app/dashboard/bots/[botId]/integrations/page.tsx` — n8n payload shape already defined here; reuse for smoke test curl commands.
- `lib/supabase/service.ts` — Service role Supabase client pattern; seed script already uses this pattern via createClient with service role key.

### Established Patterns
- Seed uses fixed UUIDs for idempotent re-runs: `TENANT_ID = '24284717-...'`, `BOT_ID = '6176aa27-...'`
- All upserts use `onConflict` + `ignoreDuplicates: true` — re-running the seed is safe.
- Response templates keyed on `bot_id + intent_key + language` (unique constraint).

### Integration Points
- Chat endpoint: `POST /api/chat/[botId]` — what the smoke test calls.
- `bot_config` table (or `bots.config` jsonb) — where personality config (greetings, tone, booking_enabled) lives. Check schema migration 00001/00002 for exact column name.

</code_context>

<specifics>
## Specific Ideas

- Greeting messages use a numbered menu format (1. Product enquiries / 2. GenQi facilities Booking) — keep this formatting in the seed exactly as provided.
- Template placeholders (`<name>`, `<time>`, `<facility>`, `<date & time>`, `<with BES / no BES>`) are intentionally left as literal strings in the seed — the booking state machine substitutes them at runtime.
- The `general_enquiry` intent key was not provided by client — use the existing `general` template (already seeded) to cover this intent.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-integration-and-launch*
*Context gathered: 2026-03-23*
