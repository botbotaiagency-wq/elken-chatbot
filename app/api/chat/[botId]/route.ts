import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { detectIntentAndLanguage } from '@/lib/rag/detect'
import { retrieveContext } from '@/lib/rag/retrieve'
import { buildSystemPrompt } from '@/lib/rag/prompt'
import { logMessage, getOrCreateConversation } from '@/lib/rag/logger'
import { createServiceClient } from '@/lib/supabase/service'
import { handleBookingFlow, isBookingExpired } from '@/lib/booking/state-machine'
import type { BookingState } from '@/lib/booking/types'
import type { Language } from '@/types/database'

export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const startTime = Date.now()

  const { botId } = await params

  // --- API Key Validation (RAG-01 / API-04) ---
  // Look up the bot to check if api_key_hash is configured
  const supabase = createServiceClient()
  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id, api_key_hash, name, greeting_en, greeting_bm, greeting_zh, tone, fallback_message, blocked_keywords, refuse_message, disclaimer_text, max_response_length, off_topic_message, feature_flags')
    .eq('id', botId)
    .single()

  if (botError || !bot) {
    return Response.json({ error: 'Bot not found' }, { status: 404 })
  }

  const apiKey = req.headers.get('X-API-Key')

  if (apiKey) {
    // Key provided — validate against api_keys table first, then fall back to bots.api_key_hash
    const providedHash = crypto.createHash('sha256').update(apiKey).digest('hex')

    // Check api_keys table (Phase 3 keys)
    const { data: keyRow } = await supabase
      .from('api_keys')
      .select('id, key_hash')
      .eq('bot_id', botId)
      .eq('key_hash', providedHash)
      .is('revoked_at', null)
      .maybeSingle()

    if (keyRow) {
      // Found in api_keys table — constant-time comparison
      const storedHashBuffer = Buffer.from(keyRow.key_hash, 'utf-8')
      const providedHashBuffer = Buffer.from(providedHash, 'utf-8')

      if (
        storedHashBuffer.length !== providedHashBuffer.length ||
        !crypto.timingSafeEqual(storedHashBuffer, providedHashBuffer)
      ) {
        return Response.json({ error: 'Invalid API key' }, { status: 401 })
      }

      // Fire-and-forget: update last_used_at (do NOT await — non-blocking)
      supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyRow.id)
    } else {
      // Not in api_keys table — fall back to bots.api_key_hash (Phase 1/2 bots)
      if (bot.api_key_hash) {
        const storedHashBuffer = Buffer.from(bot.api_key_hash, 'utf-8')
        const providedHashBuffer = Buffer.from(providedHash, 'utf-8')

        if (
          storedHashBuffer.length !== providedHashBuffer.length ||
          !crypto.timingSafeEqual(storedHashBuffer, providedHashBuffer)
        ) {
          return Response.json({ error: 'Invalid API key' }, { status: 401 })
        }
      } else {
        // No api_key_hash on bot, no api_keys rows — dev-mode bypass
        console.warn(`[DEV MODE] Bot ${botId}: no api_key_hash set — skipping API key validation. API keys will be enforced after Phase 3.`)
      }
    }
  } else {
    // No key provided — check if auth is required
    if (bot.api_key_hash) {
      return Response.json({ error: 'Missing X-API-Key header' }, { status: 401 })
    } else {
      // api_key_hash is null — dev/test mode (pre-Phase 3)
      console.warn(`[DEV MODE] Bot ${botId}: no api_key_hash set — skipping API key validation. API keys will be enforced after Phase 3.`)
    }
  }

  // 1. Parse request body
  const body = await req.json()
  const { message, userId, channel, conversationId: inputConversationId, language_override } = body as {
    message: string
    userId: string
    channel: string
    conversationId?: string
    language_override?: string
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

  try {
    // 4. Get or create conversation
    const conversationId = await getOrCreateConversation(botId, userId, channel, inputConversationId)

    // 4b. Check for active booking state
    const { data: convData } = await supabase
      .from('conversations')
      .select('metadata')
      .eq('id', conversationId)
      .single()
    const bookingState = (convData?.metadata as Record<string, unknown>)?.booking as BookingState | null

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

    // 5b. Check booking state BEFORE intent detection
    // If booking is active, route to booking handler directly — even if intent is not book_session
    // This prevents intent misclassification of booking responses (e.g., "yes" → general, "3" → unknown)
    const featureFlags = (bot as Record<string, unknown>).feature_flags as Record<string, unknown> | null
    if (bookingState && !isBookingExpired(bookingState) && featureFlags?.booking_enabled) {
      const result = await handleBookingFlow({
        conversationId,
        botId,
        message,
        state: bookingState,
        detection: { intent: 'book_session', language: 'en' }, // language doesn't matter for booking prompts
        userId,
        channel,
      })

      // Log the assistant booking response
      const latencyMs = Date.now() - startTime
      await logMessage({
        conversationId,
        botId,
        role: 'assistant',
        content: result.response,
        intent: 'book_session',
        sourceChunks: null,
        ragFound: null,
        latencyMs,
      })

      return new Response(result.response, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Conversation-Id': conversationId,
          'X-Intent': 'book_session',
          'X-Language': 'en',
          'X-Rag-Found': 'false',
        },
      })
    }

    // Also check for expired booking state and clear it
    if (bookingState && isBookingExpired(bookingState)) {
      await supabase
        .from('conversations')
        .update({ metadata: {}, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
      // Fall through to normal intent detection — the expired message will be handled below
    }

    // 6. Detect intent and language
    const detection = await detectIntentAndLanguage(message)
    if (language_override && ['en', 'bm', 'zh'].includes(language_override)) {
      detection.language = language_override as Language
    }

    // 6b. Check if this is a new booking request
    if (detection.intent === 'book_session' && featureFlags?.booking_enabled) {
      const result = await handleBookingFlow({
        conversationId,
        botId,
        message,
        state: null, // New booking — no existing state
        detection,
        userId,
        channel,
      })

      const latencyMs = Date.now() - startTime
      await logMessage({
        conversationId,
        botId,
        role: 'assistant',
        content: result.response,
        intent: 'book_session',
        sourceChunks: null,
        ragFound: null,
        latencyMs,
      })

      return new Response(result.response, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Conversation-Id': conversationId,
          'X-Intent': 'book_session',
          'X-Language': detection.language,
          'X-Rag-Found': 'false',
        },
      })
    }

    // 7. Retrieve context (FAQ priority, chunks, products)
    const retrieval = await retrieveContext(message, botId, detection.intent)

    // 8. Build system prompt
    const systemPrompt = buildSystemPrompt({
      retrieval,
      detection,
      botConfig: {
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
      },
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
      model: 'claude-haiku-4-5-20251001',
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
