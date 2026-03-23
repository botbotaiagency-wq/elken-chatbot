# Multi-Tenant AI Chatbot SaaS Platform

## What This Is

A production-grade, multi-tenant AI chatbot SaaS platform — think Chatbase or Botpress, but white-label and plug-and-play for any client. Elken is Tenant #1, using it to power "Ask Ethan Digital", a trilingual (EN/BM/ZH) customer service and GenQi facility booking chatbot deployed on WhatsApp and Telegram via n8n. Any future client onboards with config only — no code changes.

## Core Value

Any client can upload their documents, configure a bot, and have a working AI chatbot live on WhatsApp/Telegram within minutes — with zero code changes required.

## Requirements

### Validated

All v1 requirements validated in Phase 7 (2026-03-23):

- [x] Multi-tenant database schema with bot-scoped isolation — Validated in Phase 1: Data Foundation
- [x] Supabase Auth with tenant context and super-admin (Navien) role — Validated in Phase 1: Data Foundation
- [x] Full admin dashboard with 11-page sidebar navigation — Validated in Phase 4: Admin Dashboard
- [x] Knowledge base: file upload (PDF/DOCX/TXT) → text extraction → chunking → embedding → pgvector storage — Validated in Phase 2: RAG Pipeline
- [x] RAG chat endpoint: embed query → cosine search → FAQ priority injection → Claude haiku streaming response — Validated in Phase 2: RAG Pipeline
- [x] Auto-detect language (EN/BM/ZH) and classify intent per message — Validated in Phase 3: Webhook Gateway
- [x] Testing console with source chunks, intent, latency display — Validated in Phase 4: Admin Dashboard
- [x] Personality configuration per bot (name, greetings per language, tone, fallback message) — Validated in Phase 4: Admin Dashboard
- [x] FAQ CRUD with language tagging and pre-seeded Elken FAQs — Validated in Phase 7: Integration and Launch
- [x] Response templates tied to intents with EN/BM/ZH variants, pre-seeded for Elken — Validated in Phase 7: Integration and Launch
- [x] Guardrails: blocked topics, disclaimers, response length, off-topic deflection — Validated in Phase 4: Admin Dashboard
- [x] Bookings management page (Elken-specific, feature-flagged per bot) — Validated in Phase 5: Booking System
- [x] Booking flow state machine (stateful via conversationId) with member/non-member paths and slot checking — Validated in Phase 5: Booking System
- [x] Analytics: message volume, intent breakdown, unanswered queries, response latency, booking funnel — Validated in Phase 6: Analytics
- [x] API key generation/revocation with prefix display and key hashing — Validated in Phase 3: Webhook Gateway
- [x] Integrations page with n8n copy-paste snippets for Telegram and WhatsApp — Validated in Phase 7: Integration and Launch
- [x] Super-admin view to manage all tenants — Validated in Phase 1: Data Foundation
- [x] Elken seed script: tenant, bot, FAQs, templates, personality config — Validated in Phase 7: Integration and Launch

### Active

(None — all v1 requirements shipped)

### Out of Scope

- Google Drive folder sync — deferred, manual upload only for v1
- Python Railway ingestion worker — ingestion runs inside Next.js API routes for v1 simplicity
- Mobile app — web dashboard only
- Real-time chat notifications/websockets for admin — polling sufficient for v1
- OAuth login for end users — n8n handles messaging auth; dashboard uses Supabase Auth

## Context

- **Elken** is a Malaysian MLM health/beauty company. Their bot handles product enquiries and GenQi facility bookings across two locations (Old Klang Road and Subang).
- Messaging channels (Telegram/WhatsApp) are bridged via n8n — this platform exposes a clean REST webhook only. n8n sends messages in, this app responds with streamed AI replies.
- Three languages required: English, Bahasa Malaysia (BM), Chinese (ZH). Language is auto-detected from the user's message.
- Booking system is for GenQi wellness centres — beds, inhalers, meeting rooms — with specific capacity rules, last-booking cutoffs, and member vs non-member paths.
- pgvector is used for semantic search over knowledge base chunks (1536-dim embeddings via Claude/voyage-3).
- Super admin is Navien (the builder), who can see all tenants and bots across the platform.
- Supabase project not yet created — will be set up as part of the build.

## Constraints

- **Tech stack**: Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Postgres + pgvector), Claude API (haiku for chat), Supabase Storage — locked per spec
- **AI model**: claude-haiku-20241022 for chat, voyage-3 or Claude embeddings for RAG — no substitution
- **Ingestion**: Must run inside Next.js API routes (no separate Railway worker for v1)
- **Messaging**: n8n is the bridge — this app must NOT implement Telegram/WhatsApp SDK directly; expose REST webhook only
- **Multi-tenancy**: Every DB query must be scoped by bot_id; tenant isolation is non-negotiable
- **Drive sync**: Out of scope for v1 — do not design for it in initial implementation
- **Hosting**: Vercel for frontend

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Ingestion in Next.js API routes (not Railway Python worker) | Simpler v1 deployment, fewer moving parts | — Pending |
| Google Drive sync deferred to v2 | Not needed to launch, reduces complexity | — Pending |
| n8n as messaging bridge (not direct SDK) | Clean separation of concerns, reusable for any channel | — Pending |
| pgvector for RAG (not Pinecone/Weaviate) | Already in Supabase, no extra infra | — Pending |
| Booking state machine via conversation.metadata jsonb | Stateful without extra tables, survives context resets | — Pending |
| Feature-flagged booking module | Makes platform reusable for non-booking clients | — Pending |

---
*Last updated: 2026-03-23 — Phase 7 complete, all v1 requirements shipped*
