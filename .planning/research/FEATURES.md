# Feature Landscape

**Domain:** Multi-Tenant AI Chatbot SaaS Platform (with RAG, multilingual support, booking flows)
**First Tenant:** Elken (Malaysian health/beauty, EN/BM/ZH, WhatsApp/Telegram via n8n)
**Researched:** 2026-03-18
**Confidence:** MEDIUM — based on training knowledge of Chatbase, Botpress, CustomGPT, Intercom, Tidio, and RAG literature (cutoff Aug 2025). External verification blocked in this session; flag for manual validation against current competitor feature pages.

---

## Table Stakes

Features users (tenant admins) expect from day one. Missing any of these and the platform feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Document ingestion (PDF/DOCX/TXT upload) | Every RAG chatbot platform offers this as the primary onboarding step | Medium | Text extraction, chunking, embedding, pgvector storage |
| Semantic search / RAG retrieval | Core differentiator of AI chatbots over keyword bots; users expect it | High | Cosine similarity on 1536-dim embeddings; cosine threshold tuning needed |
| Conversation webhook endpoint (REST) | The integration surface for external channel bridges (n8n, Zapier, etc.) | Low | Input: message + conversationId. Output: streamed AI reply |
| Streamed AI responses | Users typing into chatbots expect typing indicators / incremental text; non-streaming feels broken | Medium | Server-sent events (SSE) or chunked HTTP from Claude haiku |
| Multi-language auto-detection and reply | For SEA markets, EN-only bots lose 40-60% of users | Medium | Detect from message charset/patterns; reply in detected language |
| FAQ management (CRUD) | Admins must be able to define known answers that override RAG | Low | Language-tagged; high-priority injection before RAG context |
| Personality / bot configuration | Name, tone, greeting, fallback message — expected by any SaaS tenant | Low | Per-bot JSONB config; no code change per tenant |
| Admin dashboard login and auth | Secure tenant-scoped admin access | Low | Supabase Auth; RLS enforces tenant isolation |
| Testing / chat console in dashboard | Admins must be able to test the bot before going live | Low | Shows response, source chunks, intent, latency |
| Analytics: message volume and intent breakdown | Tenant needs to know if bot is working; without this they can't justify the spend | Medium | Time-series counts, intent pie chart, top queries |
| API key generation and revocation | Required for any platform that exposes a REST API | Low | Key hashing (SHA-256), prefix display, revocation |
| Tenant/bot isolation | Multi-tenancy is the product; a data leak between tenants is catastrophic | High | Every query scoped by bot_id; enforced at DB layer via RLS |
| Knowledge base file management | Upload, view, delete documents in the knowledge base | Low | File list with status (pending/indexed/error) |
| Unanswered / low-confidence query log | Admins must identify what the bot can't answer to improve the knowledge base | Medium | Queries where retrieval score < threshold logged separately |
| Response guardrails (blocked topics, off-topic deflection) | Without this, bots answer anything — problematic for regulated industries (MLM/health) | Low | Blocklist + deflection message config per bot |

---

## Differentiators

Features that set this platform apart. Not expected by default, but create real competitive advantage or unlock specific verticals.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Booking / appointment flow state machine | Unlocks entire vertical (wellness, clinics, salons) that generic chatbot platforms cannot serve | High | Stateful via conversationId; member/non-member paths; slot availability checks; last-booking cutoffs |
| Feature-flagged modules per bot | Platform stays generic; booking module only activated for relevant tenants — not an anti-feature for non-booking clients | Low | Boolean flag in bot config; dashboard hides/shows booking pages accordingly |
| Trilingual SEA support (EN/BM/ZH) with per-language templates | Competitors either skip BM entirely or deliver poor quality; native templates per language is rare | Medium | Response templates with language variants seeded per tenant; not just translation |
| Pre-seeded tenant onboarding (FAQs, templates, personality) | Reduces time-to-live from days to minutes; rare in self-serve platforms | Medium | Elken seed script; generalised to "seed pack" concept for future tenants |
| Intent classification with per-message labelling | Goes beyond just RAG — understanding intent lets the bot route, escalate, or trigger workflows | Medium | Claude-based intent classifier; result stored with each conversation turn |
| Source chunk transparency in testing console | Admins can see exactly which document chunks drove an answer — builds trust and helps diagnose failures | Low | Metadata alongside response: chunk IDs, scores, source filename |
| Response latency display in testing console | Lets admins identify performance issues before users complain | Low | Wall-clock from request to first token; stored per conversation turn |
| Booking funnel analytics | Specific to booking-enabled tenants; conversion from enquiry → booking is a key business metric | Medium | Step-by-step funnel: intent detected → slot shown → confirmed → no-show |
| n8n integration snippets (copy-paste) | Dramatically lowers the barrier for non-developers to connect WhatsApp/Telegram | Low | Pre-filled webhook URL, API key placeholder, JSON body template |
| Super-admin cross-tenant view | Platform operator (Navien) can monitor all tenants and bots without separate logins | Low | Role-gated dashboard page; read-only view across all tenant data |
| Conversation memory / context window management | Bot maintains coherent multi-turn conversations; most simple webhook integrations are stateless and lose context | Medium | conversationId → last N turns fetched and injected into prompt |

---

## Anti-Features

Features to deliberately NOT build in v1. Each has a reason and a safer alternative.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Direct WhatsApp / Telegram SDK integration | Couples the platform to specific channel SDKs; breaks when APIs change; adds auth complexity | Expose clean REST webhook only; let n8n own the channel bridge |
| Google Drive / cloud storage auto-sync | Adds OAuth flow, polling worker, file change detection, and failure recovery complexity — not needed to launch | Manual file upload only for v1; design storage layer to accept Drive as a future source |
| Real-time admin notifications / websockets | Polling is sufficient for v1 admin dashboard; websockets add infra complexity and cost | Use SWR or React Query polling at 30-second intervals |
| Mobile app (iOS/Android) | Web-first admin dashboard is sufficient; mobile adds release cycle overhead | Responsive web dashboard only |
| Python ingestion microservice (Railway worker) | Separate service = separate deploy, separate env vars, separate failure domain; not worth it for v1 | Run ingestion inside Next.js API routes; extract to worker only when rate/timeout pressure demands it |
| OAuth login for end users (chatbot users) | End users authenticate via WhatsApp/Telegram identity; the platform never sees them directly | n8n passes sender ID as external_user_id in webhook payload; no auth needed here |
| Multi-model support (GPT-4, Gemini, etc.) | Model abstraction adds complexity and testing surface; locked to Claude per spec | Use Claude haiku exclusively; model routing can be a v2 feature if a tenant demands it |
| Marketplace / template store | Premature for a single-tenant launch; requires governance and vetting | Build tenant-specific seed scripts; generalize later when there are 3+ tenants |
| Billing and subscription management | Navien manages billing manually at this scale; Stripe integration is a distraction | Out of scope entirely; revisit when tenant count > 5 |
| End-to-end chat widget (embeddable JS) | Adds frontend SDK surface area; Elken is WhatsApp-first anyway | REST webhook only; widget is a v2 feature for web-based tenants |

---

## Feature Dependencies

```
Document Upload
  → Text Extraction
    → Chunking
      → Embedding (voyage-3 / Claude)
        → pgvector Storage
          → Semantic Search (RAG Retrieval)
            → RAG Chat Endpoint
              → Streaming Response

FAQ CRUD
  → FAQ Priority Injection (injected before RAG context in prompt)
    → RAG Chat Endpoint

Intent Classification
  → Response Templates (intent-matched templates)
    → RAG Chat Endpoint

Language Auto-Detection
  → Response Templates (language-variant selection)
  → Greeting / Fallback Messages (per-language personality config)

Conversation State (conversationId → metadata JSONB)
  → Booking Flow State Machine
    → Slot Availability Check
      → Booking Confirmation
        → Booking Record Storage
          → Bookings Management Page

API Key (generated, hashed)
  → Webhook Endpoint Auth
    → n8n Integration

Tenant / Bot Config
  → Feature Flags (booking module on/off)
  → Personality Config
  → Guardrails Config

Analytics Collection (per message turn)
  → Message Volume Chart
  → Intent Breakdown Chart
  → Unanswered Query Log
  → Booking Funnel (booking-enabled bots only)
  → Response Latency Display

Super-Admin Role (Supabase Auth)
  → Cross-Tenant View
```

---

## MVP Recommendation

The Elken deployment is the MVP. Prioritize in this order:

1. **RAG pipeline end-to-end** — Upload → chunk → embed → retrieve → stream. Nothing else matters without this.
2. **Webhook endpoint with auth** — n8n integration is the delivery channel; get this working early.
3. **Multi-language detection and response templates** — Elken's users are trilingual; this is table stakes for them even if it's differentiating in the market.
4. **Testing console** — Essential for validating RAG quality before going live; prevents shipping a broken bot.
5. **Booking state machine** — Elken's primary use case beyond product queries; must be in v1.
6. **FAQ management + personality config** — Admins need these to tune the bot without developer help.
7. **Analytics (volume + intent + unanswered)** — Required to demonstrate value to Elken post-launch.
8. **API key management** — Needed for secure n8n integration.

Defer:
- **Super-admin cross-tenant view** — Only one tenant at launch; build when Tenant #2 onboards.
- **Booking funnel analytics** — Useful but not launch-blocking; add after first week of real bookings.
- **n8n integration snippets page** — Copy-paste docs can live in a README until the dashboard page is built.

---

## Sources

- Platform feature knowledge: Chatbase (chatbase.co), Botpress (botpress.com), CustomGPT (customgpt.ai), Intercom, Tidio — training data, cutoff Aug 2025. **MEDIUM confidence** — competitor features evolve rapidly; manual spot-check recommended.
- RAG pipeline patterns: LangChain documentation, LlamaIndex documentation, Anthropic RAG guides — training data. **MEDIUM confidence**.
- Multi-tenancy patterns: Supabase RLS documentation, pgvector documentation — training data. **MEDIUM confidence**.
- Booking state machine patterns: General FSM literature, chatbot booking flow UX research — training data. **LOW confidence** — no specific post-2024 sources available in this session; validate against similar implementations (Setmore, Calendly chatbot integrations).
- Southeast Asian language support: OpenAI multilingual benchmarks, Anthropic multilingual capability documentation — training data. **MEDIUM confidence** for EN/ZH; **LOW confidence** for BM-specific quality claims.
