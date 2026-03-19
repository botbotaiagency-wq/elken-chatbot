import { createServiceClient } from '@/lib/supabase/service'
import type { Intent } from '@/types/database'

export interface LogMessageParams {
  conversationId: string
  botId: string
  role: 'user' | 'assistant'
  content: string
  intent: Intent | null
  sourceChunks: { chunk_id: string; similarity: number }[] | null
  ragFound: boolean | null
  latencyMs: number | null
}

export async function logMessage(params: LogMessageParams): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: params.conversationId,
      bot_id: params.botId,
      role: params.role,
      content: params.content,
      intent: params.intent,
      source_chunks: params.sourceChunks,
      rag_found: params.ragFound,
      latency_ms: params.latencyMs,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to log message:', error)
    throw error
  }

  return data.id
}

export async function getOrCreateConversation(
  botId: string,
  userId: string,
  channel: string,
  conversationId?: string
): Promise<string> {
  const supabase = createServiceClient()

  // If conversationId provided, verify it exists and belongs to this bot
  if (conversationId) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('bot_id', botId)
      .single()
    if (data) return data.id
  }

  // Create new conversation
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      bot_id: botId,
      user_id: userId,
      channel,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}
