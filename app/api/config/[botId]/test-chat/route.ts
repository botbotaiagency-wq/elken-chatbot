import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { detectIntentAndLanguage } from '@/lib/rag/detect'
import { retrieveContext } from '@/lib/rag/retrieve'
import { buildSystemPrompt } from '@/lib/rag/prompt'
import type { BotConfig } from '@/lib/rag/prompt'
import { logMessage, getOrCreateConversation } from '@/lib/rag/logger'
import { createServiceClient } from '@/lib/supabase/service'
import type { Language } from '@/types/database'

export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const startTime = Date.now()

  const { botId } = await params
  const supabase = createServiceClient()

  // Fetch bot with all config columns (no API key validation — internal test endpoint)
  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id, name, greeting_en, greeting_bm, greeting_zh, tone, fallback_message, blocked_keywords, refuse_message, disclaimer_text, max_response_length, off_topic_message')
    .eq('id', botId)
    .single()

  if (botError || !bot) {
    return Response.json({ error: 'Bot not found' }, { status: 404 })
  }

  // NO API key validation — this is the internal test endpoint used by the dashboard
  // Protected by the dashboard session auth, not by API key

  // Parse request body
  const body = await req.json()
  const {
    message,
    userId,
    channel,
    conversationId: inputConversationId,
    language_override,
  } = body as {
    message: string
    userId?: string
    channel?: string
    conversationId?: string
    language_override?: string
  }

  // Validate required fields (with defaults for admin testing)
  if (!message) {
    return Response.json(
      { error: 'Missing required field: message' },
      { status: 400 }
    )
  }

  const effectiveUserId = userId ?? 'admin-test'
  const effectiveChannel = channel ?? 'web'

  try {
    // Get or create conversation
    const conversationId = await getOrCreateConversation(
      botId,
      effectiveUserId,
      effectiveChannel,
      inputConversationId
    )

    // Log user message (intent/rag fields null for user messages)
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

    // Detect intent and language
    const detection = await detectIntentAndLanguage(message)

    // Apply language_override AFTER detection so intent uses original message language
    if (language_override && ['en', 'bm', 'zh'].includes(language_override)) {
      detection.language = language_override as Language
    }

    // Retrieve context (FAQ priority, chunks, products)
    const retrieval = await retrieveContext(message, botId, detection.intent)

    // Build system prompt
    const botConfig: BotConfig = {
      name: bot.name,
      greeting_en: bot.greeting_en,
      greeting_bm: bot.greeting_bm,
      greeting_zh: bot.greeting_zh,
      tone: bot.tone,
      fallback_message: bot.fallback_message,
      blocked_keywords: bot.blocked_keywords,
      refuse_message: bot.refuse_message,
      disclaimer_text: bot.disclaimer_text,
      max_response_length: bot.max_response_length,
      off_topic_message: bot.off_topic_message,
    }
    const systemPrompt = buildSystemPrompt({ retrieval, detection, botConfig })

    // Build source_chunks metadata for logging
    const sourceChunks = [
      ...retrieval.faqs.map(f => ({ chunk_id: f.id, similarity: f.similarity })),
      ...retrieval.chunks.map(c => ({ chunk_id: c.id, similarity: c.similarity })),
      ...retrieval.products.map(p => ({ chunk_id: p.id, similarity: p.similarity })),
    ]

    // Stream Claude response
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const stream = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    // Create ReadableStream that pipes Claude's stream to the response
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

          // Log assistant message AFTER stream completes
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
    console.error('Test-chat endpoint error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
