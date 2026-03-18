# FEATURE COMPLETENESS CHECK — Elken Ask Ethan Digital
# Paste this into Claude Code any time to verify nothing is missed

---

Before continuing, verify that ALL of the following features are built or planned 
in the current implementation. Do not proceed to deployment until every item below 
is checked off.

---

## ✅ CORE CHATBOT FEATURES (1.1 → 1.6) — ALL REQUIRED

### 1.1 Language Auto-Detection
- [ ] Detects language from customer message automatically
- [ ] Responds in the same language the customer used
- [ ] Supports: English (EN), Bahasa Melayu (BM), Chinese (ZH)

### 1.2 RAG-Powered Product Engine
- [ ] Search any Elken product by name OR category
- [ ] Returns full Product Detail Card:
  - [ ] Product name + description
  - [ ] Key ingredients
  - [ ] Health benefits
  - [ ] Pricing
  - [ ] How to use / suggested usage
- [ ] Can send product brochures, price lists, Elken announcements to customer
- [ ] Products ingested from Drive categories: Beauty, FMCG, GenQi, Healthfood, Home Appliances

### 1.3 Health Issue / Symptom Recommendation
- [ ] Customer describes health concern (e.g. back pain, fatigue, skin issue, stress)
- [ ] RAG matches symptom → most relevant Elken product
- [ ] Bot explains WHY the product helps + benefits + suggested use
- [ ] Customer can request full Product Detail Card to be sent to chat
- [ ] If no match found → show general wellness products fallback

### 1.4 Session Booking Flow (GenQi)
- [ ] Customer selects session / facilities type:
  - Bed (Female section) — Subang: 5, OKR: 5
  - Bed (Male section) — Subang: 2, OKR: 2
  - Bed (Unisex) — Subang only: 2 (no mixed gender at same time)
  - Inhaler — Subang: 5 chairs, OKR: 8 chairs
  - Meeting Room Small (max 8 pax) — OKR ONLY
  - Meeting Room Large (max 50 pax) — OKR ONLY
- [ ] Customer selects location: GenQi Old Klang Road OR GenQi Subang
- [ ] Customer selects available date and time slot
- [ ] If slot is FULL → bot suggests next 3 alternative dates/times automatically
- [ ] System captures ALL of:
  - [ ] Member Name
  - [ ] Member ID (if applicable)
  - [ ] Contact Number
  - [ ] Booking Location
  - [ ] Facilities Type
  - [ ] On Loan Unit
  - [ ] Elken member? (YES/NO)
  - [ ] Has BES device? (for bed bookings)
- [ ] Customer reviews and confirms booking summary before submission
- [ ] Booking submitted → pending staff approval
- [ ] Confirmation message sent to customer upon approval
- [ ] Automated reminder sent 24 hours before session
- [ ] Member path vs Non-member path handled differently:
  - Member + Bed/Inhaler → confirm directly, ask for BES device
  - Non-member + Bed/Inhaler → "Specialist will contact within 24 hours"
  - Meeting Room → must show valid ID, Elken members only

### 1.5 Calendar Management (Staff-side)
- [ ] Staff can edit and update calendar entries from admin dashboard
- [ ] Staff can mark customers as no-show
- [ ] Staff can register walk-in customers
- [ ] Full audit trail maintained for every cancellation and change
- [ ] Every edit logged with: action, who, timestamp, note

### 1.6 Post-Session Survey
- [ ] Survey automatically sent on booking date OR after session completes
- [ ] Survey results captured and stored in DB
- [ ] Survey results visible in admin reporting

---

## ✅ REPORTING & ANALYTICS — ALL REQUIRED

Admin dashboard must include ALL of these reports:

| Report | What it shows |
|--------|--------------|
| Confirmed Bookings | Total bookings confirmed per period, filterable by location |
| Cancellation Requests | All cancellations with timestamps + full audit history |
| Types of Facilities | Breakdown of sessions booked by facility type |
| Requests by Location | Volume of bookings: Old Klang Road vs Subang |
| Audit Trail | Full change log for all calendar edits and cancellations |
| Customer Satisfaction | Survey responses collected post-session |

Plus chatbot analytics:
- [ ] Total messages (today / 7d / 30d)
- [ ] Unanswered queries (RAG found nothing) — list + frequency
- [ ] Intent breakdown: browse_product / health_issue / book_session / faq / unknown
- [ ] Response latency (p50 / p95)
- [ ] Export to CSV

---

## ✅ SYSTEM ARCHITECTURE — MUST MATCH

| Layer | Implementation |
|-------|---------------|
| Chatbot Layer | Bot deployed on WhatsApp + Telegram via n8n webhook bridge |
| RAG Engine | Elken product knowledge base — all products, ingredients, benefits, pricing — stored as pgvector chunks in Supabase |
| NLP / Intent | Auto-detect language → classify intent (browse / health_issue / book / faq / general) |
| Booking System | Calendar/booking table in Supabase — two locations (Old Klang Road + Subang) |
| Notification Engine | Auto-confirmation message + 24hr reminder + post-session survey dispatch |
| Reporting Module | Admin dashboard — bookings, cancellations, audit trail, satisfaction |

---

## ✅ MULTI-TENANT ARCHITECTURE
- [ ] All data scoped by bot_id — Elken never sees another tenant's data
- [ ] Tenant admin sees only their bots
- [ ] Super-admin (Navien) sees all tenants and all bots
- [ ] Any new client = new tenant + new bot + upload their docs = fully working

---

## ✅ INTEGRATION READINESS
- [ ] POST /api/chat/[botId] webhook endpoint working with API key auth
- [ ] n8n can call this endpoint from both Telegram and WhatsApp triggers
- [ ] Integrations page shows copy-paste webhook URL + API key for n8n
- [ ] Streaming response supported
- [ ] All messages logged (role, content, intent, sources, latency, rag_found)

---

If any item above is not yet built, implement it now before moving to the next step.
