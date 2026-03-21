import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

const VALID_LANGUAGES = ['en', 'bm', 'zh'] as const

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const url = new URL(req.url)
  const language = url.searchParams.get('language')

  const supabase = createServiceClient()

  let query = supabase
    .from('faqs')
    .select('*')
    .eq('bot_id', botId)
    .order('created_at', { ascending: false })

  if (language && VALID_LANGUAGES.includes(language as (typeof VALID_LANGUAGES)[number])) {
    query = query.eq('language', language)
  }

  const { data, error } = await query

  if (error) {
    console.error('[faqs GET]', error)
    return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 })
  }

  return NextResponse.json({ faqs: data })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  let body: { question?: string; answer?: string; language?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { question, answer, language } = body

  if (!question || typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'question is required and must be a non-empty string' }, { status: 400 })
  }

  if (!answer || typeof answer !== 'string' || !answer.trim()) {
    return NextResponse.json({ error: 'answer is required and must be a non-empty string' }, { status: 400 })
  }

  if (!language || !VALID_LANGUAGES.includes(language as (typeof VALID_LANGUAGES)[number])) {
    return NextResponse.json(
      { error: `language must be one of: ${VALID_LANGUAGES.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('faqs')
    .insert({ bot_id: botId, question: question.trim(), answer: answer.trim(), language })
    .select()
    .single()

  if (error) {
    console.error('[faqs POST]', error)
    return NextResponse.json({ error: 'Failed to create FAQ' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  let body: { faqId?: string; question?: string; answer?: string; language?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { faqId, question, answer, language } = body

  if (!faqId || typeof faqId !== 'string') {
    return NextResponse.json({ error: 'faqId is required' }, { status: 400 })
  }

  if (!question || typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'question is required and must be a non-empty string' }, { status: 400 })
  }

  if (!answer || typeof answer !== 'string' || !answer.trim()) {
    return NextResponse.json({ error: 'answer is required and must be a non-empty string' }, { status: 400 })
  }

  if (!language || !VALID_LANGUAGES.includes(language as (typeof VALID_LANGUAGES)[number])) {
    return NextResponse.json(
      { error: `language must be one of: ${VALID_LANGUAGES.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('faqs')
    .update({ question: question.trim(), answer: answer.trim(), language })
    .eq('id', faqId)
    .eq('bot_id', botId)

  if (error) {
    console.error('[faqs PATCH]', error)
    return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  let body: { faqId?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { faqId } = body

  if (!faqId || typeof faqId !== 'string') {
    return NextResponse.json({ error: 'faqId is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('faqs')
    .delete()
    .eq('id', faqId)
    .eq('bot_id', botId)

  if (error) {
    console.error('[faqs DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
