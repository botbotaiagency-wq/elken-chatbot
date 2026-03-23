export type UserRole = 'super_admin' | 'tenant_admin'

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
