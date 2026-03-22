# Roadmap: Multi-Tenant AI Chatbot SaaS Platform

## Overview

This platform is built in 7 phases that follow a strict dependency chain: the schema and tenant isolation come first because everything queries the database; the RAG pipeline comes second because it is the product; the webhook gateway comes third because it is the only delivery channel; the admin dashboard comes fourth because it configures and tests what phases 1-3 built; the booking state machine comes fifth as a feature-flagged Elken module on top of a stable foundation; analytics comes sixth because usage data must be flowing before aggregation is meaningful; and the integration layer and seed data close the loop for the Elken launch.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Supabase schema, RLS policies, tenant isolation, and auth setup (completed 2026-03-18)
- [x] **Phase 2: RAG Pipeline** - Knowledge base ingestion and semantic retrieval engine (completed 2026-03-19)
- [x] **Phase 3: Webhook Gateway** - Public chat endpoint, API key auth, language detection, and intent classification (completed 2026-03-21)
- [x] **Phase 4: Admin Dashboard** - Bot configuration UI, FAQ/template management, testing console (completed 2026-03-21)
- [x] **Phase 5: Booking System** - GenQi booking state machine, staff admin, and automated notifications (completed 2026-03-22)
- [ ] **Phase 6: Analytics** - Message volume, intent breakdown, latency, booking reports, and CSV export
- [ ] **Phase 7: Integration and Launch** - Elken seed data, n8n integration snippets, and end-to-end smoke test

## Phase Details

### Phase 1: Data Foundation
**Goal**: A production-grade Supabase schema with RLS, HNSW pgvector index, and Supabase Auth is in place so that every subsequent query is bot-scoped and tenant-isolated by default
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. Admin can log in to the dashboard with email and password and their session is scoped — they see only their own tenant's data
  2. Super-admin (Navien) can log in and view all tenants and bots across the platform
  3. A two-tenant isolation test passes: tenant A cannot read any data scoped to tenant B
  4. All bot_id-scoped tables have RLS enabled and an HNSW index exists on the chunks.embedding column
  5. A new tenant can be onboarded by creating a tenant + bot record with no code changes required
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md — Scaffold Next.js 14 project with Supabase clients and dashboard routing skeleton
- [x] 01-02-PLAN.md — Database schema migrations, RLS policies, HNSW index, auth hook, and pgTAP tests
- [x] 01-03-PLAN.md — Auth middleware, login page, dashboard auth protection, and end-to-end verification

### Phase 2: RAG Pipeline
**Goal**: Documents can be uploaded, chunked, embedded, and stored; the bot can retrieve the most relevant chunks for any query in English, Bahasa Malaysia, and Chinese
**Depends on**: Phase 1
**Requirements**: KB-01, KB-02, KB-03, KB-04, KB-05, KB-06, KB-07, RAG-01, RAG-02, RAG-03, RAG-04, RAG-05, RAG-06, RAG-07, RAG-08, RAG-09, RAG-10
**Success Criteria** (what must be TRUE):
  1. Admin can upload a PDF, DOCX, or TXT file and watch its status move from pending to processing to ready, with a chunk count displayed on completion
  2. Admin can delete a document and all its chunks are removed from pgvector
  3. A query in English, Bahasa Malaysia, or Chinese returns the correct top-k chunks from the knowledge base with similarity scores above 0.75
  4. FAQs are returned as priority context above RAG chunks — a question that matches an FAQ returns the FAQ answer, not a document chunk
  5. All messages are logged with role, intent, source chunk IDs, similarity scores, rag_found flag, and response latency
**Plans**: 6 plans
Plans:
- [ ] 02-01-PLAN.md — Schema migrations (vector 1024 fix, products table, FAQ embeddings, RPC functions), vitest setup, ingestion libraries (extractor, chunker, embedder)
- [ ] 02-02-PLAN.md — Document upload/process/list/delete API routes and product CRUD with CSV bulk import
- [ ] 02-03-PLAN.md — RAG retrieval library (FAQ priority matching, chunk search, product search, intent/language detection, prompt assembly)
- [ ] 02-04-PLAN.md — Streaming RAG chat endpoint with message logging
- [ ] 02-05-PLAN.md — End-to-end verification: migrations, storage bucket, env vars, and chat endpoint smoke test
- [ ] 02-06-PLAN.md — Gap closure: API key validation, wellness fallback, RAG-08 scope clarification

### Phase 3: Webhook Gateway
**Goal**: n8n can send a WhatsApp or Telegram message to the platform's public webhook and receive a streaming, language-correct, intent-classified Claude response — authenticated by API key
**Depends on**: Phase 2
**Requirements**: API-01, API-02, API-03, API-04, API-05
**Success Criteria** (what must be TRUE):
  1. Admin can generate an API key, see it in full exactly once, and the platform stores only its SHA-256 hash
  2. Admin can view existing keys by label and 8-char prefix with last-used timestamp, and can revoke any key
  3. A POST to /api/chat/[botId] with a valid API key returns a streaming response; the same request with an invalid or revoked key returns 401
  4. The integrations page displays a copy-paste webhook URL and n8n JSON body snippet for both Telegram and WhatsApp
**Plans**: 2 plans
Plans:
- [ ] 03-01-PLAN.md — Database migration, key generation helper, API routes for key lifecycle, chat endpoint validation update, and tests
- [ ] 03-02-PLAN.md — API Keys management page with show-once modal and Integrations page with n8n snippets

### Phase 4: Admin Dashboard
**Goal**: An authenticated admin can configure every aspect of their bot — personality, FAQs, templates, guardrails — and test it live from the dashboard before going live
**Depends on**: Phase 3
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Admin can set bot name, per-language greeting (EN/BM/ZH), tone, and fallback message — changes persist and are reflected immediately in chat responses
  2. Admin can configure guardrails: blocked topic keywords refuse with a custom message, mandatory disclaimer text appears in responses, and off-topic messages are deflected
  3. Admin can create, edit, and delete FAQ pairs with language tags and response templates tied to specific intents
  4. Admin can send a test message in the dashboard's chat console and see the bot's response alongside the retrieved source chunks, classified intent, response time, and rag_found status
  5. Admin can override the language (EN/BM/ZH) in the testing console and reset the conversation to start a fresh test session
**Plans**: 4 plans
Plans:
- [ ] 04-01-PLAN.md — Database migration, config API routes (personality, guardrails, FAQs, templates, bots list), bot detail tab layout, bots list page
- [ ] 04-02-PLAN.md — Personality and Guardrails config form pages, wire bot config into chat pipeline (dynamic system prompt + language override)
- [ ] 04-03-PLAN.md — FAQ management page (CRUD table + modal + inline delete) and Response Templates management page (table + edit modal)
- [ ] 04-04-PLAN.md — Testing console: internal test-chat API, debug endpoint for source chunks, streaming chat UI with metadata panel

### Phase 5: Booking System
**Goal**: Elken customers can complete a full GenQi facility booking through the WhatsApp bot; staff can manage, approve, and track all bookings from the admin dashboard; and automated confirmation, reminder, and survey messages are sent without manual intervention
**Depends on**: Phase 4
**Requirements**: BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-05, BOOK-06, BOOK-07, BOOK-08, BOOK-09, BOOK-10, BOOK-11, BOOK-12, BOOK-13, BOOK-14, BOOK-15, BOOK-16, BOOK-17, BADM-01, BADM-02, BADM-03, BADM-04, BADM-05, BADM-06, BADM-07, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04
**Success Criteria** (what must be TRUE):
  1. A customer messaging with intent book_session is guided through facility selection, location selection, and time slot selection via the bot; if the slot is full, the bot offers the next 3 available alternatives
  2. A booking submission creates a pending booking record; staff can confirm, cancel, or mark it as no-show from the admin dashboard; every change is recorded in an audit trail
  3. When staff approve a booking, a confirmation message is automatically sent to the customer's WhatsApp/Telegram channel; a 24-hour reminder and post-session survey are sent automatically
  4. Double-booking is prevented: two simultaneous requests for the same slot result in exactly one confirmed booking
  5. Staff can register a walk-in customer directly from the admin dashboard and view all bookings filtered by location, date, status, and facility type
**Plans**: 6 plans
Plans:
- [ ] 05-01-PLAN.md — Database schema (bookings, facilities_config tables), RPC functions (slot check, status update, field edit, find slots), RLS policies, TypeScript types, shadcn components
- [ ] 05-02-PLAN.md — Booking state machine (conversational flow handler), slot checker library, chat endpoint integration
- [ ] 05-03-PLAN.md — Booking admin API routes (list, walk-in, status change, edit) and n8n notification dispatcher
- [ ] 05-04-PLAN.md — Bookings management page (filterable table, walk-in dialog, detail sheet, audit trail) and facility configuration page
- [ ] 05-05-PLAN.md — Notification dispatch cron route (Vercel Cron for reminders and surveys) and vercel.json configuration
- [ ] 05-06-PLAN.md — Survey response endpoint and full build verification

### Phase 6: Analytics
**Goal**: Admin and super-admin can see how the bot is performing — message volume, intent distribution, unanswered queries, latency, and booking funnel — and export any report to CSV
**Depends on**: Phase 3
**Requirements**: ANAL-01, ANAL-02, ANAL-03, ANAL-04, ANAL-05, ANAL-06, ANAL-07, ANAL-08, ANAL-09, ANAL-10, ANAL-11, ANAL-12
**Success Criteria** (what must be TRUE):
  1. Admin can view a message volume chart filtered by today / 7d / 30d and by channel, and an intent breakdown pie chart showing browse_product / health_issue / book_session / faq / unknown
  2. Admin can see a log of unanswered queries (rag_found = false) sorted by frequency, and response latency p50/p95 per bot
  3. Admin can view booking reports: confirmed bookings per period, cancellations with full audit history, facility type breakdown, location volume (Old Klang Road vs Subang), and booking funnel from enquiry to attended
  4. Admin can view a customer satisfaction report showing all post-session survey responses
  5. Every report is exportable to CSV with a single action
**Plans**: TBD

### Phase 7: Integration and Launch
**Goal**: Elken is live on WhatsApp and Telegram with all seed data in place and the end-to-end flow validated through a real n8n pipeline
**Depends on**: Phase 6
**Requirements**: SEED-01, SEED-02, SEED-03, SEED-04
**Success Criteria** (what must be TRUE):
  1. Running the seed script once creates the Elken tenant, the Ask Ethan Digital bot, all FAQs in EN/BM/ZH, all response templates, and the personality configuration — with no manual steps
  2. A real WhatsApp message sent through n8n reaches the webhook, triggers the RAG pipeline, and returns a streaming response back to the WhatsApp user
  3. The Elken bot correctly handles a product enquiry, a health concern query, and a booking request in all three languages (EN/BM/ZH) end-to-end in the live n8n environment
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 3/3 | Complete   | 2026-03-18 |
| 2. RAG Pipeline | 6/6 | Complete   | 2026-03-20 |
| 3. Webhook Gateway | 2/2 | Complete   | 2026-03-21 |
| 4. Admin Dashboard | 5/5 | Complete   | 2026-03-21 |
| 5. Booking System | 6/6 | Complete   | 2026-03-22 |
| 6. Analytics | 0/TBD | Not started | - |
| 7. Integration and Launch | 0/TBD | Not started | - |
