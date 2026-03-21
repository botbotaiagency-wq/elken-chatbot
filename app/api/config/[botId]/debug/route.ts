import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    return Response.json(
      { error: 'Missing conversationId query param' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Verify conversation belongs to this bot
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('bot_id', botId)
    .single()

  if (!conv) {
    return Response.json(
      { error: 'Conversation not found for this bot' },
      { status: 404 }
    )
  }

  // Fetch the LAST assistant message in this conversation
  const { data: msg } = await supabase
    .from('messages')
    .select('id, intent, source_chunks, rag_found, latency_ms')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!msg || !msg.source_chunks) {
    return Response.json({
      intent: msg?.intent ?? null,
      rag_found: msg?.rag_found ?? null,
      latency_ms: msg?.latency_ms ?? null,
      source_chunks: [],
    })
  }

  // Parse source_chunks (jsonb array of { chunk_id, similarity })
  const rawChunks = msg.source_chunks as Array<{ chunk_id: string; similarity: number }>
  const chunkIds = rawChunks.map(c => c.chunk_id)

  // Fetch chunks with their parent document filenames
  const { data: chunks } = await supabase
    .from('chunks')
    .select('id, content, document_id, documents!inner(filename)')
    .in('id', chunkIds)
    .eq('bot_id', botId)

  // Build resolved source_chunks array
  const resolved = rawChunks.map(sc => {
    const chunk = chunks?.find(c => c.id === sc.chunk_id)
    return {
      chunk_id: sc.chunk_id,
      similarity: sc.similarity,
      content_preview: chunk?.content?.slice(0, 120) ?? '',
      document_name: (chunk as any)?.documents?.filename ?? 'Unknown',
    }
  })

  return Response.json({
    intent: msg.intent,
    rag_found: msg.rag_found,
    latency_ms: msg.latency_ms,
    source_chunks: resolved,
  })
}
