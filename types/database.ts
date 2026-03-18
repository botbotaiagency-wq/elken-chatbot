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

export interface Document {
  id: string
  bot_id: string
  filename: string
  category: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  chunk_count: number
  created_at: string
}
