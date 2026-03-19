# Requirements: Multi-Tenant AI Chatbot SaaS Platform

**Defined:** 2026-03-18
**Core Value:** Any client can upload their documents, configure a bot, and have a working AI chatbot live on WhatsApp/Telegram within minutes — with zero code changes required.

## v1 Requirements

### Authentication & Multi-Tenancy

- [x] **AUTH-01**: User can log in to the admin dashboard with email and password via Supabase Auth
- [x] **AUTH-02**: Tenant admin session is scoped — admin sees only their own tenant's bots and data
- [x] **AUTH-03**: Super-admin (Navien) can view and manage all tenants and bots across the platform
- [x] **AUTH-04**: All database queries are scoped by `bot_id` — RLS enforced on every bot_id-scoped table
- [x] **AUTH-05**: New tenant onboards by creating a tenant + bot + uploading documents, with no code changes required

### Knowledge Base & Ingestion

- [x] **KB-01**: Admin can upload PDF, DOCX, and TXT files to the bot's knowledge base
- [x] **KB-02**: Uploaded files are automatically extracted (text), chunked (500 tokens, 50 overlap), embedded (voyage-3), and stored in pgvector
- [x] **KB-03**: Each document has a category tag: Beauty / FMCG / GenQi / Healthfood / Home Appliances / Other
- [x] **KB-04**: Document ingestion status is visible: pending → processing → ready / failed
- [x] **KB-05**: Chunk count is displayed per document after ingestion completes
- [x] **KB-06**: Admin can delete a document (cascades to all its chunks in pgvector)
- [x] **KB-07**: Knowledge base supports structured product data: product name, description, key ingredients, health benefits, pricing, and suggested usage — retrievable as a full Product Detail Card

### RAG Chat Engine

- [x] **RAG-01**: Chat endpoint `POST /api/chat/[botId]` accepts message + userId + channel + optional conversationId, validates API key, and returns a streaming response
- [x] **RAG-02**: Language is auto-detected from the customer's message (EN / BM / ZH); bot responds in the detected language
- [x] **RAG-03**: Every message is classified by intent: `browse_product` / `health_issue` / `book_session` / `faq` / `general`
- [x] **RAG-04**: FAQs are injected as priority context above RAG chunks — FAQ answers always win over document chunks
- [x] **RAG-05**: Customer can search for any Elken product by name or category; bot returns a full Product Detail Card (name, description, ingredients, benefits, pricing, how to use)
- [x] **RAG-06**: Customer can describe a health concern (e.g. back pain, fatigue, skin issue, stress); RAG matches the symptom to the most relevant Elken product; bot explains why the product helps, its benefits, and suggested use
- [x] **RAG-07**: If no product match is found for a health query (rag_found = false), bot shows a general wellness products fallback response
- [x] **RAG-08**: Customer can request a full Product Detail Card, brochure, or price list to be sent to chat
- [x] **RAG-09**: When RAG finds no match (`similarity < 0.75`), `rag_found` is set to false and the message is logged for analytics
- [x] **RAG-10**: All messages are logged: role, content, intent, source chunk IDs + similarity scores, rag_found flag, response latency in ms

### Bot Configuration

- [ ] **CONF-01**: Admin can configure bot name, greeting message per language (EN / BM / ZH), and tone (Professional / Friendly / Formal)
- [ ] **CONF-02**: Admin can configure a fallback message for when RAG finds nothing
- [ ] **CONF-03**: Admin can configure guardrails: blocked topic keywords (auto-refuse with custom message), mandatory disclaimer text, max response length, off-topic deflection message
- [ ] **CONF-04**: Admin can create, edit, and delete response templates tied to specific intents (e.g. `no_product_found`, `slot_full`, `booking_confirmed`, `reminder_24h`, `post_survey`) with EN / BM / ZH variants
- [ ] **CONF-05**: Admin can create, edit, and delete FAQ pairs with language tag; FAQs are pre-seeded with Elken's location, hours, and facility information

### Booking Flow (Elken GenQi — feature-flagged per bot)

- [ ] **BOOK-01**: When intent is `book_session`, bot enters a conversational booking state machine stored in `conversation.metadata`
- [ ] **BOOK-02**: Customer selects facility type: Bed (Female), Bed (Male), Bed (Unisex — Subang only), Inhaler, Meeting Room Small (OKR only, max 8 pax), Meeting Room Large (OKR only, max 50 pax)
- [ ] **BOOK-03**: Customer selects location: GenQi Old Klang Road or GenQi Subang; Meeting Rooms are only available at Old Klang Road; Unisex Bed is only at Subang
- [ ] **BOOK-04**: Customer selects available date and time slot; bot checks capacity and last-booking cutoffs per facility type
- [ ] **BOOK-05**: If selected slot is fully booked, bot automatically suggests the next 3 available alternative date/time slots
- [ ] **BOOK-06**: Slot checking uses a `SELECT FOR UPDATE` transaction to prevent double-booking race conditions
- [ ] **BOOK-07**: Bot captures: Member Name, Member ID (if applicable), Contact Number, Booking Location, Facility Type, On Loan Unit, Elken member status (YES/NO), Has BES device (for bed bookings)
- [ ] **BOOK-08**: Customer reviews a full booking summary and confirms before submission
- [ ] **BOOK-09**: Confirmed booking is created with status `pending` — requires staff approval before `confirmed`
- [ ] **BOOK-10**: Member + Bed/Inhaler path: ask for BES device, submit for staff approval; confirmation message sent upon staff approval
- [ ] **BOOK-11**: Non-member + Bed/Inhaler path: bot responds "Our specialist will contact you within 24 hours"; booking created as pending
- [ ] **BOOK-12**: Meeting Room path: Elken members only with valid ID; submit for staff approval; confirm directly
- [ ] **BOOK-13**: Unisex Bed constraint: mixing genders at the same time slot is not permitted; bot enforces this during slot selection
- [ ] **BOOK-14**: Confirmation message is automatically sent to the customer when staff approves the booking
- [ ] **BOOK-15**: Automated 24-hour reminder message is sent to the customer before their session
- [ ] **BOOK-16**: Post-session survey is automatically sent on the booking date (or after session completes)
- [ ] **BOOK-17**: Survey responses are captured, stored in the database, and visible in admin reporting

### Bookings Admin (Staff-side Calendar Management)

- [ ] **BADM-01**: Admin can view all bookings in a filterable table: by location, date range, status, and facility type
- [ ] **BADM-02**: Booking status badges: pending / confirmed / cancelled / no-show / walk-in
- [ ] **BADM-03**: Staff can confirm, cancel, or mark a booking as no-show from the admin dashboard
- [ ] **BADM-04**: Staff can register a walk-in customer directly from the admin dashboard (creates a booking with status `walk_in`)
- [ ] **BADM-05**: Staff can edit and update calendar entries (date, time, facility, notes)
- [ ] **BADM-06**: Every change to a booking is logged in an audit trail: action, who, timestamp, note — stored in `audit_log` jsonb on the booking record
- [ ] **BADM-07**: Audit trail is visible per booking (collapsible in the UI)

### Notifications

- [ ] **NOTIF-01**: Booking confirmation message is sent to the customer's channel (WhatsApp/Telegram) when staff approves
- [ ] **NOTIF-02**: 24-hour reminder message is sent automatically before the customer's session
- [ ] **NOTIF-03**: Post-session survey message is sent automatically on the booking date or after session completion
- [ ] **NOTIF-04**: Notification delivery is tracked (reminder_sent, survey_sent flags on the booking record)

### Analytics & Reporting

- [ ] **ANAL-01**: Total message volume chart: today / 7d / 30d, filterable by channel
- [ ] **ANAL-02**: Intent breakdown pie chart: browse_product / health_issue / book_session / faq / unknown
- [ ] **ANAL-03**: Unanswered queries log: messages where rag_found = false, sorted by frequency
- [ ] **ANAL-04**: Response latency p50 / p95 per bot
- [ ] **ANAL-05**: Confirmed bookings report: total confirmed per period, filterable by location
- [ ] **ANAL-06**: Cancellation requests report: all cancellations with timestamps and full audit history
- [ ] **ANAL-07**: Facility type breakdown report: sessions booked by facility type
- [ ] **ANAL-08**: Location volume report: bookings at Old Klang Road vs Subang
- [ ] **ANAL-09**: Full audit trail report: complete change log for all calendar edits and cancellations
- [ ] **ANAL-10**: Customer satisfaction report: post-session survey responses collected
- [ ] **ANAL-11**: Booking funnel: enquiry started → booking submitted → confirmed → attended
- [ ] **ANAL-12**: All reports are exportable to CSV

### API Keys & Integration

- [ ] **API-01**: Admin can generate an API key with a label; key is shown in full once, then only the SHA-256 hash is stored; key format: `ethan_live_xxxxxxxxxxxxxxxx`
- [ ] **API-02**: Admin can view existing keys by label and 8-char prefix; last-used timestamp displayed
- [ ] **API-03**: Admin can revoke any API key
- [ ] **API-04**: Webhook endpoint validates API key using constant-time hash comparison on every request
- [ ] **API-05**: Integrations page displays copy-paste webhook URL and n8n JSON body snippets for Telegram and WhatsApp

### Testing Console

- [ ] **TEST-01**: Admin can send messages to the bot in a live chat UI (styled like WhatsApp/Telegram) from the dashboard
- [ ] **TEST-02**: Each response shows: retrieved source chunks (doc name, similarity score, content preview), classified intent, response time in ms, and whether RAG found a match
- [ ] **TEST-03**: Language can be overridden (EN / BM / ZH) in the testing console
- [ ] **TEST-04**: Admin can reset the conversation to start a fresh test session

### Elken Seed Data

- [ ] **SEED-01**: Elken tenant, bot ("Ask Ethan Digital"), and all default configuration are created via a seed script with no manual steps
- [ ] **SEED-02**: All Elken FAQs (locations, hours, facility rules, booking rules) are pre-seeded in EN, BM, and ZH
- [ ] **SEED-03**: All Elken response templates (slot_full, booking_confirmed_member, booking_confirmed_nonmember, reminder_24h, post_survey, general_enquiry) are pre-seeded in EN, BM, and ZH
- [ ] **SEED-04**: Elken personality config (bot name, greetings per language, booking module enabled) is applied by the seed script

## v2 Requirements

### Knowledge Base

- **KB-V2-01**: Google Drive folder sync — enter folder ID, list files, tick to ingest; re-sync button
- **KB-V2-02**: URL ingestion (scrape webpage content into knowledge base)

### Notifications

- **NOTIF-V2-01**: Email notifications for staff when a new booking is submitted
- **NOTIF-V2-02**: Configurable notification preferences per bot

### Bot

- **BOT-V2-01**: OAuth / magic link login for dashboard admins
- **BOT-V2-02**: Embeddable web chat widget (for website deployment)
- **BOT-V2-03**: Multi-model support (GPT-4, Gemini) — Claude only for v1

### Platform

- **PLAT-V2-01**: Billing and subscription management per tenant
- **PLAT-V2-02**: Mobile app for admin dashboard
- **PLAT-V2-03**: Real-time booking push notifications for staff

## Out of Scope

| Feature | Reason |
|---------|--------|
| Google Drive sync | Deferred to v2 — manual upload only for v1 |
| Python Railway ingestion worker | Ingestion runs inside Next.js API routes for v1 simplicity |
| Direct WhatsApp/Telegram SDK | n8n owns the channel bridge — this app exposes REST only |
| Embeddable web widget | WhatsApp/Telegram first; web widget is v2 |
| OAuth login (Google/GitHub) | Email/password sufficient for dashboard in v1 |
| Billing/subscription management | Navien manages tenants manually at this scale |
| Multi-model AI (GPT-4, Gemini) | Claude Haiku only per spec |
| Mobile app | Responsive web dashboard only |
| Real-time admin notifications (websockets) | Polling sufficient for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 — Data Foundation | Complete |
| AUTH-02 | Phase 1 — Data Foundation | Complete |
| AUTH-03 | Phase 1 — Data Foundation | Complete |
| AUTH-04 | Phase 1 — Data Foundation | Complete |
| AUTH-05 | Phase 1 — Data Foundation | Complete |
| KB-01 | Phase 2 — RAG Pipeline | Complete |
| KB-02 | Phase 2 — RAG Pipeline | Complete |
| KB-03 | Phase 2 — RAG Pipeline | Complete |
| KB-04 | Phase 2 — RAG Pipeline | Complete |
| KB-05 | Phase 2 — RAG Pipeline | Complete |
| KB-06 | Phase 2 — RAG Pipeline | Complete |
| KB-07 | Phase 2 — RAG Pipeline | Complete |
| RAG-01 | Phase 2 — RAG Pipeline | Complete |
| RAG-02 | Phase 2 — RAG Pipeline | Complete |
| RAG-03 | Phase 2 — RAG Pipeline | Complete |
| RAG-04 | Phase 2 — RAG Pipeline | Complete |
| RAG-05 | Phase 2 — RAG Pipeline | Complete |
| RAG-06 | Phase 2 — RAG Pipeline | Complete |
| RAG-07 | Phase 2 — RAG Pipeline | Complete |
| RAG-08 | Phase 2 — RAG Pipeline | Complete |
| RAG-09 | Phase 2 — RAG Pipeline | Complete |
| RAG-10 | Phase 2 — RAG Pipeline | Complete |
| API-01 | Phase 3 — Webhook Gateway | Pending |
| API-02 | Phase 3 — Webhook Gateway | Pending |
| API-03 | Phase 3 — Webhook Gateway | Pending |
| API-04 | Phase 3 — Webhook Gateway | Pending |
| API-05 | Phase 3 — Webhook Gateway | Pending |
| CONF-01 | Phase 4 — Admin Dashboard | Pending |
| CONF-02 | Phase 4 — Admin Dashboard | Pending |
| CONF-03 | Phase 4 — Admin Dashboard | Pending |
| CONF-04 | Phase 4 — Admin Dashboard | Pending |
| CONF-05 | Phase 4 — Admin Dashboard | Pending |
| TEST-01 | Phase 4 — Admin Dashboard | Pending |
| TEST-02 | Phase 4 — Admin Dashboard | Pending |
| TEST-03 | Phase 4 — Admin Dashboard | Pending |
| TEST-04 | Phase 4 — Admin Dashboard | Pending |
| BOOK-01 | Phase 5 — Booking System | Pending |
| BOOK-02 | Phase 5 — Booking System | Pending |
| BOOK-03 | Phase 5 — Booking System | Pending |
| BOOK-04 | Phase 5 — Booking System | Pending |
| BOOK-05 | Phase 5 — Booking System | Pending |
| BOOK-06 | Phase 5 — Booking System | Pending |
| BOOK-07 | Phase 5 — Booking System | Pending |
| BOOK-08 | Phase 5 — Booking System | Pending |
| BOOK-09 | Phase 5 — Booking System | Pending |
| BOOK-10 | Phase 5 — Booking System | Pending |
| BOOK-11 | Phase 5 — Booking System | Pending |
| BOOK-12 | Phase 5 — Booking System | Pending |
| BOOK-13 | Phase 5 — Booking System | Pending |
| BOOK-14 | Phase 5 — Booking System | Pending |
| BOOK-15 | Phase 5 — Booking System | Pending |
| BOOK-16 | Phase 5 — Booking System | Pending |
| BOOK-17 | Phase 5 — Booking System | Pending |
| BADM-01 | Phase 5 — Booking System | Pending |
| BADM-02 | Phase 5 — Booking System | Pending |
| BADM-03 | Phase 5 — Booking System | Pending |
| BADM-04 | Phase 5 — Booking System | Pending |
| BADM-05 | Phase 5 — Booking System | Pending |
| BADM-06 | Phase 5 — Booking System | Pending |
| BADM-07 | Phase 5 — Booking System | Pending |
| NOTIF-01 | Phase 5 — Booking System | Pending |
| NOTIF-02 | Phase 5 — Booking System | Pending |
| NOTIF-03 | Phase 5 — Booking System | Pending |
| NOTIF-04 | Phase 5 — Booking System | Pending |
| ANAL-01 | Phase 6 — Analytics | Pending |
| ANAL-02 | Phase 6 — Analytics | Pending |
| ANAL-03 | Phase 6 — Analytics | Pending |
| ANAL-04 | Phase 6 — Analytics | Pending |
| ANAL-05 | Phase 6 — Analytics | Pending |
| ANAL-06 | Phase 6 — Analytics | Pending |
| ANAL-07 | Phase 6 — Analytics | Pending |
| ANAL-08 | Phase 6 — Analytics | Pending |
| ANAL-09 | Phase 6 — Analytics | Pending |
| ANAL-10 | Phase 6 — Analytics | Pending |
| ANAL-11 | Phase 6 — Analytics | Pending |
| ANAL-12 | Phase 6 — Analytics | Pending |
| SEED-01 | Phase 7 — Integration and Launch | Pending |
| SEED-02 | Phase 7 — Integration and Launch | Pending |
| SEED-03 | Phase 7 — Integration and Launch | Pending |
| SEED-04 | Phase 7 — Integration and Launch | Pending |

**Coverage:**
- v1 requirements: 80 total
- Mapped to phases: 80
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 — traceability populated after roadmap creation*
