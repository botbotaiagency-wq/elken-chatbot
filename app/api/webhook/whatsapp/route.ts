import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  verifyWebhook,
  validateSignature,
  handleInboundMessage,
  decryptToken,
  type WhatsAppWebhookPayload,
} from '@/lib/channels/whatsapp'

export const maxDuration = 60

// GET — Meta webhook verification (hub.mode, hub.verify_token, hub.challenge)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const botId = searchParams.get('bot_id')

  if (!botId) {
    return new Response('Missing bot_id query param', { status: 400 })
  }

  // Look up the verify_token from channel_configs for this bot
  const supabase = createServiceClient()
  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', 'whatsapp')
    .single()

  const config = (channelConfig?.config ?? {}) as Record<string, string>
  const verifyToken = config.verify_token ?? process.env.WEBHOOK_VERIFY_SECRET ?? ''

  const result = verifyWebhook(mode, token, challenge, verifyToken)
  if (result) {
    return new Response(result, { status: 200 })
  }

  return new Response('Verification failed', { status: 403 })
}

// POST — Receive inbound WhatsApp messages
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const botId = new URL(request.url).searchParams.get('bot_id')

  if (!botId) {
    return NextResponse.json({ error: 'Missing bot_id' }, { status: 400 })
  }

  // Validate HMAC signature if app secret is configured
  const supabase = createServiceClient()
  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', 'whatsapp')
    .single()

  const config = (channelConfig?.config ?? {}) as Record<string, string>
  const appSecretEnc = config.app_secret_enc
  const appSecret = appSecretEnc ? decryptToken(appSecretEnc) : null

  if (appSecret && !validateSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: WhatsAppWebhookPayload
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // WhatsApp expects a 200 OK immediately, processing happens async
  if (payload.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ignored' })
  }

  // Process async (fire-and-forget) — return 200 immediately per WhatsApp spec
  handleInboundMessage(payload, botId).catch((err) =>
    console.error('[WhatsApp webhook] Processing error:', err)
  )

  return NextResponse.json({ status: 'ok' })
}
