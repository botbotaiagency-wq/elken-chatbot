export type UserRole = 'super_admin' | 'tenant_admin' | 'agent'

export interface Tenant {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Bot {
  id: string
  tenant_id: string
  name: string
  api_key_hash: string | null
  feature_flags: Record<string, boolean>
  created_at: string
}

export interface Profile {
  id: string
  tenant_id: string | null
  role: UserRole
  full_name: string | null
  created_at: string
}

export interface Chunk {
  id: string
  bot_id: string
  document_id: string
  content: string
  embedding: number[] | null
  created_at: string
}

export type DocumentCategory = 'Beauty' | 'FMCG' | 'GenQi' | 'Healthfood' | 'Home Appliances' | 'Other'

export interface Document {
  id: string
  bot_id: string
  filename: string
  category: DocumentCategory
  subcategory: string | null
  status: 'pending' | 'processing' | 'ready' | 'failed'
  chunk_count: number
  storage_path: string | null
  error_message: string | null
  created_at: string
}

export interface Product {
  id: string
  bot_id: string
  name: string
  description: string | null
  key_ingredients: string | null
  health_benefits: string | null
  pricing: string | null
  suggested_usage: string | null
  category: 'Beauty' | 'FMCG' | 'GenQi' | 'Healthfood' | 'Home Appliances' | 'Other'
  embedding: number[] | null
  created_at: string
}

export interface Conversation {
  id: string
  bot_id: string
  user_id: string
  channel: 'whatsapp' | 'telegram' | 'web'
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type Intent = 'browse_product' | 'health_issue' | 'book_session' | 'faq' | 'general'
export type Language = 'en' | 'bm' | 'zh'

export interface Message {
  id: string
  conversation_id: string
  bot_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  intent: Intent | null
  source_chunks: { chunk_id: string; similarity: number }[] | null
  rag_found: boolean | null
  latency_ms: number | null
  created_at: string
}

export interface FAQ {
  id: string
  bot_id: string
  question: string
  answer: string
  language: Language
  embedding: number[] | null
  created_at: string
}

export interface ResponseTemplate {
  id: string
  bot_id: string
  intent_key: string
  language: Language
  content: string
  created_at: string
}

// ============================================================
// V2 TYPES
// ============================================================

export type Channel = 'whatsapp' | 'telegram' | 'web_widget' | 'instagram' | 'facebook'
export type LeadStage = 'new' | 'engaged' | 'qualified' | 'booked' | 'converted' | 'churned'
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'frustrated'
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
export type FollowupStatus = 'pending' | 'sent' | 'completed' | 'failed' | 'cancelled'
export type RecipientStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'opted_out'

export interface ChannelConfig {
  id: string
  bot_id: string
  channel: Channel
  is_active: boolean
  config: Record<string, unknown>
  webhook_url: string | null
  last_connected_at: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  bot_id: string
  external_id: string | null
  channel: Channel
  name: string | null
  phone: string | null
  email: string | null
  language: string
  tags: string[]
  lead_stage: LeadStage
  lead_score: number
  custom_fields: Record<string, unknown>
  last_message_at: string | null
  total_messages: number
  total_bookings: number
  notes: string | null
  assigned_agent_id: string | null
  opt_out: boolean
  created_at: string
  updated_at: string
}

export type ScriptTriggerType = 'keyword' | 'intent' | 'always' | 'manual' | 'api'

export interface BotScript {
  id: string
  bot_id: string
  name: string
  description: string | null
  trigger_type: ScriptTriggerType
  trigger_value: string | null
  flow_data: { nodes: unknown[]; edges: unknown[] }
  is_active: boolean
  is_default: boolean
  version: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface BotScriptVersion {
  id: string
  script_id: string
  version: number
  flow_data: { nodes: unknown[]; edges: unknown[] }
  note: string | null
  created_at: string
}

export interface BroadcastCampaign {
  id: string
  bot_id: string
  name: string
  message_template: { body: string; media_url?: string; buttons?: { text: string; value: string }[] }
  channel: Channel
  audience_filter: {
    tags?: string[]
    lead_stage?: LeadStage
    language?: string
    last_active_days?: number
  }
  status: BroadcastStatus
  scheduled_at: string | null
  sent_at: string | null
  stats: {
    total: number
    sent: number
    delivered: number
    read: number
    replied: number
    failed: number
  }
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BroadcastRecipient {
  id: string
  campaign_id: string
  contact_id: string
  status: RecipientStatus
  error: string | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  replied_at: string | null
}

export type DripTriggerEvent = 'contact_created' | 'lead_stage_change' | 'booking_confirmed' | 'no_reply' | 'manual'

export interface DripSequence {
  id: string
  bot_id: string
  name: string
  trigger_event: DripTriggerEvent
  trigger_value: string | null
  steps: { day: number; message: string; channel: Channel }[]
  is_active: boolean
  created_at: string
}

export interface AgentProfile {
  id: string
  user_id: string
  bot_id: string
  display_name: string | null
  avatar_url: string | null
  is_online: boolean
  last_seen_at: string | null
  created_at: string
}

export interface AgentSession {
  id: string
  conversation_id: string
  agent_id: string
  bot_id: string
  started_at: string
  ended_at: string | null
  is_active: boolean
  notes: string | null
}

export interface FollowupRule {
  id: string
  bot_id: string
  name: string
  trigger_condition: string
  trigger_hours: number | null
  message_template: string
  max_attempts: number
  is_active: boolean
  created_at: string
}

export interface FollowupQueue {
  id: string
  rule_id: string
  contact_id: string
  bot_id: string
  attempt_count: number
  next_attempt_at: string
  status: FollowupStatus
  context: Record<string, unknown>
  created_at: string
}

export type BubbleStyle = 'rounded' | 'sharp' | 'pill'
export type WidgetPosition = 'bottom-right' | 'bottom-left'

export interface WidgetConfig {
  id: string
  bot_id: string
  primary_color: string
  secondary_color: string
  font_family: string
  bubble_style: BubbleStyle
  position: WidgetPosition
  welcome_message: string | null
  placeholder_text: string
  quick_replies: { label: string; message: string }[]
  allowed_domains: string[]
  show_branding: boolean
  custom_css: string | null
  created_at: string
  updated_at: string
}

export interface TenantInvite {
  id: string
  token: string
  email: string
  tenant_id: string | null
  bot_id: string | null
  invited_by: string | null
  role: 'tenant_admin' | 'agent'
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export interface OnboardingProgress {
  id: string
  tenant_id: string
  steps_completed: {
    create_bot: boolean
    upload_doc: boolean
    configure_personality: boolean
    connect_channel: boolean
    test_bot: boolean
  }
  completed_at: string | null
  created_at: string
}

// Extended v2 types for messages/conversations
export interface MessageV2 extends Message {
  sentiment: Sentiment | null
  sentiment_score: number | null
  pipeline_debug: Record<string, unknown> | null
}

export interface ConversationV2 extends Conversation {
  contact_id: string | null
}
