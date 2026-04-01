import { NextRequest, NextResponse } from 'next/server'
import { handleOAuthCallback } from '@/lib/booking/google-calendar'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const botId = searchParams.get('state')  // we pass botId as OAuth state
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `${origin}/dashboard/bots/${botId}/integrations?cal_error=${encodeURIComponent(error)}`
    )
  }

  if (!code || !botId) {
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  try {
    const redirectUri = `${origin}/api/auth/google-calendar/callback`
    await handleOAuthCallback(botId, code, redirectUri)
    return NextResponse.redirect(
      `${origin}/dashboard/bots/${botId}/integrations?cal_connected=1`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth failed'
    return NextResponse.redirect(
      `${origin}/dashboard/bots/${botId}/integrations?cal_error=${encodeURIComponent(msg)}`
    )
  }
}
