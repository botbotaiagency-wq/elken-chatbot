# Manual Verification Checklist — Elken WhatsApp Bot

Use this checklist to verify the full end-to-end flow: WhatsApp message → n8n → chat endpoint → AI response → WhatsApp reply.

---

## Prerequisites

Before running these tests, confirm the following are complete:

- [ ] n8n workflow is active and connected to the WhatsApp Trigger (or Webhook) node
- [ ] WhatsApp Business API account is connected to the n8n trigger node
- [ ] API key has been generated from the admin dashboard: **Dashboard > Bots > Ask Ethan Digital > Keys tab > Generate Key**
- [ ] Elken seed data has been applied: `node scripts/seed-elken.mjs`
- [ ] Vercel deployment is live and accessible (test with `bash scripts/smoke-test.sh` first)
- [ ] n8n HTTP Request node is configured with:
  - URL: `https://your-vercel-url/api/chat/6176aa27-ce33-4dbc-b478-407414f86cac`
  - Header: `X-API-Key: <your-api-key>`
  - Body keys: `message`, `userId`, `channel`, `conversationId`

---

## Test 1: Product Enquiry (English)

**Action:** Send the following message via WhatsApp to the bot number:

> Tell me about Elken skincare products

**Expected behaviour:**
- Bot responds with a streaming reply containing Elken product information
- Response is in English
- Response mentions Elken products (e.g., skincare range or specific product names)

**Verify:**
- [ ] Response is received in WhatsApp within 30 seconds
- [ ] Response is in English
- [ ] Response mentions Elken products

---

## Test 2: Health Concern (Bahasa Malaysia)

**Action:** Send the following message via WhatsApp:

> Saya ada sakit belakang, produk apa yang membantu?

**Expected behaviour:**
- Bot detects Bahasa Malaysia and responds in BM
- Response recommends relevant Elken products for back pain
- Response is natural, customer-facing language

**Verify:**
- [ ] Response is received in WhatsApp within 30 seconds
- [ ] Response is in Bahasa Malaysia
- [ ] Response mentions relevant products or health advice

---

## Test 3: Booking Intent (Chinese)

**Action:** Send the following message via WhatsApp:

> 我想预约GenQi疗程

**Expected behaviour:**
- Bot detects Chinese and responds in Simplified Chinese
- Bot enters the booking flow and asks for facility selection
- Response presents the two GenQi locations as options (Old Klang Road / Subang)

**Verify:**
- [ ] Response is received in WhatsApp within 30 seconds
- [ ] Response is in Chinese
- [ ] Response presents facility options (Old Klang Road, Subang)

---

## Test 4: FAQ — GenQi Operating Hours (English)

**Action:** Send the following message via WhatsApp:

> What are the operating hours of GenQi Old Klang Road?

**Expected behaviour:**
- Bot responds with the exact operating hours from the seeded FAQ
- Response includes "Monday–Sunday 10am–10pm" (or equivalent phrasing)
- Response includes contact info (phone: 012-2208396 or email: genqigex@gmail.com)

**Verify:**
- [ ] Response is received in WhatsApp within 30 seconds
- [ ] Response mentions Monday–Sunday and 10am–10pm hours
- [ ] Response includes contact information for GenQi Old Klang Road

---

## Test 5: Seed Idempotency

**Action:** Run the seed script twice in a row:

```bash
node scripts/seed-elken.mjs
node scripts/seed-elken.mjs
```

Then query the database for the FAQ count:

```sql
SELECT count(*) FROM faqs WHERE bot_id = '6176aa27-ce33-4dbc-b478-407414f86cac';
```

**Expected behaviour:**
- The FAQ count is identical after both runs (no duplicate rows created)
- The seed script exits with code 0 on both runs
- No error messages appear in the script output

**Verify:**
- [ ] FAQ count is the same after first and second run
- [ ] Seed script exits cleanly with no errors
- [ ] No duplicate FAQs created

---

## Sign-Off

Complete this checklist before marking Phase 7 as done:

- [ ] Test 1 passes — product enquiry in English returns relevant Elken products
- [ ] Test 2 passes — health concern in BM returns response in Bahasa Malaysia
- [ ] Test 3 passes — booking intent in Chinese enters booking flow with facility options
- [ ] Test 4 passes — GenQi FAQ returns correct hours and contact info
- [ ] Test 5 passes — no duplicate FAQs after re-seeding
- [ ] Automated smoke test passes: `bash scripts/smoke-test.sh` returns "ALL TESTS PASSED"
- [ ] Bot name shows "Ask Ethan Digital" in the admin dashboard

---

*See also: `docs/n8n-setup.md` for n8n workflow configuration instructions.*
*See also: `scripts/smoke-test.sh` for automated endpoint verification.*
