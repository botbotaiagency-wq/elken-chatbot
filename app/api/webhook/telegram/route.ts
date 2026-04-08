import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { handleUpdate, type TelegramUpdate } from '@/lib/channels/telegram'

export const maxDuration = 60

// POST — Receive inbound Telegram updates
// URL pattern: /api/webhook/telegram?bot_id=xxx
// Telegram sends updates to the registered webhook URL
export async function POST(request: NextRequest) {
  const botId = new URL(request.url).searchParams.get('bot_id')

  if (!botId) {
    return NextResponse.json({ error: 'Missing bot_id' }, { status: 400 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json() as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Process async — Telegram expects 200 OK within a few seconds
  handleUpdate(update, botId).catch((err) =>
    console.error('[Telegram webhook] Processing error:', err)
  )

  return NextResponse.json({ ok: true })
}
