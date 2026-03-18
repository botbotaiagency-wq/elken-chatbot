# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Any client can upload their documents, configure a bot, and have a working AI chatbot live on WhatsApp/Telegram within minutes — with zero code changes required.
**Current focus:** Phase 1 — Data Foundation

## Current Position

Phase: 1 of 7 (Data Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-18 — Roadmap created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Ingestion runs inside Next.js API routes (not Railway Python worker) — simpler v1 deployment
- n8n is the messaging bridge — this app exposes REST webhook only, no direct SDK
- pgvector for RAG via Supabase — no extra infra needed
- Booking state machine persisted in conversation.metadata jsonb — stateful without extra tables
- Feature-flagged booking module — platform reusable for non-booking clients

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 5 (Booking): Elken's exact booking rules (cutoff times, member/non-member paths, facility/slot schema) are not yet fully specified. A requirements session with Navien/Elken is needed before the state machine is designed.
- Phase 3 (Language Detection): BM language detector library choice (franc, langdetect, or custom keyword-based) needs an empirical test against real Elken WhatsApp samples before committing to an implementation.
- Phase 7 (n8n Integration): Exact JSON payload shape from n8n (conversation_id, sender_id field names) must be confirmed with Navien's current n8n setup before webhook implementation.

## Session Continuity

Last session: 2026-03-18
Stopped at: Roadmap created — ready to plan Phase 1
Resume file: None
