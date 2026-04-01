import { NextRequest, NextResponse } from 'next/server'
import { getOAuthUrl } from '@/lib/booking/google-calendar'

export async function GET(req: NextRequest) {
  const botId = req.nextUrl.searchParams.get('botId')
  if (!botId) {
    return NextResponse.json({ error: 'botId is required' }, { status: 400 })
  }

  const origin = req.nextUrl.origin
  const redirectUri = `${origin}/api/auth/google-calendar/callback`

  const url = getOAuthUrl(botId, redirectUri)
  if (!url) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' },
      { status: 503 }
    )
  }

  return NextResponse.redirect(url)
}
