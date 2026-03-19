import Anthropic from '@anthropic-ai/sdk'
import { detectIntentAndLanguage } from '@/lib/rag/detect'
import { retrieveContext } from '@/lib/rag/retrieve'
import { buildSystemPrompt } from '@/lib/rag/prompt'
import { logMessage, getOrCreateConversation } from '@/lib/rag/logger'

export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const startTime = Date.now()

  // TODO Phase 3 (API-04): validate X-API-Key header via constant-time hash comparison
  // The full key management infrastructure (key generation, hashing, tenant binding) lands in Phase 3.
  // For now the endpoint is unauthenticated — protected only at the infrastructure/network level.

  // 1. Parse request body
  const body = await req.json()
  const { message, userId, channel, conversationId: inputConversationId } = body as {
    message: string
    userId: string
    channel: string
    conversationId?: string
  }

  // 2. Validate required fields
  if (!message || !userId || !channel) {
    return Response.json(
      { error: 'Missing required fields: message, userId, channel' },
      { status: 400 }
    )
  }

  // 3. Validate channel
  if (!['whatsapp', 'telegram', 'web'].includes(channel)) {
    return Response.json({ error: 'Invalid channel. Must be: whatsapp, telegram, or web' }, { status: 400 })
  }

  const { botId } = await params

  try {
    // 4. Get or create conversation
    const conversationId = await getOrCreateConversation(botId, userId, channel, inputConversationId)

    // 5. Log user message (intent/rag fields null for user messages)
    await logMessage({
      conversationId,
      botId,
      role: 'user',
      content: message,
      intent: null,
      sourceChunks: null,
      ragFound: null,
      latencyMs: null,
    })

    // 6. Detect intent and language
    const detection = await detectIntentAndLanguage(message)

    // 7. Retrieve context (FAQ priority, chunks, products)
    const retrieval = await retrieveContext(message, botId, detection.intent)

    // 8. Build system prompt
    const systemPrompt = buildSystemPrompt({
      retrieval,
      detection,
    })

    // 9. Build source_chunks metadata for logging
    const sourceChunks = [
      ...retrieval.faqs.map(f => ({ chunk_id: f.id, similarity: f.similarity })),
      ...retrieval.chunks.map(c => ({ chunk_id: c.id, similarity: c.similarity })),
      ...retrieval.products.map(p => ({ chunk_id: p.id, similarity: p.similarity })),
    ]

    // 10. Stream Claude response
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const stream = await anthropic.messages.create({
      model: 'claude-haiku-20241022',
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    // 11. Create ReadableStream that pipes Claude's stream to the response
    const encoder = new TextEncoder()
    let fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullResponse += event.delta.text
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()

          // 12. Log assistant message AFTER stream completes
          const latencyMs = Date.now() - startTime
          await logMessage({
            conversationId,
            botId,
            role: 'assistant',
            content: fullResponse,
            intent: detection.intent,
            sourceChunks: sourceChunks.length > 0 ? sourceChunks : null,
            ragFound: retrieval.ragFound,
            latencyMs,
          })
        } catch (streamError) {
          controller.error(streamError)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Conversation-Id': conversationId,
        'X-Intent': detection.intent,
        'X-Language': detection.language,
        'X-Rag-Found': String(retrieval.ragFound),
      },
    })
  } catch (error) {
    console.error('Chat endpoint error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
