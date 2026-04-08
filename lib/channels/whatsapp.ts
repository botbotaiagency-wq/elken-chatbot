import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { runChannelPipeline } from '@/lib/channels/pipeline'

// ============================================================
// Types
// ============================================================

export interface WhatsAppTextBody {
  body: string
}

export interface WhatsAppMessage {
  from: string          // sender's WhatsApp phone number
  id: string            // message ID (for deduplication)
  timestamp: string
  type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'reaction'
  text?: WhatsAppTextBody
}

export interface WhatsAppValue {
  messaging_product: 'whatsapp'
  metadata: { display_phone_number: string; phone_number_id: string }
  contacts?: { profile: { name: string }; wa_id: string }[]
  messages?: WhatsAppMessage[]
  statuses?: { id: string; status: string; timestamp: string; recipient_id: string }[]
}

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account'
  entry: {
    id: string
    changes: { value: WhatsAppValue; field: string }[]
  }[]
}

// ============================================================
// Webhook verification
// ============================================================

export function verifyWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  verifyToken: string
): string | null {
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge
  }
  return null
}

// ============================================================
// Signature validation (HMAC-SHA256)
// ============================================================

export function validateSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) return false
  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// ============================================================
// Inbound message handler
// ============================================================

export async function handleInboundMessage(
  payload: WhatsAppWebhookPayload,
  botId: string
): Promise<void> {
  const supabase = createServiceClient()

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue
      const value = change.value
      if (!value.messages?.length) continue

      for (const msg of value.messages) {
        // Only handle text messages for now (voice/media = Day 3+)
        if (msg.type !== 'text' || !msg.text?.body) continue

        const senderPhone = msg.from
        const messageText = msg.text.body
        const messageId = msg.id
        const senderName = value.contacts?.[0]?.profile?.name ?? null

        // Deduplication: skip if we've seen this message_id
        const { data: existing } = await supabase
          .from('messages')
          .select('id')
          .eq('bot_id', botId)
          .filter('source_chunks', 'cs', JSON.stringify([{ wa_message_id: messageId }]))
          .maybeSingle()

        if (existing) continue

        // Get channel config for reply credentials
        const { data: channelConfig } = await supabase
          .from('channel_configs')
          .select('config')
          .eq('bot_id', botId)
          .eq('channel', 'whatsapp')
          .eq('is_active', true)
          .single()

        if (!channelConfig) {
          console.error(`[WhatsApp] No active channel config for bot ${botId}`)
          continue
        }

        const config = channelConfig.config as Record<string, string>
        const accessToken = decryptToken(config.access_token_enc)
        const phoneNumberId = config.phone_number_id

        if (!accessToken || !phoneNumberId) {
          console.error(`[WhatsApp] Missing credentials for bot ${botId}`)
          continue
        }

        // Run the chat pipeline (non-streaming for webhook response)
        const response = await runChannelPipeline({
          botId,
          userId: senderPhone,
          channel: 'whatsapp',
          message: messageText,
          senderName,
        })

        if (response) {
          await sendWhatsAppMessage(senderPhone, response, accessToken, phoneNumberId)
        }
      }
    }
  }
}

// ============================================================
// Outbound message sender
// ============================================================

export async function sendWhatsAppMessage(
  to: string,
  message: string,
  accessToken: string,
  phoneNumberId: string
): Promise<boolean> {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: message },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[WhatsApp] Send failed for ${to}:`, err)
      return false
    }

    return true
  } catch (err) {
    console.error(`[WhatsApp] Send error:`, err)
    return false
  }
}

// ============================================================
// Token encryption helpers (AES-256-GCM)
// Uses CHANNEL_ENCRYPTION_KEY env var (32-byte hex string)
// ============================================================

function getEncryptionKey(): Buffer {
  const key = process.env.CHANNEL_ENCRYPTION_KEY
  if (!key) throw new Error('CHANNEL_ENCRYPTION_KEY env var is required')
  return Buffer.from(key, 'hex')
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(12):tag(16):ciphertext — all hex
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptToken(enc: string | undefined): string | null {
  if (!enc) return null
  try {
    const [ivHex, tagHex, cipherHex] = enc.split(':')
    const key = getEncryptionKey()
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const ciphertext = Buffer.from(cipherHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}

export function maskToken(token: string): string {
  if (token.length <= 4) return '****'
  return '••••' + token.slice(-4)
}
