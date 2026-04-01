import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { listCalendars, disconnectGoogleCalendar } from '@/lib/booking/google-calendar'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('bots')
    .select('google_calendar_id, google_oauth_email, google_oauth_refresh_token')
    .eq('id', botId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
  }

  const isConnected = Boolean(data.google_oauth_refresh_token)

  // If connected, fetch the calendar list so the user can pick one
  let calendars: { id: string; summary: string; primary: boolean }[] = []
  if (isConnected) {
    calendars = await listCalendars(botId)
  }

  const oauthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

  return NextResponse.json({
    google_calendar_id: data.google_calendar_id,
    connected_email: data.google_oauth_email,
    is_connected: isConnected,
    oauth_configured: oauthConfigured,
    calendars,
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  let body: { google_calendar_id?: string; disconnect?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.disconnect) {
    await disconnectGoogleCalendar(botId)
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('bots')
    .update({ google_calendar_id: body.google_calendar_id || null })
    .eq('id', botId)

  if (error) {
    return NextResponse.json({ error: 'Failed to update calendar config' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
