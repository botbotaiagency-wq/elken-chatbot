# BotBase v2 — Complete Product & Technical Specification
**By Iceberg AI Solutions**
**Version:** 2.0.0
**Date:** 2026-04-08
**Status:** Ready for Claude Code Build

---

## 1. PRODUCT IDENTITY

**Product Name:** BotBase by Iceberg AI Solutions
**Tagline:** "The Most Complete AI Agent Platform"
**Vision:** A multi-tenant, white-label AI chatbot SaaS platform that lets any business deploy intelligent AI agents across WhatsApp, Telegram, and web — with built-in booking, CRM, script builder, live agent handoff, analytics, and full campaign automation. Better than Intercom. Cheaper than Botpress. More powerful than Chatbase.
**Target Market:** SMEs, Agencies, Enterprise — Global
**First Tenants (v2 build targets):** Elken (existing), Clinic (Dr Aiman), Insurance Agency, Property Agency

---

## 2. V1 BASELINE (What's Already Built)

From the existing codebase (`elken-whatsapp-chatbot`):

✅ Multi-tenant DB schema (bot_id isolation, RLS)
✅ Supabase Auth (email/password)
✅ RAG pipeline (VoyageAI embeddings → pgvector cosine search → Claude Haiku)
✅ Document ingestion (PDF/DOCX/TXT → chunk → embed)
✅ Intent classification + language detection (EN/BM/ZH)
✅ Booking state machine (stateful via conversation.metadata JSONB)
✅ Google Calendar sync for bookings
✅ Admin dashboard (11 pages per bot)
✅ Analytics (volume, intent, latency, funnel)
✅ API key management
✅ n8n integration snippets (WhatsApp/Telegram bridge)
✅ Testing console with source chunk display
✅ FAQ CRUD + Response templates
✅ Guardrails (blocked topics, disclaimers, response length)
✅ Super admin cross-tenant view

---

## 3. V2 WHAT'S NEW — FEATURE DELTA

Everything below is **net new** for v2:

### 3.1 AI Brain Upgrades
- 10-step debug pipeline (visible per message in conversation log — like VisitMelaka Tuah)
- Configurable RAG threshold per bot in dashboard (not hardcoded)
- System prompt studio (full editor in dashboard, live preview)
- Sentiment detection per message (positive / neutral / negative / frustrated)
- AI Memory per contact (cross-session preference/history recall)
- URL ingestion (scrape website into knowledge base)
- Google Sheets as live data source (read product pricing, availability live)

### 3.2 Script / Flow Builder
- Visual drag-drop flow canvas (React Flow embedded)
- Node types: Message, Question, Condition/Branch, AI Response, API Call, Booking Action, Lead Capture, Delay, Human Handoff, Jump
- Template editor mode (non-technical: define flow in structured form)
- AI Script generation (describe flow in English → system generates it)
- Pre-built industry templates: Clinic, Insurance, Property, F&B, E-commerce
- Script versioning (save, publish, rollback)

### 3.3 Channel Engine (Replace n8n external dependency)
- Native webhook processor built into BotBase (receives from WhatsApp/Telegram)
- WhatsApp Cloud API native integration (Meta — no third party)
- Telegram Bot API native integration
- Web Chat Widget (embeddable `<script>` tag, `<iframe>` option)
- Channel configuration UI per bot (paste tokens, test connection)
- Outbound message API (bot proactively sends messages to contacts)

### 3.4 CRM & Lead Management
- Contacts table per bot: auto-capture name, phone, email, language, channel, last query
- Lead stages: new → engaged → qualified → booked → converted → churned
- CSV import (with template download) + CSV/Excel export
- Tags and custom fields per bot
- Lead score (AI-calculated from engagement signals)
- Contact profile page (full conversation history + booking history)

### 3.5 Broadcast & Campaign Manager
- Broadcast composer (WhatsApp template messages)
- Audience segmentation: filter by tag, language, stage, last active
- Scheduled sends
- Campaign analytics: delivered / read / replied / converted
- Drip sequences (Day 1 / Day 3 / Day 7 automation)

### 3.6 Smart Follow-Up Engine
- Configurable re-engagement rules ("no reply in 24h → send follow-up")
- AI-generated follow-up message based on last conversation context
- Escalation rules ("3 follow-ups no conversion → assign to human")
- Proactive outreach from lead import (start conversation from CSV upload)

### 3.7 Live Agent Handoff
- "Take over" button in conversation log (admin types reply directly)
- Bot pauses when agent takes over; resumes when agent clicks "Done"
- Internal notes (visible to agents only, not user)
- Agent assignment (manual or round-robin)
- Live typing indicator for admin

### 3.8 Enhanced Conversation Log
- Full thread view (like Tuah: Response tab + Pipeline tab per message)
- Pipeline tab shows all 10 processing steps with timing
- Guardrail tag, template used, language, intent all visible inline
- Full-text search across all conversations
- Filter by: date, channel, language, guardrail hit, bot, tenant, sentiment
- Export conversation to PDF/CSV

### 3.9 Enhanced Booking Engine
- Generic booking module (not Elken-specific): any service type
- Service catalogue (admin defines services: name, duration, price, buffer time)
- Staff/resource assignment per service
- Multi-location support
- Customer-facing reschedule/cancel via chat
- Waitlist for full slots
- Restaurant table reservation mode (party size, special requests, dietary)
- Birthday/anniversary flags → staff notification
- Walk-in queue management
- Booking widget (embeddable on website)
- iCal feed per staff member

### 3.10 Enhanced Analytics
- Sentiment trend over time
- Top unanswered queries (improvement suggestions)
- Lead conversion funnel
- Campaign performance dashboard
- Booking revenue tracking (if price configured)
- Bot health score (composite: response quality, guardrail rate, satisfaction)
- Export all reports to CSV/PDF

### 3.11 Auth Improvements
- Google SSO (Supabase OAuth provider)
- Magic link login
- Tenant onboarding wizard (invite URL flow)
- Role: super_admin / tenant_admin / agent (new: agent role for live handoff only)

### 3.12 Platform & Multi-Tenancy
- Tenant onboarding flow: invite URL → signup → wizard → go live
- White-label: custom domain, remove branding, custom colors (premium tier)
- Platform billing tracker (super admin sees usage per tenant for invoicing)
- Bot health monitor (super admin: all bots status, last active, error rate)

### 3.13 Web Chat Widget
- Embeddable JavaScript snippet (`<script>` tag)
- Configurable: colors, avatar, welcome message, quick reply buttons
- Mobile responsive
- Typing indicator
- Message read receipts
- Persistent conversation (localStorage session)
- Public chat URL (like Tuah's /PublicChat)

---

## 4. TECH STACK (V2 — SAME BASE + ADDITIONS)

### Unchanged from V1
- **Framework:** Next.js (latest App Router), TypeScript strict
- **Database:** Supabase (PostgreSQL + pgvector)
- **AI:** Claude API (claude-haiku-4-5-20251001 for chat, claude-sonnet for complex tasks)
- **Embeddings:** VoyageAI voyage-3-large (1024-dim)
- **Auth:** Supabase Auth
- **Hosting:** Vercel
- **UI:** shadcn/ui + Tailwind CSS
- **Charts:** Recharts

### New Dependencies
- `reactflow` — visual flow builder canvas
- `@supabase/realtime` — live conversation updates (replace polling)
- `puppeteer` or `cheerio` — URL/website scraping for KB ingestion
- `sharp` — image processing for widget avatar
- `resend` or `@sendgrid/mail` — email notifications (booking confirmations, invites)
- `zod` — request validation (upgrade from ad-hoc)
- `react-hook-form` — form management
- `@tanstack/react-table` — contact/booking table with sorting/filtering
- `socket.io-client` — live agent typing indicator

### Infrastructure Additions
- **Supabase Realtime** — live conversation feed for agents
- **Supabase Edge Functions** — WhatsApp/Telegram webhook receivers (replaces n8n)
- **Vercel Cron** — existing + new jobs (drip sequences, lead re-engagement)

---

## 5. DATABASE SCHEMA — V2 ADDITIONS

All existing V1 tables remain unchanged. New tables below:

```sql
-- ============================================================
-- MIGRATION: 00016_v2_channels.sql
-- ============================================================

-- Channel configurations per bot
CREATE TABLE channel_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'web_widget', 'instagram', 'facebook')),
  is_active BOOLEAN DEFAULT FALSE,
  config JSONB DEFAULT '{}',
  -- WhatsApp: phone_number_id, access_token, verify_token, waba_id
  -- Telegram: bot_token, bot_username
  -- Web Widget: allowed_domains[], theme_config
  webhook_url TEXT,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, channel)
);

-- ============================================================
-- MIGRATION: 00017_v2_contacts.sql
-- ============================================================

-- CRM Contacts (auto-created from conversations)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  external_id TEXT, -- WhatsApp number / Telegram user_id / email
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  name TEXT,
  phone TEXT,
  email TEXT,
  language TEXT DEFAULT 'en',
  tags TEXT[] DEFAULT '{}',
  lead_stage TEXT DEFAULT 'new' CHECK (lead_stage IN ('new','engaged','qualified','booked','converted','churned')),
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  custom_fields JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  total_messages INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  notes TEXT,
  assigned_agent_id UUID REFERENCES auth.users(id),
  opt_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, external_id, channel)
);

CREATE INDEX idx_contacts_bot_id ON contacts(bot_id);
CREATE INDEX idx_contacts_lead_stage ON contacts(bot_id, lead_stage);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- ============================================================
-- MIGRATION: 00018_v2_scripts.sql
-- ============================================================

-- Flow/Script builder
CREATE TABLE bot_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT DEFAULT 'keyword' CHECK (trigger_type IN ('keyword','intent','always','manual','api')),
  trigger_value TEXT, -- keyword or intent name
  flow_data JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}', -- ReactFlow schema
  is_active BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Script versions (for rollback)
CREATE TABLE bot_script_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES bot_scripts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  flow_data JSONB NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MIGRATION: 00019_v2_broadcasts.sql
-- ============================================================

-- Broadcast campaigns
CREATE TABLE broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message_template JSONB NOT NULL, -- {body, media_url?, buttons?[]}
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  audience_filter JSONB DEFAULT '{}', -- {tags?, lead_stage?, language?, last_active_days?}
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  stats JSONB DEFAULT '{"total":0,"sent":0,"delivered":0,"read":0,"replied":0,"failed":0}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcast recipients (resolved at send time)
CREATE TABLE broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','replied','failed','opted_out')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ
);

-- Drip sequences
CREATE TABLE drip_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('contact_created','lead_stage_change','booking_confirmed','no_reply','manual')),
  trigger_value TEXT, -- e.g. lead stage value
  steps JSONB NOT NULL DEFAULT '[]',
  -- steps: [{day: 1, message: "...", channel: "whatsapp"}, ...]
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MIGRATION: 00020_v2_agents.sql
-- ============================================================

-- Agent profiles (tenant admin users with agent role)
CREATE TABLE agent_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Live agent takeover sessions
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  bot_id UUID NOT NULL REFERENCES bots(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT
);

-- ============================================================
-- MIGRATION: 00021_v2_followups.sql
-- ============================================================

-- Follow-up rules
CREATE TABLE followup_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  -- 'no_reply_Xh', 'no_booking_after_enquiry', 'booking_no_show', 'post_booking'
  trigger_hours INTEGER, -- for time-based triggers
  message_template TEXT NOT NULL,
  max_attempts INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-up queue
CREATE TABLE followup_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES followup_rules(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id),
  attempt_count INTEGER DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','completed','failed','cancelled')),
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MIGRATION: 00022_v2_sentiment.sql
-- ============================================================

-- Add sentiment to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative','frustrated'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sentiment_score FLOAT;

-- Add contact_id FK to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

-- ============================================================
-- MIGRATION: 00023_v2_widget.sql
-- ============================================================

-- Web widget configs
CREATE TABLE widget_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE UNIQUE,
  primary_color TEXT DEFAULT '#0070f3',
  secondary_color TEXT DEFAULT '#ffffff',
  font_family TEXT DEFAULT 'Inter',
  bubble_style TEXT DEFAULT 'rounded' CHECK (bubble_style IN ('rounded','sharp','pill')),
  position TEXT DEFAULT 'bottom-right' CHECK (position IN ('bottom-right','bottom-left')),
  welcome_message TEXT,
  placeholder_text TEXT DEFAULT 'Type a message...',
  quick_replies JSONB DEFAULT '[]', -- [{label: "...", message: "..."}]
  allowed_domains TEXT[] DEFAULT '{}',
  show_branding BOOLEAN DEFAULT TRUE,
  custom_css TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MIGRATION: 00024_v2_tenant_onboarding.sql
-- ============================================================

-- Tenant invite tokens
CREATE TABLE tenant_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding progress tracker
CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  steps_completed JSONB DEFAULT '{}',
  -- {create_bot: true, upload_doc: false, configure_personality: false, connect_channel: false, test_bot: false}
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. ARCHITECTURE V2

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BotBase v2 Architecture                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CHANNELS                   BOTBASE CORE               ADMIN PORTAL     │
│  ─────────                  ────────────               ──────────────   │
│  WhatsApp ──────────────→  /api/webhook/whatsapp       Next.js App      │
│  Telegram ──────────────→  /api/webhook/telegram       /dashboard       │
│  Web Widget ────────────→  /api/widget/[botId]         ─────────────    │
│  Instagram (v3) ────────→  /api/webhook/instagram      SuperAdmin       │
│  Facebook (v3) ─────────→  /api/webhook/facebook       TenantAdmin      │
│                                ↓                       AgentView        │
│                     ┌──────────────────────┐                            │
│                     │   MESSAGE ROUTER      │                            │
│                     │  1. Auth/verify       │                            │
│                     │  2. Get bot config    │                            │
│                     │  3. Get/create contact│                            │
│                     │  4. Check agent session│                           │
│                     │  5. Check script flow │                            │
│                     │  6. → AI Pipeline     │                            │
│                     └──────────────────────┘                            │
│                                ↓                                        │
│                     ┌──────────────────────┐                            │
│                     │    AI PIPELINE        │                            │
│                     │  Step 1: History ctx  │                            │
│                     │  Step 2: Guardrails   │                            │
│                     │  Step 3: Intent/Lang  │                            │
│                     │  Step 4: Script check │                            │
│                     │  Step 5: FAQ search   │                            │
│                     │  Step 6: RAG search   │                            │
│                     │  Step 7: Live API     │                            │
│                     │  Step 8: Booking check│                            │
│                     │  Step 9: Build prompt │                            │
│                     │  Step 10: LLM + stream│                            │
│                     └──────────────────────┘                            │
│                                ↓                                        │
│                     ┌──────────────────────┐                            │
│                     │   POST-PROCESSING     │                            │
│                     │  - Log message        │                            │
│                     │  - Update contact     │                            │
│                     │  - Sentiment tag      │                            │
│                     │  - Trigger followups  │                            │
│                     │  - Broadcast events   │                            │
│                     └──────────────────────┘                            │
│                                                                         │
│  BACKGROUND JOBS (Vercel Cron)                                          │
│  - /api/cron/reminders       (24h booking reminders)                    │
│  - /api/cron/followups       (re-engagement messages)                   │
│  - /api/cron/drip            (drip sequence dispatch)                   │
│  - /api/cron/broadcasts      (scheduled broadcast sends)                │
│  - /api/cron/lead-scores     (recalculate lead scores daily)            │
│                                                                         │
│  SUPABASE                                                               │
│  - Postgres (all tables) + pgvector (chunks)                            │
│  - Realtime (live conversation updates for agents)                      │
│  - Storage (documents, avatars, media)                                  │
│  - Auth (email, Google SSO, magic link)                                 │
│  - Edge Functions (optional: heavy webhook processing)                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. FULL DIRECTORY STRUCTURE — V2

```
botbase-v2/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   └── invite/[token]/          # NEW: Tenant invite acceptance
│   ├── api/
│   │   ├── admin/                   # Super admin APIs
│   │   ├── analytics/[botId]/       # Enhanced analytics
│   │   ├── auth/                    # Google Calendar OAuth
│   │   ├── bookings/[botId]/        # Booking CRUD (generalized)
│   │   ├── bots/                    # Bot CRUD
│   │   ├── broadcasts/[botId]/      # NEW: Broadcast campaigns
│   │   ├── chat/[botId]/            # Existing chat endpoint (keep)
│   │   ├── config/[botId]/          # Bot config (personality, guardrails, etc.)
│   │   ├── contacts/[botId]/        # NEW: CRM contacts CRUD
│   │   ├── cron/                    # NEW: All cron jobs
│   │   │   ├── reminders/
│   │   │   ├── followups/
│   │   │   ├── drip/
│   │   │   ├── broadcasts/
│   │   │   └── lead-scores/
│   │   ├── documents/[botId]/       # Document management
│   │   ├── followups/[botId]/       # NEW: Follow-up rules CRUD
│   │   ├── ingest/[botId]/          # Document ingestion
│   │   ├── ingest/[botId]/url/      # NEW: URL scraping ingestion
│   │   ├── keys/[botId]/            # API keys
│   │   ├── notifications/           # Notifications dispatch
│   │   ├── onboarding/              # NEW: Tenant invite + progress
│   │   ├── products/[botId]/        # Product CRUD
│   │   ├── scripts/[botId]/         # NEW: Flow builder scripts CRUD
│   │   ├── webhook/                 # NEW: Native channel webhooks
│   │   │   ├── whatsapp/
│   │   │   ├── telegram/
│   │   │   ├── instagram/
│   │   │   └── facebook/
│   │   └── widget/[botId]/          # NEW: Web widget chat endpoint
│   ├── auth/                        # Supabase auth callbacks
│   ├── dashboard/
│   │   ├── admin/
│   │   │   ├── users/
│   │   │   ├── tenants/             # NEW: Tenant management
│   │   │   ├── bots/                # NEW: All bots health monitor
│   │   │   └── billing/             # NEW: Usage tracker
│   │   ├── analytics/
│   │   ├── bookings/
│   │   ├── bots/
│   │   │   └── [botId]/
│   │   │       ├── api-keys/
│   │   │       ├── booking/
│   │   │       ├── broadcasts/      # NEW
│   │   │       ├── channels/        # NEW: Channel config UI
│   │   │       ├── contacts/        # NEW: CRM view
│   │   │       ├── conversations/   # NEW: Enhanced conversation log
│   │   │       ├── faqs/
│   │   │       ├── followups/       # NEW
│   │   │       ├── guardrails/
│   │   │       ├── integrations/
│   │   │       ├── personality/
│   │   │       ├── scripts/         # NEW: Flow builder
│   │   │       ├── templates/
│   │   │       ├── testing/
│   │   │       └── widget/          # NEW: Widget configurator
│   │   ├── knowledge/
│   │   ├── overview/                # NEW: Platform overview for tenant
│   │   └── settings/
│   ├── chat/[botId]/                # NEW: Public chat page (like Tuah's /PublicChat)
│   ├── onboarding/                  # NEW: Onboarding wizard steps
│   │   ├── create-bot/
│   │   ├── upload-docs/
│   │   ├── configure/
│   │   ├── connect-channel/
│   │   └── test/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                          # shadcn/ui primitives
│   ├── chat-widget/                 # NEW: Embeddable web widget components
│   │   ├── ChatBubble.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── MessageList.tsx
│   │   └── QuickReplies.tsx
│   ├── conversation/                # NEW: Conversation log components
│   │   ├── ConversationList.tsx
│   │   ├── ConversationThread.tsx
│   │   ├── PipelineDebug.tsx        # 10-step pipeline visualizer
│   │   └── AgentTakeover.tsx
│   ├── crm/                         # NEW: CRM components
│   │   ├── ContactsTable.tsx
│   │   ├── ContactProfile.tsx
│   │   ├── LeadStageKanban.tsx
│   │   └── ImportContacts.tsx
│   ├── flow-builder/                # NEW: Script/flow builder
│   │   ├── FlowCanvas.tsx           # ReactFlow wrapper
│   │   ├── NodeTypes/               # Custom node components
│   │   │   ├── MessageNode.tsx
│   │   │   ├── QuestionNode.tsx
│   │   │   ├── ConditionNode.tsx
│   │   │   ├── AIResponseNode.tsx
│   │   │   ├── APICallNode.tsx
│   │   │   ├── BookingNode.tsx
│   │   │   ├── LeadCaptureNode.tsx
│   │   │   ├── DelayNode.tsx
│   │   │   └── HandoffNode.tsx
│   │   ├── NodePanel.tsx            # Left panel: draggable node types
│   │   └── ScriptTemplates.tsx     # Industry template picker
│   ├── analytics/                   # Enhanced analytics components
│   ├── broadcasts/                  # NEW: Campaign composer
│   ├── onboarding/                  # NEW: Wizard step components
│   ├── auth-button.tsx
│   ├── login-form.tsx
│   └── theme-switcher.tsx
├── lib/
│   ├── analytics/
│   │   ├── queries.ts               # Enhanced queries
│   │   └── csv.ts
│   ├── api-keys/
│   │   └── generate.ts
│   ├── booking/
│   │   ├── state-machine.ts         # Enhanced (generic services)
│   │   ├── slot-checker.ts
│   │   ├── google-calendar.ts
│   │   └── notifications.ts
│   ├── broadcast/                   # NEW
│   │   ├── sender.ts                # WhatsApp/Telegram message dispatch
│   │   ├── scheduler.ts             # Schedule management
│   │   └── analytics.ts
│   ├── channels/                    # NEW: Native channel handlers
│   │   ├── whatsapp.ts              # Meta Cloud API integration
│   │   ├── telegram.ts              # Telegram Bot API integration
│   │   ├── instagram.ts
│   │   ├── facebook.ts
│   │   └── dispatcher.ts            # Unified outbound message sender
│   ├── crm/                         # NEW
│   │   ├── contacts.ts              # Contact CRUD + upsert on message
│   │   ├── lead-score.ts            # Lead scoring algorithm
│   │   └── import-export.ts
│   ├── followup/                    # NEW
│   │   ├── rules.ts
│   │   └── queue.ts
│   ├── ingest/
│   │   ├── extractor.ts
│   │   ├── chunker.ts
│   │   ├── embedder.ts
│   │   ├── qna-parser.ts
│   │   └── url-scraper.ts           # NEW: URL ingestion
│   ├── pipeline/                    # NEW: Extracted pipeline with debug
│   │   ├── index.ts                 # Orchestrator (10 steps)
│   │   ├── step-1-history.ts
│   │   ├── step-2-guardrails.ts
│   │   ├── step-3-detect.ts
│   │   ├── step-4-scripts.ts
│   │   ├── step-5-faqs.ts
│   │   ├── step-6-rag.ts
│   │   ├── step-7-live-api.ts
│   │   ├── step-8-booking.ts
│   │   ├── step-9-prompt.ts
│   │   ├── step-10-llm.ts
│   │   └── types.ts                 # PipelineContext, StepResult, etc.
│   ├── rag/
│   │   ├── detect.ts
│   │   ├── retrieve.ts
│   │   ├── prompt.ts
│   │   ├── logger.ts
│   │   └── transcribe.ts
│   ├── scripts/                     # NEW: Flow script executor
│   │   ├── executor.ts              # Runs ReactFlow graph as conversation
│   │   └── types.ts
│   ├── sentiment/                   # NEW
│   │   └── analyzer.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── service.ts
│   │   ├── middleware.ts
│   │   └── realtime.ts              # NEW: Realtime subscription helpers
│   └── widget/                      # NEW
│       └── embed-script.ts          # Generates embeddable JS snippet
├── public/
│   └── widget.js                    # NEW: Compiled web chat widget script
├── supabase/
│   └── migrations/
│       ├── 00001_extensions.sql     (existing)
│       ├── ...                      (existing 00001-00015)
│       ├── 00016_v2_channels.sql    (new)
│       ├── 00017_v2_contacts.sql    (new)
│       ├── 00018_v2_scripts.sql     (new)
│       ├── 00019_v2_broadcasts.sql  (new)
│       ├── 00020_v2_agents.sql      (new)
│       ├── 00021_v2_followups.sql   (new)
│       ├── 00022_v2_sentiment.sql   (new)
│       ├── 00023_v2_widget.sql      (new)
│       └── 00024_v2_tenant_onboarding.sql (new)
├── types/
│   ├── database.ts                  # Enhanced with all new types
│   └── pipeline.ts                  # NEW: Pipeline step types
├── scripts/
│   ├── seed-elken.mjs
│   ├── seed-clinic.mjs              # NEW: Clinic template seed
│   ├── seed-insurance.mjs           # NEW: Insurance template seed
│   ├── seed-property.mjs            # NEW: Property template seed
│   ├── patch-voyageai-esm.cjs
│   └── smoke-test.sh
├── tests/
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── vitest.config.ts
├── vercel.json                       # Updated with new cron jobs
└── package.json
```

---

## 8. UPDATED vercel.json (NEW CRON JOBS)

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/followups",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/drip",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/broadcasts",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/lead-scores",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## 9. 10-STEP AI PIPELINE (V2 — LIKE TUAH BUT BETTER)

This is the core differentiator. Every message runs through this pipeline. Each step is timed, logged, and visible in the Conversation Log debug view.

```typescript
// lib/pipeline/types.ts
export interface PipelineContext {
  botId: string
  conversationId: string
  contactId: string | null
  message: string
  userId: string
  channel: string
  bot: BotConfig
  startedAt: number
}

export interface StepResult {
  step: number
  name: string
  status: 'pass' | 'block' | 'skip' | 'error'
  durationMs: number
  data: Record<string, unknown>
}

export interface PipelineResult {
  response: string | null
  steps: StepResult[]
  intent: string
  language: string
  ragFound: boolean
  guardRailTriggered: boolean
  templateUsed: string | null
  totalDurationMs: number
}
```

### Pipeline Steps:

**Step 1: History Context** — Fetch last N conversation turns from DB. Inject into prompt context. Detect if currently in booking state machine.

**Step 2: Guardrails Check** — Check message against blocked keywords, topic rules. If blocked → return guardrail response immediately. Tag message as `guardrail`.

**Step 3: Intent + Language Detection** — Claude Haiku classifies: intent (5 types), language (en/bm/zh/ar/etc). Check scope rules (in-scope / out-of-scope).

**Step 4: Script Flow Check** — Check if bot has an active script with a trigger matching this intent/keyword. If yes → route to script executor. Script executor runs the ReactFlow graph step by step.

**Step 5: FAQ Search** — Embed query → match_faqs RPC (threshold 0.6). If score > threshold → inject FAQ answer as priority context.

**Step 6: RAG Search** — Embed query → match_chunks + match_products RPCs (threshold configurable per bot). Collect top K chunks. Score and rank.

**Step 7: Live API Call** — If bot has configured live API integrations (Google Sheets, REST endpoint) → call them. Inject results as context.

**Step 8: Booking State Check** — If booking enabled and intent = book_session, or active booking state → route to booking state machine.

**Step 9: Build System Prompt** — Assemble final prompt: personality + guardrails + FAQ context + RAG context + live data + conversation history + response format instructions.

**Step 10: LLM + Stream** — Claude Haiku streaming. Detect sentiment post-response. Log pipeline debug data.

---

## 10. ADMIN DASHBOARD — PAGE MAP V2

### Super Admin Routes
```
/dashboard/admin/users          — User/tenant management
/dashboard/admin/tenants        — All tenants overview  
/dashboard/admin/bots           — All bots health monitor (status, last active, error rate)
/dashboard/admin/billing        — Usage per tenant (messages, bots, contacts)
/dashboard/admin/invites        — Send new tenant invite
```

### Tenant Admin — Overview
```
/dashboard/overview             — NEW: Revamped dashboard (KPIs, quick actions, live feed)
```

### Tenant Admin — Bot Detail (per /dashboard/bots/[botId])
```
/overview                       — Bot stats: status, messages today, active contacts
/conversations                  — NEW: Full conversation log with pipeline debug
/contacts                       — NEW: CRM contacts table + Kanban
/broadcasts                     — NEW: Campaign manager
/followups                      — NEW: Follow-up rules
/scripts                        — NEW: Flow builder canvas
/channels                       — NEW: Channel config (WhatsApp, Telegram, Widget)
/widget                         — NEW: Widget configurator + embed code
/knowledge                      — Documents + products + URL ingestion
/faqs                           — FAQ management
/personality                    — Personality + system prompt studio
/guardrails                     — Guardrails config
/templates                      — Response templates
/booking                        — Booking config + calendar (feature-flagged)
/testing                        — Testing console
/api-keys                       — API key management
/integrations                   — Integration snippets + webhook URLs
/settings                       — Bot settings (name, timezone, feature flags)
```

### Public Routes
```
/chat/[botId]                   — NEW: Public chat web interface (shareable URL)
/onboarding/[step]              — NEW: Onboarding wizard for new tenants
/invite/[token]                 — NEW: Invite acceptance + signup
```

---

## 11. CHANNEL ENGINE (REPLACING n8n)

### WhatsApp Cloud API Integration

```typescript
// lib/channels/whatsapp.ts

// Webhook verification (GET)
export function verifyWhatsAppWebhook(
  mode: string,
  token: string,
  challenge: string,
  verifyToken: string
): string | null

// Inbound message handler (POST)
export async function handleWhatsAppWebhook(
  payload: WhatsAppWebhookPayload,
  botId: string
): Promise<void>

// Outbound message sender
export async function sendWhatsAppMessage(
  to: string,
  message: string | WhatsAppTemplateMessage,
  accessToken: string,
  phoneNumberId: string
): Promise<boolean>

// Types
interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account'
  entry: WhatsAppEntry[]
}
```

### Telegram Bot API Integration

```typescript
// lib/channels/telegram.ts

// Webhook handler
export async function handleTelegramUpdate(
  update: TelegramUpdate,
  botId: string
): Promise<void>

// Outbound sender
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  botToken: string
): Promise<boolean>
```

### Web Widget

```typescript
// app/api/widget/[botId]/route.ts
// POST: accepts message from widget, returns streaming response
// No API key required — uses botId + allowed domains check
// CORS: allowed_domains from widget_configs table

// public/widget.js (self-contained, no framework dependencies)
// Injected via <script src="https://app.botbase.ai/widget.js" data-bot-id="xxx"></script>
```

---

## 12. WEB CHAT WIDGET — EMBED SCRIPT

```javascript
// public/widget.js (minified in production)
(function(w, d, s, o, f, js, fjs) {
  w['BotBaseWidget'] = o;
  w[o] = w[o] || function() { (w[o].q = w[o].q || []).push(arguments) };
  js = d.createElement(s); fjs = d.getElementsByTagName(s)[0];
  js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
}(window, document, 'script', 'bb', 'https://app.botbase.ai/widget-bundle.js'));

bb('init', { botId: document.currentScript.getAttribute('data-bot-id') });
```

Widget renders: floating chat bubble → click → chat window with message list, input, quick reply buttons.

---

## 13. CONVERSATION LOG — PIPELINE DEBUG VIEW

This is the Tuah-equivalent debug view. Every conversation expandable to show:

**Response Tab:**
- User message
- Bot response (formatted, with markdown)
- Guardrail badge / template used badge

**Pipeline Tab:**
- Step 1: History Context [status] [Xms]
- Step 2: Guardrails [pass/block] [Xms]
- Step 3: Intent: browse_product | Language: en [Xms]
- Step 4: Script: [name or "none"] [Xms]
- Step 5: FAQ Match: [score or "none"] [Xms]
- Step 6: RAG: [X chunks, top score Y] [Xms]
- Step 7: Live API: [skipped or result] [Xms]
- Step 8: Booking State: [step or "none"] [Xms]
- Step 9: Prompt: [token count] [Xms]
- Step 10: LLM: [model, tokens in/out] [Xms]

**Contact Tab:**
- Contact info (name, phone, language, lead stage)
- Link to contact profile

---

## 14. FLOW BUILDER — NODE SPEC

```typescript
// components/flow-builder/NodeTypes/types.ts

type NodeType =
  | 'message'       // Send a text message
  | 'question'      // Ask a question, capture answer as variable
  | 'condition'     // Branch based on variable value or intent
  | 'ai_response'   // Let AI answer from knowledge base
  | 'api_call'      // HTTP GET/POST to external endpoint
  | 'booking'       // Trigger booking flow for a service
  | 'lead_capture'  // Save contact details (name, phone, email)
  | 'delay'         // Wait X minutes/hours before next step
  | 'handoff'       // Transfer to live agent
  | 'jump'          // Jump to another node

interface MessageNodeData {
  message: string   // Supports {{variable}} interpolation
  media_url?: string
}

interface QuestionNodeData {
  question: string
  variable_name: string  // stored in conversation context
  input_type: 'text' | 'number' | 'date' | 'choice'
  choices?: string[]
}

interface ConditionNodeData {
  variable: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than'
  value: string
  // Two output handles: true / false
}

interface AIResponseNodeData {
  instructions?: string  // Additional instructions for AI at this step
  allow_fallback: boolean
}

interface APICallNodeData {
  url: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  save_response_as?: string
}

interface BookingNodeData {
  service_id?: string  // Pre-select service or let user choose
}

interface LeadCaptureNodeData {
  fields: Array<{
    name: 'name' | 'phone' | 'email' | 'custom'
    label: string
    required: boolean
  }>
}
```

---

## 15. INDUSTRY SEED TEMPLATES

### Clinic Template (Dr Aiman)
```
Intent types: appointment_booking, general_enquiry, medication_query, test_results, emergency
Scripts: New patient intake → capture name/phone/IC → ask for preferred date → book appointment
FAQs: Clinic hours, services, location, insurance accepted
Guardrails: No diagnosis, no prescription advice, always add medical disclaimer
Booking: Consultation (30min), Follow-up (15min), Health Screening (60min)
```

### Insurance Agency Template
```
Intent types: policy_enquiry, claim_status, premium_calculator, appointment_request, comparison
Scripts: Lead qualification → capture name/phone/age/occupation → send quote → book follow-up call
FAQs: Types of insurance, claim process, payment methods
CRM: Lead stage from "new" → "quoted" → "proposal_sent" → "policy_issued"
Follow-ups: Day 1 (quote sent), Day 3 (follow-up), Day 7 (last chance)
```

### Property Agency Template
```
Intent types: property_enquiry, viewing_request, pricing_query, location_search, developer_info
Scripts: Buyer profiling → budget/location/type → match properties → schedule viewing
FAQs: Financing, legal process, stamp duty, developer track record
CRM: Lead stages: "enquiry" → "viewing_scheduled" → "offer_made" → "spa_signed"
Broadcasts: New launch notifications, price updates, open house invitations
```

---

## 16. ROLES & PERMISSIONS V2

| Action | super_admin | tenant_admin | agent |
|--------|-------------|--------------|-------|
| Manage all tenants | ✅ | ❌ | ❌ |
| Create/delete bots | ✅ | ✅ (own) | ❌ |
| Configure personality/guardrails | ✅ | ✅ | ❌ |
| View conversations | ✅ | ✅ | ✅ (own bot) |
| Take over conversation | ✅ | ✅ | ✅ |
| Manage contacts/CRM | ✅ | ✅ | ✅ |
| Send broadcasts | ✅ | ✅ | ❌ |
| Upload documents | ✅ | ✅ | ❌ |
| View analytics | ✅ | ✅ | ✅ (own) |
| Manage API keys | ✅ | ✅ | ❌ |
| Invite users | ✅ | ✅ (agents) | ❌ |

---

## 17. GOOGLE SSO SETUP (Supabase)

```typescript
// No code change needed in app — Supabase handles OAuth
// Enable in Supabase Dashboard: Authentication → Providers → Google

// lib/supabase/client.ts — add signInWithOAuth helper
export async function signInWithGoogle() {
  const supabase = createClient()
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
}

// Update login page to show Google SSO button
```

---

## 18. TENANT ONBOARDING WIZARD FLOW

```
Step 1: Invite received (/invite/[token])
  → Validate token (not expired, not used)
  → Signup form: name, email, password or Google SSO
  → Create Supabase user → assign tenant_admin role → link to tenant

Step 2: Create/name your bot (/onboarding/create-bot)
  → Bot name, language, industry template selection
  → Select personality preset
  → Creates bot record with feature flags pre-set from template

Step 3: Upload knowledge (/onboarding/upload-docs)
  → Drag-drop PDF/DOCX/TXT or paste website URL
  → Shows ingestion progress
  → Can skip and add later

Step 4: Configure personality (/onboarding/configure)
  → System prompt (pre-filled from template)
  → Greeting messages per language
  → Guardrails (pre-configured from template, editable)

Step 5: Connect channel (/onboarding/connect-channel)
  → Choose: WhatsApp / Telegram / Website Widget
  → WhatsApp: paste phone_number_id, access_token, verify_token
  → Telegram: paste bot_token
  → Widget: shows embed code

Step 6: Test your bot (/onboarding/test)
  → Embedded testing console
  → Confirm bot responds correctly
  → Click "Go Live" → bot is activated

Mark onboarding_progress all steps complete → redirect to /dashboard/overview
```

---

## 19. NEW ENVIRONMENT VARIABLES

```bash
# Existing (keep)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
OPENAI_API_KEY=                    # Whisper transcription
GOOGLE_CLIENT_ID=                  # Google Calendar OAuth
GOOGLE_CLIENT_SECRET=
CRON_SECRET=

# NEW for v2
NEXT_PUBLIC_APP_URL=               # https://app.botbase.ai (for invite URLs, widget src)
RESEND_API_KEY=                    # Email notifications (booking confirmations, invites)
WEBHOOK_VERIFY_SECRET=             # HMAC for validating WhatsApp/Telegram webhooks
```

---

## 20. BUILD PHASES — V2 (1-WEEK SPRINT PLAN)

Given solo build with Claude Code, here's the realistic 7-day execution order:

### Day 1: Foundation & Database
- New migrations 00016–00024 (all new tables)
- Update types/database.ts
- Google SSO setup in Supabase
- Tenant invite system (backend: create invite, accept invite APIs)
- Update vercel.json with new cron paths

### Day 2: Channel Engine
- lib/channels/whatsapp.ts (Meta Cloud API)
- lib/channels/telegram.ts (Telegram Bot API)
- lib/channels/dispatcher.ts (unified outbound)
- app/api/webhook/whatsapp/route.ts
- app/api/webhook/telegram/route.ts
- Channel config UI (/dashboard/bots/[botId]/channels)
- Migrate existing Elken bot to native channel (remove n8n dependency)

### Day 3: Pipeline Refactor + Conversation Log
- lib/pipeline/* (extract 10 steps, add debug logging per step)
- Refactor app/api/chat/[botId] to use new pipeline
- Enhanced conversation log page with pipeline debug tab
- Sentiment analyzer integration
- Realtime updates for conversation log (Supabase Realtime)

### Day 4: CRM + Contacts
- lib/crm/* (contacts, lead-score, import-export)
- Auto-create/update contact on every message
- app/api/contacts/[botId]/* CRUD
- /dashboard/bots/[botId]/contacts page (table + Kanban)
- Contact profile page with conversation + booking history

### Day 5: Broadcasts + Follow-ups + Drip
- lib/broadcast/* (sender, scheduler, analytics)
- app/api/broadcasts/[botId]/* CRUD
- Broadcast campaign UI
- lib/followup/* (rules + queue)
- All cron jobs (app/api/cron/*)
- Follow-up rules UI

### Day 6: Flow Builder + Script Engine
- Install reactflow
- Flow builder canvas + all node types
- lib/scripts/executor.ts (runs flow graph)
- app/api/scripts/[botId]/* CRUD
- /dashboard/bots/[botId]/scripts page
- Industry seed templates (clinic, insurance, property)

### Day 7: Web Widget + Onboarding Wizard + Polish
- Web chat widget (components/chat-widget/*)
- public/widget.js (self-contained embed script)
- app/api/widget/[botId] endpoint
- /chat/[botId] public chat page
- Onboarding wizard (/onboarding/*)
- Live agent handoff (AgentTakeover component + Realtime)
- Tenant invite flow (/invite/[token])
- Super admin platform overview enhancements
- Smoke tests for all new endpoints

---

## 21. KEY TECHNICAL DECISIONS

| Decision | Rationale |
|----------|-----------|
| Keep n8n snippets page BUT also add native channel | Backward compat for existing clients; new clients use native |
| ReactFlow for flow builder | Battle-tested, MIT, embeddable, extensive node customization |
| Supabase Realtime (not Socket.io) | Already in stack, no new infra for live agent view |
| Resend for emails | Best DX for transactional email from Next.js, generous free tier |
| Pipeline extracted to lib/pipeline/ | Makes debug logging clean; each step testable independently |
| Contact auto-upsert on every message | CRM is a side effect of chat, not a separate flow — no friction |
| Script executor as pure function | Takes flow_data + context → returns next message; fully testable |
| Widget as standalone JS (no framework) | Must work on any website without React/Next dependency |
| Tenant invite via signed token | Secure, time-limited, no manual DB work for super admin |

---

## 22. PITFALLS TO AVOID (FROM V1 EXPERIENCE)

1. **Bot_id scoping**: Every new table MUST have bot_id with RLS policy. No exceptions.
2. **Match threshold**: Store in bots config table. Never hardcode. Learned from Elken 0.3 fix.
3. **Guardrails override**: The mandatory_disclaimer field can block entire query categories. Keep it nullable.
4. **Channel dispatch fire-and-forget**: Never await outbound message send in the pipeline — return response first.
5. **Booking state machine before intent detection**: Active booking answers will be misclassified. Check booking state FIRST.
6. **Service role key**: Never use in chat/webhook routes. Only in admin/cron operations.
7. **voyageai ESM patch**: Postinstall patch script must remain.
8. **Next.js params**: Always `await params` before use in App Router route handlers.
9. **Vercel timeout**: maxDuration = 60 for ingest routes. Widget endpoint must return fast (< 3s).
10. **Multi-tenant data leak**: Write integration test with 2 tenants asserting zero cross-contamination after any DB change.

---

## 23. API ENDPOINTS — V2 COMPLETE MAP

```
# Chat (existing, keep)
POST /api/chat/[botId]

# NEW: Native webhooks
GET  /api/webhook/whatsapp?hub.mode=&hub.verify_token=&hub.challenge=
POST /api/webhook/whatsapp
POST /api/webhook/telegram
GET  /api/webhook/telegram/setup     # Register webhook URL with Telegram

# Web Widget
GET  /api/widget/[botId]/config      # Widget config (colors, welcome msg)
POST /api/widget/[botId]/chat        # Widget chat endpoint (no API key, domain check)

# Contacts
GET  /api/contacts/[botId]           # List contacts (filter, search, paginate)
POST /api/contacts/[botId]           # Create contact
GET  /api/contacts/[botId]/[id]      # Get contact + full history
PUT  /api/contacts/[botId]/[id]      # Update contact
DELETE /api/contacts/[botId]/[id]    # Delete contact
POST /api/contacts/[botId]/import    # CSV import
GET  /api/contacts/[botId]/export    # CSV export

# Scripts / Flow Builder
GET  /api/scripts/[botId]            # List scripts
POST /api/scripts/[botId]            # Create script
GET  /api/scripts/[botId]/[id]       # Get script with flow_data
PUT  /api/scripts/[botId]/[id]       # Update flow
POST /api/scripts/[botId]/[id]/publish  # Publish version
GET  /api/scripts/[botId]/templates  # Get industry templates

# Broadcasts
GET  /api/broadcasts/[botId]
POST /api/broadcasts/[botId]
GET  /api/broadcasts/[botId]/[id]
PUT  /api/broadcasts/[botId]/[id]
POST /api/broadcasts/[botId]/[id]/send   # Trigger immediate send
POST /api/broadcasts/[botId]/[id]/schedule

# Follow-ups
GET  /api/followups/[botId]
POST /api/followups/[botId]
PUT  /api/followups/[botId]/[id]
DELETE /api/followups/[botId]/[id]

# Cron (secured by CRON_SECRET)
GET  /api/cron/reminders
GET  /api/cron/followups
GET  /api/cron/drip
GET  /api/cron/broadcasts
GET  /api/cron/lead-scores

# Onboarding
POST /api/onboarding/invite          # Create invite (super admin only)
GET  /api/onboarding/invite/[token]  # Validate token
POST /api/onboarding/invite/[token]/accept  # Accept + create account
PUT  /api/onboarding/progress        # Update onboarding progress
```

---

## 24. UI DESIGN SYSTEM

**Brand:** BotBase by Iceberg AI Solutions
**Theme:** Dark-first, professional, clean — inspired by Tuah/VisitMelaka admin but darker and more modern
**Primary Color:** `#6366f1` (Indigo)
**Secondary Color:** `#22d3ee` (Cyan accent)
**Background:** `#0a0a0a` / `#111111`
**Surface:** `#1a1a1a` / `#242424`
**Text:** `#f5f5f5` primary, `#a3a3a3` muted
**Success:** `#22c55e`
**Warning:** `#f59e0b`
**Danger:** `#ef4444`
**Font:** Geist (existing) for UI, JetBrains Mono for code/debug
**Border Radius:** 8px components, 12px cards
**Shadows:** Subtle dark shadows, no heavy drop shadows

**Key UI Patterns:**
- Status badges: colored pills (active/inactive/error/pending)
- Pipeline step rows: icon + name + status + timing badge
- Conversation thread: alternating user/bot bubbles with metadata on hover
- Flow canvas: dark canvas with colored node types
- Analytics charts: indigo/cyan color scheme on dark backgrounds

---

## 25. CLAUDE CODE INSTRUCTIONS

When building with Claude Code, provide this SPEC.md and say:

```
"Read BOTBASE_V2_SPEC.md completely. Then build [specific phase] following 
the exact file structure in Section 7, using the database schema in Section 5, 
and following the conventions from the v1 codebase patterns documented in the spec.

Key constraints from v1 (must follow):
- await params in all App Router route handlers
- Service role client only in API routes / cron, never in client components
- voyageai ESM patch script must not be removed
- All tables need bot_id scoping with RLS
- Booking state check BEFORE intent detection

Start with: [migrations / specific API / specific dashboard page]"
```

**Phase-by-phase commands for Claude Code:**

```bash
# Phase 1: Database
"Read BOTBASE_V2_SPEC.md Section 5. Create all migration files 00016-00024 in supabase/migrations/. 
Update types/database.ts to include all new table types."

# Phase 2: Channels  
"Read BOTBASE_V2_SPEC.md Section 11. Build lib/channels/whatsapp.ts, lib/channels/telegram.ts, 
lib/channels/dispatcher.ts. Then build app/api/webhook/whatsapp/route.ts and 
app/api/webhook/telegram/route.ts. Then build the channel config UI page."

# Phase 3: Pipeline
"Read BOTBASE_V2_SPEC.md Sections 9 and 13. Extract the existing RAG pipeline into lib/pipeline/ 
with 10 named steps. Each step must return a StepResult. Refactor app/api/chat/[botId]/route.ts 
to use the new pipeline. Build the conversation log page with the pipeline debug tab."

# Phase 4: CRM
"Read BOTBASE_V2_SPEC.md Section 3.4. Build lib/crm/contacts.ts with auto-upsert-on-message logic. 
Build all contact API routes. Build the contacts dashboard page with table and Kanban view."

# Phase 5: Broadcasts + Follow-ups
"Read BOTBASE_V2_SPEC.md Sections 3.5, 3.6, and 8 (vercel.json). Build broadcast campaigns system 
and follow-up rules system. Build all cron endpoints."

# Phase 6: Flow Builder
"Read BOTBASE_V2_SPEC.md Section 14. Install reactflow. Build the flow builder canvas with all 9 
node types. Build lib/scripts/executor.ts. Build the scripts dashboard page."

# Phase 7: Widget + Onboarding
"Read BOTBASE_V2_SPEC.md Sections 12 and 18. Build the embeddable web chat widget and public/widget.js. 
Build the onboarding wizard. Build the tenant invite flow. Build live agent handoff."
```

---

## 26. SUCCESS METRICS FOR V2 LAUNCH

| Metric | Target |
|--------|--------|
| Time from invite to live bot | < 15 minutes |
| Message pipeline latency (p50) | < 1.5s |
| Message pipeline latency (p95) | < 3s |
| Webhook uptime | > 99.5% |
| RAG retrieval accuracy (human eval) | > 85% |
| Booking completion rate | > 70% |
| Onboarding wizard completion | > 80% |
| Test coverage (lib/) | > 60% |

---

*BotBase v2 Specification — Iceberg AI Solutions*
*Built for the world. Starting from Malaysia.*
