import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('bots')
    .select('blocked_keywords, refuse_message, disclaimer_text, max_response_length, off_topic_message')
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
    blocked_keywords?: string
    refuse_message?: string
    disclaimer_text?: string
    max_response_length?: number
    off_topic_message?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    body.max_response_length !== undefined &&
    (!Number.isInteger(body.max_response_length) || body.max_response_length <= 0)
  ) {
    return NextResponse.json(
      { error: 'max_response_length must be a positive integer' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('bots')
    .update({
      ...(body.blocked_keywords !== undefined && { blocked_keywords: body.blocked_keywords }),
      ...(body.refuse_message !== undefined && { refuse_message: body.refuse_message }),
      ...(body.disclaimer_text !== undefined && { disclaimer_text: body.disclaimer_text }),
      ...(body.max_response_length !== undefined && { max_response_length: body.max_response_length }),
      ...(body.off_topic_message !== undefined && { off_topic_message: body.off_topic_message }),
    })
    .eq('id', botId)

  if (error) {
    console.error('[guardrails PATCH]', error)
    return NextResponse.json({ error: 'Failed to update guardrails config' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
