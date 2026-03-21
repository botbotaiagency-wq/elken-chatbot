import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

const VALID_LANGUAGES = ['en', 'bm', 'zh'] as const
const VALID_INTENT_KEYS = [
  'no_product_found',
  'slot_full',
  'booking_confirmed',
  'reminder_24h',
  'post_survey',
] as const

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const url = new URL(req.url)
  const language = url.searchParams.get('language')

  const supabase = createServiceClient()

  let query = supabase
    .from('response_templates')
    .select('*')
    .eq('bot_id', botId)
    .order('intent_key')

  if (language && VALID_LANGUAGES.includes(language as (typeof VALID_LANGUAGES)[number])) {
    query = query.eq('language', language)
  }

  const { data, error } = await query

  if (error) {
    console.error('[templates GET]', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }

  return NextResponse.json({ templates: data })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  let body: { intent_key?: string; language?: string; content?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { intent_key, language, content } = body

  if (!intent_key || !VALID_INTENT_KEYS.includes(intent_key as (typeof VALID_INTENT_KEYS)[number])) {
    return NextResponse.json(
      { error: `intent_key must be one of: ${VALID_INTENT_KEYS.join(', ')}` },
      { status: 400 }
    )
  }

  if (!language || !VALID_LANGUAGES.includes(language as (typeof VALID_LANGUAGES)[number])) {
    return NextResponse.json(
      { error: `language must be one of: ${VALID_LANGUAGES.join(', ')}` },
      { status: 400 }
    )
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required and must be a non-empty string' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('response_templates')
    .upsert(
      { bot_id: botId, intent_key, language, content: content.trim() },
      { onConflict: 'bot_id,intent_key,language' }
    )

  if (error) {
    console.error('[templates PATCH]', error)
    return NextResponse.json({ error: 'Failed to upsert template' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
