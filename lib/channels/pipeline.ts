/**
 * lib/channels/pipeline.ts
 *
 * Non-streaming pipeline caller for channel webhook handlers (WhatsApp, Telegram).
 * Mirrors the logic in app/api/chat/[botId]/route.ts but returns a complete string
 * instead of a ReadableStream. Will be unified with lib/pipeline/ in Day 3.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { detectIntentAndLanguage } from '@/lib/rag/detect'
import { retrieveContext } from '@/lib/rag/retrieve'
import { buildSystemPrompt } from '@/lib/rag/prompt'
import { logMessage, getOrCreateConversation } from '@/lib/rag/logger'
import { handleBookingFlow, isBookingExpired } from '@/lib/booking/state-machine'
import type { BookingState } from '@/lib/booking/types'

export interface ChannelPipelineInput {
  botId: string
  userId: string
  channel: string
  message: string
  senderName?: string | null
  conversationId?: string
}

/**
 * Runs the full RAG pipeline and returns the complete bot response as a string.
 * Used by WhatsApp/Telegram webhook handlers that need the full text before sending.
 */
export async function runChannelPipeline(input: ChannelPipelineInput): Promise<string | null> {
  const { botId, userId, channel, message, conversationId: inputConversationId } = input
  const startTime = Date.now()

  const supabase = createServiceClient()

  try {
    // Fetch bot config
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id, name, greeting_en, greeting_bm, greeting_zh, tone, fallback_message, blocked_keywords, refuse_message, disclaimer_text, max_response_length, off_topic_message, system_prompt, feature_flags')
      .eq('id', botId)
      .single()

    if (botError || !bot) {
      console.error(`[Pipeline] Bot not found: ${botId}`)
      return null
    }

    // Get or create conversation
    const conversationId = await getOrCreateConversation(botId, userId, channel, inputConversationId)

    // Check for active booking state
    const { data: convData } = await supabase
      .from('conversations')
      .select('metadata')
      .eq('id', conversationId)
      .single()

    const bookingState = (convData?.metadata as Record<string, unknown>)?.booking as BookingState | null
    const featureFlags = (bot as Record<string, unknown>).feature_flags as Record<string, unknown> | null

    // Log user message
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

    // Booking state machine check (must come BEFORE intent detection)
    if (bookingState && !isBookingExpired(bookingState) && featureFlags?.booking_enabled) {
      const result = await handleBookingFlow({
        conversationId,
        botId,
        message,
        state: bookingState,
        detection: { intent: 'book_session', language: 'en' },
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

      return result.response
    }

    // Clear expired booking state
    if (bookingState && isBookingExpired(bookingState)) {
      await supabase
        .from('conversations')
        .update({ metadata: {}, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    }

    // Intent and language detection
    const detection = await detectIntentAndLanguage(message)

    // New booking request
    if (detection.intent === 'book_session' && featureFlags?.booking_enabled) {
      const result = await handleBookingFlow({
        conversationId,
        botId,
        message,
        state: null,
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

      return result.response
    }

    // RAG retrieval
    const retrieval = await retrieveContext(message, botId, detection.intent)

    // Fetch active v1 scripts (sales conversation scripts)
    const { data: scripts } = await supabase
      .from('scripts')
      .select('name, content')
      .eq('bot_id', botId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    // Build system prompt
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
        system_prompt: (bot as Record<string, unknown>).system_prompt as string | null,
      },
      scripts: scripts ?? [],
    })

    const sourceChunks = [
      ...retrieval.faqs.map(f => ({ chunk_id: f.id, similarity: f.similarity })),
      ...retrieval.chunks.map(c => ({ chunk_id: c.id, similarity: c.similarity })),
      ...retrieval.products.map(p => ({ chunk_id: p.id, similarity: p.similarity })),
    ]

    // Claude API call (non-streaming)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    const responseText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    const latencyMs = Date.now() - startTime

    // Log assistant message (fire-and-forget)
    logMessage({
      conversationId,
      botId,
      role: 'assistant',
      content: responseText,
      intent: detection.intent,
      sourceChunks: sourceChunks.length > 0 ? sourceChunks : null,
      ragFound: retrieval.ragFound,
      latencyMs,
    }).catch(console.error)

    return responseText
  } catch (err) {
    console.error('[ChannelPipeline] Error:', err)
    return null
  }
}
