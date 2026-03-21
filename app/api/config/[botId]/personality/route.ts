import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

const VALID_TONES = ['Professional', 'Friendly', 'Formal'] as const

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('bots')
    .select('name, greeting_en, greeting_bm, greeting_zh, tone, fallback_message')
    .eq('id', botId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  let body: {
    name?: string
    greeting_en?: string
    greeting_bm?: string
    greeting_zh?: string
    tone?: string
    fallback_message?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.tone !== undefined && !VALID_TONES.includes(body.tone as (typeof VALID_TONES)[number])) {
    return NextResponse.json(
      { error: `tone must be one of: ${VALID_TONES.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('bots')
    .update({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.greeting_en !== undefined && { greeting_en: body.greeting_en }),
      ...(body.greeting_bm !== undefined && { greeting_bm: body.greeting_bm }),
      ...(body.greeting_zh !== undefined && { greeting_zh: body.greeting_zh }),
      ...(body.tone !== undefined && { tone: body.tone }),
      ...(body.fallback_message !== undefined && { fallback_message: body.fallback_message }),
    })
    .eq('id', botId)

  if (error) {
    console.error('[personality PATCH]', error)
    return NextResponse.json({ error: 'Failed to update personality config' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
