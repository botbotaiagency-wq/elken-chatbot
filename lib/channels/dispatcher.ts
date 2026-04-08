/**
 * lib/channels/dispatcher.ts
 *
 * Unified outbound message sender. Routes messages to the correct
 * channel (WhatsApp / Telegram / web_widget) based on contact's channel.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsAppMessage, decryptToken } from '@/lib/channels/whatsapp'
import { sendMessage as sendTelegramMessage } from '@/lib/channels/telegram'

/**
 * Send a message to a contact using their channel.
 * Looks up contact and channel credentials from the database.
 */
export async function sendMessageToContact(
  contactId: string,
  message: string,
  botId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  // Get contact channel info
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('external_id, channel')
    .eq('id', contactId)
    .eq('bot_id', botId)
    .single()

  if (error || !contact?.external_id) {
    console.error(`[Dispatcher] Contact not found or missing external_id: ${contactId}`)
    return false
  }

  // Get channel credentials
  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', contact.channel)
    .eq('is_active', true)
    .single()

  if (!channelConfig) {
    console.error(`[Dispatcher] No active channel config for ${contact.channel} on bot ${botId}`)
    return false
  }

  const config = channelConfig.config as Record<string, string>

  switch (contact.channel) {
    case 'whatsapp': {
      const accessToken = decryptToken(config.access_token_enc)
      const phoneNumberId = config.phone_number_id
      if (!accessToken || !phoneNumberId) {
        console.error(`[Dispatcher] WhatsApp credentials missing for bot ${botId}`)
        return false
      }
      return sendWhatsAppMessage(contact.external_id, message, accessToken, phoneNumberId)
    }

    case 'telegram': {
      const botToken = decryptToken(config.bot_token_enc)
      if (!botToken) {
        console.error(`[Dispatcher] Telegram bot_token missing for bot ${botId}`)
        return false
      }
      return sendTelegramMessage(contact.external_id, message, botToken)
    }

    default:
      console.warn(`[Dispatcher] Unsupported channel: ${contact.channel}`)
      return false
  }
}

/**
 * Send a message directly by channel + external_id (used by cron jobs / broadcasts).
 */
export async function sendMessageDirect(params: {
  channel: string
  externalId: string
  message: string
  botId: string
}): Promise<boolean> {
  const { channel, externalId, message, botId } = params
  const supabase = createServiceClient()

  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', channel)
    .eq('is_active', true)
    .single()

  if (!channelConfig) {
    console.error(`[Dispatcher] No active config for channel ${channel} on bot ${botId}`)
    return false
  }

  const config = channelConfig.config as Record<string, string>

  switch (channel) {
    case 'whatsapp': {
      const accessToken = decryptToken(config.access_token_enc)
      const phoneNumberId = config.phone_number_id
      if (!accessToken || !phoneNumberId) return false
      return sendWhatsAppMessage(externalId, message, accessToken, phoneNumberId)
    }
    case 'telegram': {
      const botToken = decryptToken(config.bot_token_enc)
      if (!botToken) return false
      return sendTelegramMessage(externalId, message, botToken)
    }
    default:
      return false
  }
}
