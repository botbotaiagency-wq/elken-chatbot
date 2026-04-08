import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { setupWebhook } from '@/lib/channels/telegram'
import { decryptToken } from '@/lib/channels/whatsapp'

// POST /api/webhook/telegram/setup?bot_id=xxx
// Registers the webhook URL with Telegram so it starts sending updates here.
export async function POST(request: Request) {
  // Auth: must be tenant_admin or super_admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const botId = searchParams.get('bot_id')

  if (!botId) {
    return NextResponse.json({ error: 'Missing bot_id' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: channelConfig } = await service
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', 'telegram')
    .single()

  if (!channelConfig) {
    return NextResponse.json({ error: 'Telegram channel not configured for this bot' }, { status: 404 })
  }

  const config = channelConfig.config as Record<string, string>
  const botToken = decryptToken(config.bot_token_enc)

  if (!botToken) {
    return NextResponse.json({ error: 'Telegram bot_token not set' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const webhookUrl = `${appUrl}/api/webhook/telegram?bot_id=${botId}`

  const success = await setupWebhook(botToken, webhookUrl)

  if (!success) {
    return NextResponse.json({ error: 'Webhook registration failed' }, { status: 500 })
  }

  // Update webhook_url and last_connected_at in channel_configs
  await service
    .from('channel_configs')
    .update({
      webhook_url: webhookUrl,
      last_connected_at: new Date().toISOString(),
    })
    .eq('bot_id', botId)
    .eq('channel', 'telegram')

  return NextResponse.json({ success: true, webhook_url: webhookUrl })
}
