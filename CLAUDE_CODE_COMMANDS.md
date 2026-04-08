# BotBase v2 — Claude Code Daily Command Guide

Use these exact prompts in Claude Code (terminal) each day.
Always start a new session with: "Read CLAUDE.md and BOTBASE_V2_SPEC.md first."

---

## PRE-BUILD SETUP (Do this first)

```bash
# 1. Copy CLAUDE.md to repo root
cp CLAUDE.md ~/path/to/botbase-v2/

# 2. Copy BOTBASE_V2_SPEC.md to repo root  
cp BOTBASE_V2_SPEC.md ~/path/to/botbase-v2/

# 3. Copy V2_MIGRATIONS.sql to supabase/migrations/
# Run each migration in Supabase SQL Editor manually

# 4. Install new dependencies
npm install reactflow @xyflow/react resend zod react-hook-form @hookform/resolvers @tanstack/react-table cheerio sharp xlsx

# 5. Update vercel.json with new cron jobs (see V2_DEPENDENCIES.md)
# 6. Add new env vars to .env.local and Vercel dashboard
```

---

## DAY 1 — Database + Auth

```
Read CLAUDE.md and BOTBASE_V2_SPEC.md completely.

Then do the following:

1. Confirm all migrations 00016-00024 have been run (check Supabase tables exist: 
   channel_configs, contacts, bot_scripts, broadcast_campaigns, agent_sessions, 
   followup_rules, widget_configs, tenant_invites, onboarding_progress).

2. Update types/database.ts to add TypeScript interfaces for ALL new v2 tables.
   Add: ChannelConfig, Contact, BotScript, BotScriptVersion, BroadcastCampaign, 
   BroadcastRecipient, DripSequence, AgentProfile, AgentSession, FollowupRule, 
   FollowupQueue, WidgetConfig, TenantInvite, OnboardingProgress.

3. Update the profiles role type to include 'agent' (was: super_admin | tenant_admin).

4. Add Google SSO button to app/(auth)/login/page.tsx using signInWithGoogle() from 
   lib/supabase/client.ts. The function should call supabase.auth.signInWithOAuth 
   with provider 'google' and redirectTo pointing to /auth/callback.

5. Create app/(auth)/invite/[token]/page.tsx — the invite acceptance page.
   It should: validate the token via GET /api/onboarding/invite/[token], show 
   name + signup form, on submit call POST /api/onboarding/invite/[token]/accept,
   then redirect to /onboarding/create-bot.

6. Create app/api/onboarding/invite/route.ts — POST to create a new invite 
   (super_admin only). Accepts: {email, tenantId?, botId?, role}.

7. Create app/api/onboarding/invite/[token]/route.ts — GET to validate token 
   (check not expired, not used), POST to accept (create user, assign role/tenant).

Follow all patterns from CLAUDE.md. Use service role client for all API routes.
```

---

## DAY 2 — Channel Engine (Native WhatsApp + Telegram)

```
Read CLAUDE.md. We are building the native channel engine to replace n8n.

1. Create lib/channels/whatsapp.ts with:
   - verifyWebhook(mode, token, challenge, verifyToken): string | null
   - handleInboundMessage(payload, botId): Promise<void>
     → Extract sender phone, message text, message_id from WhatsApp webhook payload
     → Call the existing chat pipeline (POST /api/chat/[botId] internally or call 
       the pipeline function directly)
     → Send response via sendWhatsAppMessage()
   - sendWhatsAppMessage(to, message, accessToken, phoneNumberId): Promise<boolean>
     → POST to https://graph.facebook.com/v19.0/{phoneNumberId}/messages
   - Types: WhatsAppWebhookPayload, WhatsAppMessage, WhatsAppTextBody

2. Create lib/channels/telegram.ts with:
   - handleUpdate(update, botId): Promise<void>
     → Extract chat_id, text from Telegram Update
     → Call chat pipeline
     → Send via sendMessage()
   - sendMessage(chatId, text, botToken): Promise<boolean>
     → POST to https://api.telegram.org/bot{token}/sendMessage
   - setupWebhook(botToken, webhookUrl): Promise<boolean>
   - Types: TelegramUpdate, TelegramMessage

3. Create lib/channels/dispatcher.ts — unified outbound sender:
   - sendMessage(contactId, message, botId): Promise<boolean>
   → Looks up contact channel from contacts table
   → Routes to whatsapp.sendMessage or telegram.sendMessage based on channel
   → Gets credentials from channel_configs table for the bot

4. Create app/api/webhook/whatsapp/route.ts:
   - GET handler: verify webhook using WEBHOOK_VERIFY_SECRET from channel_configs
   - POST handler: validate signature, call handleInboundMessage()
   - Use createServiceClient() — webhook is not authenticated by session

5. Create app/api/webhook/telegram/route.ts:
   - POST handler only: call handleUpdate()

6. Create app/api/webhook/telegram/setup/route.ts:
   - POST handler: call setupWebhook() to register URL with Telegram

7. Create dashboard page: app/dashboard/bots/[botId]/channels/page.tsx
   - Show all 5 channel types as cards (WhatsApp, Telegram, Web Widget, Instagram, FB)
   - Each card: toggle (active/inactive), configure button
   - WhatsApp config form: phone_number_id, access_token, verify_token, waba_id
   - Telegram config form: bot_token, bot_username
   - Web Widget: show embed code (configured on widget page)
   - Save to channel_configs table via /api/config/[botId]/channels

8. Create app/api/config/[botId]/channels/route.ts:
   - GET: return channel_configs for this bot
   - POST/PUT: upsert channel config (encrypt sensitive tokens before storing)

All sensitive tokens (access_token, bot_token) must be stored encrypted in the 
config JSONB. Use a simple AES-256 encryption with a server-side key from env.
Never return raw tokens to the client — return masked versions (last 4 chars only).
```

---

## DAY 3 — Pipeline Refactor + Conversation Log

```
Read CLAUDE.md and BOTBASE_V2_SPEC.md Section 9 and 13.

We are extracting the existing RAG pipeline into a clean 10-step pipeline 
with full debug logging per step. This is the most important architectural change.

1. Create lib/pipeline/types.ts:
   - PipelineContext interface (botId, conversationId, contactId, message, userId, channel, bot, startedAt)
   - StepResult interface (step, name, status: 'pass'|'block'|'skip'|'error', durationMs, data)
   - PipelineResult interface (response, steps, intent, language, ragFound, guardRailTriggered, templateUsed, totalDurationMs)

2. Create lib/pipeline/index.ts — the main orchestrator:
   - runPipeline(context: PipelineContext): Promise<PipelineResult>
   - Runs all 10 steps in sequence
   - Each step is called with context, returns StepResult
   - If a step returns status='block', pipeline stops and returns that response
   - Collects timing for each step
   - Returns full PipelineResult with all step debug data

3. Create each step file lib/pipeline/step-{1-10}-*.ts:
   - step-1-history.ts: fetch last 10 messages from conversations table
   - step-2-guardrails.ts: check against bot guardrails config, blocked keywords
   - step-3-detect.ts: intent + language detection via Claude Haiku
   - step-4-scripts.ts: check for matching active bot scripts
   - step-5-faqs.ts: FAQ semantic search
   - step-6-rag.ts: chunk + product semantic search  
   - step-7-live-api.ts: call configured external APIs (skip if none configured)
   - step-8-booking.ts: booking state machine check
   - step-9-prompt.ts: assemble full system prompt
   - step-10-llm.ts: Claude streaming response

4. Refactor app/api/chat/[botId]/route.ts to call runPipeline() instead of 
   inline pipeline code. Keep the same request/response interface.
   Store pipeline debug data in messages.pipeline_debug JSONB after response.

5. Detect sentiment after Step 10: analyze the user's message for sentiment 
   (positive/neutral/negative/frustrated) using a quick Claude Haiku call.
   Store in messages.sentiment column.

6. Create the conversation log dashboard page:
   app/dashboard/bots/[botId]/conversations/page.tsx
   
   Layout: Left panel = conversation list, Right panel = conversation detail
   
   Conversation list:
   - Shows last 50 conversations (paginated)
   - Each row: first message, date, language badge, sentiment icon, 
     guardrail badge (orange), channel badge
   - Search box (full-text across message content)
   - Filters: date range, language, channel, has_guardrail, sentiment
   
   Conversation detail (click a conversation):
   - Header: contact name/phone, session ID, channel, language
   - Message thread: alternating user (gray) / bot (indigo) bubbles
   - Each bot message has TWO tabs:
     * "Response" tab: shows the formatted bot reply
     * "Pipeline" tab: shows all 10 steps with status icons and timing
   - Pipeline step row: [icon] Step N: {name} [{status badge}] [{Xms}]
   - Click step to expand: shows step.data (intent, chunks found, prompt length, etc.)
   - Contact info sidebar: name, phone, lead_stage, last_message_at

7. Create app/api/conversations/[botId]/route.ts:
   - GET: list conversations with filters, pagination
   - Each conversation includes: first message, last message, message count, 
     contact info, guardrail_hit bool

8. Create app/api/conversations/[botId]/[conversationId]/route.ts:
   - GET: full conversation with all messages and pipeline_debug data
```

---

## DAY 4 — CRM + Contacts

```
Read CLAUDE.md. Build the CRM contacts system.

1. Update app/api/chat/[botId]/route.ts (or the pipeline step-1):
   - After message is received, upsert contact:
     * Look up contacts by (bot_id, external_id, channel)  
     * If not found: create new contact
     * If found: update last_message_at, increment total_messages
     * Store contact_id on the conversation record
   
2. Create lib/crm/contacts.ts:
   - upsertContact(botId, externalId, channel, data): Promise<Contact>
   - updateLeadStage(contactId, stage): Promise<void>
   - getContact(botId, contactId): Promise<Contact>
   - searchContacts(botId, query, filters): Promise<Contact[]>
   - importContacts(botId, csv): Promise<{imported: number, errors: string[]}>
   - exportContacts(botId, filters): Promise<string> (CSV string)
   
3. Create lib/crm/lead-score.ts:
   - calculateLeadScore(contact: Contact, messages: Message[]): number
   - Score factors: total messages (+1 each), booking made (+20), 
     reply to broadcast (+10), asked about pricing (+15), no reply in 7d (-10)
   
4. Create all contact API routes:
   - GET  /api/contacts/[botId] — list with filter/search/paginate
   - POST /api/contacts/[botId] — create manually
   - GET  /api/contacts/[botId]/[id] — get with full history
   - PUT  /api/contacts/[botId]/[id] — update (name, tags, stage, notes)
   - DELETE /api/contacts/[botId]/[id]
   - POST /api/contacts/[botId]/import — multipart CSV
   - GET  /api/contacts/[botId]/export — returns CSV

5. Create contacts dashboard page:
   app/dashboard/bots/[botId]/contacts/page.tsx
   
   Two views (tab toggle):
   
   TABLE VIEW (@tanstack/react-table):
   - Columns: Name, Phone, Language, Channel, Lead Stage badge, Lead Score bar, 
     Last Message, Tags, Actions
   - Row click → opens contact profile sheet/drawer
   - Bulk actions: export selected, change stage, add tag, delete
   - Search box, filter by stage/language/channel/tag
   - Import CSV button (drag-drop), Export CSV button
   
   KANBAN VIEW:
   - 6 columns: new | engaged | qualified | booked | converted | churned
   - Each card: name, phone, last message preview, tags
   - Drag to move between stages (updates lead_stage)

6. Create contact profile page (drawer/sheet):
   - Contact info (editable: name, phone, email, notes, tags)
   - Lead stage selector
   - Assigned agent
   - Custom fields
   - Recent conversations (last 5, linked to conversations page)
   - Booking history
   - Add note button
```

---

## DAY 5 — Broadcasts + Follow-ups + Cron

```
Read CLAUDE.md and BOTBASE_V2_SPEC.md Sections 3.5 and 3.6.

1. Create lib/broadcast/sender.ts:
   - sendBroadcast(campaignId): Promise<void>
     → Resolve audience from contact filters
     → Create broadcast_recipients records
     → Send to each via lib/channels/dispatcher.ts
     → Update campaign stats
   - resolveCampaignAudience(botId, filter): Promise<Contact[]>
     → Filter by tags, lead_stage, language, last_active_days

2. Create broadcast API routes and dashboard page:
   - Full CRUD for broadcast campaigns
   - Campaign composer UI: message body, media URL (optional), quick reply buttons
   - Audience selector: filter UI showing estimated reach count
   - Schedule picker (react-day-picker)
   - Stats view for sent campaigns: delivered/read/replied bars

3. Create followup rules API routes and UI:
   - Rules: name, trigger_condition, trigger_hours, message_template, max_attempts
   - Example triggers: "no_reply_24h", "no_booking_after_enquiry", "post_booking_3d"

4. Create all cron endpoints (each protected by CRON_SECRET header):
   
   app/api/cron/reminders/route.ts (existing logic — migrate from notifications/dispatch):
   - Query bookings with session_start in 23-25h window
   - Send reminder via dispatcher

   app/api/cron/followups/route.ts (NEW):
   - Query followup_queue WHERE status='pending' AND next_attempt_at <= NOW()
   - Send each via dispatcher
   - Increment attempt_count
   - If attempt_count >= max_attempts → set status='completed'

   app/api/cron/drip/route.ts (NEW):
   - Check drip_sequences for active sequences
   - Find contacts that match trigger conditions
   - Send next step message based on enrollment date

   app/api/cron/broadcasts/route.ts (NEW):
   - Query broadcast_campaigns WHERE status='scheduled' AND scheduled_at <= NOW()
   - Call sendBroadcast() for each

   app/api/cron/lead-scores/route.ts (NEW):
   - For each bot, recalculate lead scores for contacts active in last 30 days
   - Update contacts.lead_score

5. Create followup rules dashboard page:
   app/dashboard/bots/[botId]/followups/page.tsx
   - List of rules with toggle (active/inactive)
   - Create/edit rule drawer
   - Show queue size for each rule (pending followups count)
```

---

## DAY 6 — Flow Builder + Script Engine

```
Read CLAUDE.md and BOTBASE_V2_SPEC.md Section 14.

1. Install ReactFlow: npm install @xyflow/react

2. Create the flow builder canvas:
   components/flow-builder/FlowCanvas.tsx
   - Use ReactFlow with custom node types
   - Dark theme canvas (#111 background, indigo edges)
   - Left panel: draggable node type list (NodePanel.tsx)
   - Top bar: script name, save/publish/preview buttons
   - Bottom: version history dropdown

3. Create all node components in components/flow-builder/NodeTypes/:
   Each node: colored border, icon, label, editable content on click
   - MessageNode: orange. Content: text editor with {{variable}} highlighting
   - QuestionNode: blue. Content: question text, variable name, input type
   - ConditionNode: yellow. Content: variable, operator, value. TWO output handles (true/false)
   - AIResponseNode: indigo/purple. Content: optional extra instructions toggle
   - APICallNode: green. Content: URL, method, body, save-as variable
   - BookingNode: teal. Content: optional service pre-select
   - LeadCaptureNode: pink. Content: field checklist (name/phone/email/custom)
   - DelayNode: gray. Content: hours/days number picker
   - HandoffNode: red. Content: note for agent

4. Create lib/scripts/executor.ts:
   - executeScript(flowData, context, message): Promise<{response: string, nextStep: string | null, capturedData: Record<string, string>}>
   - context includes: current_node_id, variables (captured data), conversation history
   - For MessageNode: return the message with {{variable}} replaced
   - For QuestionNode: return the question, wait for next message to capture answer
   - For ConditionNode: evaluate condition against variables, return next node id
   - For AIResponseNode: call the RAG pipeline and return AI response
   - State: store current_node_id in conversations.metadata.script_state

5. Create script API routes:
   GET/POST /api/scripts/[botId]
   GET/PUT/DELETE /api/scripts/[botId]/[id]
   POST /api/scripts/[botId]/[id]/publish
   GET /api/scripts/[botId]/templates (return 3 industry templates)

6. Create scripts dashboard page:
   app/dashboard/bots/[botId]/scripts/page.tsx
   - List view: script name, trigger, status, last published date
   - "New Script" button → opens blank canvas
   - "From Template" button → shows template picker (Clinic/Insurance/Property/F&B)
   - Each script row: Edit (opens canvas), Toggle active, Duplicate, Delete

7. Seed 3 industry script templates in lib/scripts/templates/:
   - clinic-intake.ts (patient intake flow)
   - insurance-lead.ts (lead qualification + quote flow)
   - property-enquiry.ts (buyer profiling + viewing booking)
```

---

## DAY 7 — Web Widget + Onboarding Wizard + Live Agent + Polish

```
Read CLAUDE.md and BOTBASE_V2_SPEC.md Sections 12 and 18.

1. Create the web chat widget endpoint:
   app/api/widget/[botId]/chat/route.ts
   - POST: accepts {message, sessionId, userId?}
   - No API key required — uses botId + Origin header domain check against widget_configs.allowed_domains
   - Returns streaming response same as chat endpoint
   - Create/update contact with channel='web_widget'

   app/api/widget/[botId]/config/route.ts
   - GET: returns widget_configs row for this bot (public, no auth)
   - Returns: colors, welcome_message, quick_replies, show_branding only (no secrets)

2. Create web chat widget components (standalone, no dashboard styling):
   components/chat-widget/
   - ChatBubble.tsx: floating chat button (bottom-right or bottom-left per config)
   - ChatWindow.tsx: the popup chat UI
   - MessageList.tsx: message bubbles list
   - QuickReplies.tsx: quick reply buttons below input
   
   These should look POLISHED and production-grade.
   Use CSS variables for theming (injected from widget config).

3. Create public/widget-loader.js (self-contained, no imports):
   - The script that tenant embeds: <script src="..." data-bot-id="xxx"></script>
   - On load: fetches /api/widget/[botId]/config, renders the chat bubble
   - On click: renders chat window, starts conversation
   - Persists session in sessionStorage
   - Should work on any website (vanilla JS only, no React)

4. Create the public chat page:
   app/chat/[botId]/page.tsx
   - Full-page chat interface (for sharing as link, like Tuah's /PublicChat)
   - Uses the same ChatWindow component
   - Show bot name, avatar, online status in header
   - Language toggle (EN/BM/ZH)

5. Create the onboarding wizard:
   app/onboarding/layout.tsx — wrapper with progress steps indicator
   app/onboarding/create-bot/page.tsx
   app/onboarding/upload-docs/page.tsx
   app/onboarding/configure/page.tsx
   app/onboarding/connect-channel/page.tsx
   app/onboarding/test/page.tsx
   
   - Each step saves progress via PUT /api/onboarding/progress
   - Skip buttons where appropriate
   - "Go Live" button on final step activates the bot

6. Create live agent handoff:
   In app/dashboard/bots/[botId]/conversations/page.tsx:
   - Add "Take Over" button per conversation (shows when bot is responding)
   - On click: creates agent_session record, pauses bot (sets is_active=TRUE on agent_session)
   - Agent can type reply in the conversation view → sends via dispatcher
   - "Release" button ends the session (sets is_active=FALSE)
   - Bot resumes after session ends
   - Use Supabase Realtime to show new messages live in the conversation view

7. Widget configurator dashboard page:
   app/dashboard/bots/[botId]/widget/page.tsx
   - Color pickers for primary/secondary
   - Font selector (Inter/Poppins/Nunito/Roboto)
   - Bubble style: Rounded/Sharp/Pill
   - Position: Bottom-right/Bottom-left
   - Quick replies editor (add/remove)
   - Allowed domains input
   - LIVE PREVIEW: side-by-side preview of the widget with real-time config changes
   - Embed code tab: shows the <script> tag to copy
   - Show branding toggle

8. Polish checklist:
   - Update dashboard sidebar to include all new pages (conversations, contacts, 
     broadcasts, followups, scripts, channels, widget)
   - Update /dashboard/overview with new KPI cards (contacts, broadcasts sent, 
     active scripts, follow-up queue size)
   - Update super admin /dashboard/admin/bots with bot health monitor 
     (last active, message volume, error rate, channel status)
   - Run smoke tests on all new endpoints
   - Add loading states to all new async pages
   - Ensure all new tables have proper RLS policies (check against patterns in CLAUDE.md)
```

---

## TESTING COMMANDS

```bash
# After each phase, run:
npm run test
npm run lint
npm run build

# Smoke test the chat endpoint:
curl -X POST https://your-app.vercel.app/api/chat/[botId] \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","userId":"test-123","channel":"web"}'

# Test WhatsApp webhook verification:
curl "https://your-app.vercel.app/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"

# Test widget config:
curl https://your-app.vercel.app/api/widget/[botId]/config
```

---

## DONE WHEN:

- [ ] All 9 migrations applied, tables exist in Supabase
- [ ] Google SSO button on login page
- [ ] WhatsApp native webhook receiving messages (no more n8n for Elken test)
- [ ] Telegram native webhook working
- [ ] 10-step pipeline with pipeline_debug stored per message
- [ ] Conversation log with pipeline debug view
- [ ] Contacts auto-created from every message
- [ ] Contacts table + Kanban in dashboard
- [ ] Broadcast campaign created and sent to 1 test contact
- [ ] Follow-up rule created and triggered
- [ ] All 5 cron endpoints working
- [ ] Flow builder canvas opens, can drag nodes, save script
- [ ] Script executor runs a simple 3-node flow (greeting → question → AI response)
- [ ] Web widget loads on a test HTML page
- [ ] Public chat page accessible at /chat/[botId]
- [ ] Onboarding wizard completes all 5 steps
- [ ] Live agent takeover works in conversation log
- [ ] All npm run test passing
- [ ] Vercel build: npm run build passing
```
