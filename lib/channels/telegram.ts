import { createServiceClient } from '@/lib/supabase/service'
import { runChannelPipeline } from '@/lib/channels/pipeline'
import { decryptToken } from '@/lib/channels/whatsapp'

// ============================================================
// Types
// ============================================================

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  first_name?: string
  last_name?: string
  username?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  voice?: { file_id: string; duration: number }
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  callback_query?: {
    id: string
    from: TelegramUser
    message?: TelegramMessage
    data?: string
  }
}

// ============================================================
// Inbound update handler
// ============================================================

export async function handleUpdate(update: TelegramUpdate, botId: string): Promise<void> {
  const supabase = createServiceClient()

  const msg = update.message ?? update.edited_message
  if (!msg?.text || !msg.from) return

  const chatId = String(msg.chat.id)
  const userId = String(msg.from.id)
  const messageText = msg.text
  const senderName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || null

  // Skip bot messages
  if (msg.from.is_bot) return

  // Get channel config for reply credentials
  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', 'telegram')
    .eq('is_active', true)
    .single()

  if (!channelConfig) {
    console.error(`[Telegram] No active channel config for bot ${botId}`)
    return
  }

  const config = channelConfig.config as Record<string, string>
  const botToken = decryptToken(config.bot_token_enc)

  if (!botToken) {
    console.error(`[Telegram] Missing bot_token for bot ${botId}`)
    return
  }

  // Run pipeline
  const response = await runChannelPipeline({
    botId,
    userId,
    channel: 'telegram',
    message: messageText,
    senderName,
  })

  if (response) {
    await sendMessage(chatId, response, botToken)
  }
}

// ============================================================
// Outbound message sender
// ============================================================

export async function sendMessage(
  chatId: string,
  text: string,
  botToken: string
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`

  // Telegram max message length is 4096 chars — split if needed
  const chunks = splitMessage(text, 4096)

  for (const chunk of chunks) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: 'Markdown',
        }),
      })

      if (!res.ok) {
        // Retry without Markdown if parsing fails
        const retry = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: chunk }),
        })
        if (!retry.ok) {
          console.error(`[Telegram] Send failed for chat ${chatId}:`, await retry.text())
          return false
        }
      }
    } catch (err) {
      console.error(`[Telegram] Send error:`, err)
      return false
    }
  }

  return true
}

// ============================================================
// Webhook registration
// ============================================================

export async function setupWebhook(botToken: string, webhookUrl: string): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
        drop_pending_updates: true,
      }),
    })

    const data = await res.json() as { ok: boolean; description?: string }
    if (!data.ok) {
      console.error('[Telegram] Webhook setup failed:', data.description)
      return false
    }
    return true
  } catch (err) {
    console.error('[Telegram] Webhook setup error:', err)
    return false
  }
}

// ============================================================
// Helpers
// ============================================================

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxLen))
    start += maxLen
  }
  return chunks
}
