import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encryptToken, maskToken } from '@/lib/channels/whatsapp'

// GET /api/config/[botId]/channels — list channel configs (masked tokens)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('channel_configs')
    .select('id, channel, is_active, config, webhook_url, last_connected_at, created_at, updated_at')
    .eq('bot_id', botId)
    .order('channel')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mask sensitive tokens before returning to client
  const masked = (data ?? []).map((row) => {
    const config = row.config as Record<string, string>
    const safeConfig: Record<string, string> = {}

    if (config.phone_number_id) safeConfig.phone_number_id = config.phone_number_id
    if (config.waba_id) safeConfig.waba_id = config.waba_id
    if (config.bot_username) safeConfig.bot_username = config.bot_username
    if (config.verify_token) safeConfig.verify_token = maskToken(config.verify_token)
    if (config.access_token_enc) safeConfig.access_token_masked = '••••' + 'last4'
    if (config.bot_token_enc) safeConfig.bot_token_masked = '••••' + 'last4'

    return { ...row, config: safeConfig }
  })

  return NextResponse.json(masked)
}

// POST /api/config/[botId]/channels — upsert a channel config
export async function POST(
  request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { channel, is_active, ...fields } = body as {
    channel: string
    is_active?: boolean
    // WhatsApp fields
    phone_number_id?: string
    access_token?: string
    verify_token?: string
    waba_id?: string
    app_secret?: string
    // Telegram fields
    bot_token?: string
    bot_username?: string
  }

  if (!channel) {
    return NextResponse.json({ error: 'channel is required' }, { status: 400 })
  }

  // Build encrypted config object — never store plaintext tokens
  const config: Record<string, string> = {}

  if (channel === 'whatsapp') {
    if (fields.phone_number_id) config.phone_number_id = fields.phone_number_id
    if (fields.waba_id) config.waba_id = fields.waba_id
    if (fields.verify_token) config.verify_token = fields.verify_token
    if (fields.access_token) config.access_token_enc = encryptToken(fields.access_token)
    if (fields.app_secret) config.app_secret_enc = encryptToken(fields.app_secret)
  } else if (channel === 'telegram') {
    if (fields.bot_username) config.bot_username = fields.bot_username
    if (fields.bot_token) config.bot_token_enc = encryptToken(fields.bot_token)
  }

  const service = createServiceClient()

  const { data, error } = await service
    .from('channel_configs')
    .upsert(
      {
        bot_id: botId,
        channel,
        is_active: is_active ?? false,
        config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'bot_id,channel' }
    )
    .select('id, channel, is_active, webhook_url, last_connected_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 200 })
}

// PATCH /api/config/[botId]/channels — toggle is_active only
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel, is_active } = await request.json() as { channel: string; is_active: boolean }

  const service = createServiceClient()
  const { error } = await service
    .from('channel_configs')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('bot_id', botId)
    .eq('channel', channel)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
