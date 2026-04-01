import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'

const TIMEZONE = 'Asia/Kuala_Lumpur'
const SCOPES = ['https://www.googleapis.com/auth/calendar']

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return new google.auth.OAuth2(clientId, clientSecret)
}

/**
 * Build an authenticated OAuth2 client for a specific bot.
 * Refreshes the access token automatically when expired.
 * Returns null if the bot has no connected Google account.
 */
async function getAuthForBot(botId: string) {
  const oauth2Client = getOAuthClient()
  if (!oauth2Client) return null

  const supabase = createServiceClient()
  const { data: bot } = await supabase
    .from('bots')
    .select('google_oauth_access_token, google_oauth_refresh_token, google_oauth_token_expiry')
    .eq('id', botId)
    .single()

  if (!bot?.google_oauth_refresh_token) return null

  oauth2Client.setCredentials({
    access_token: bot.google_oauth_access_token,
    refresh_token: bot.google_oauth_refresh_token,
    expiry_date: bot.google_oauth_token_expiry
      ? new Date(bot.google_oauth_token_expiry).getTime()
      : undefined,
  })

  // Auto-refresh and persist when the token is about to expire
  oauth2Client.on('tokens', async (tokens) => {
    await supabase
      .from('bots')
      .update({
        ...(tokens.access_token && { google_oauth_access_token: tokens.access_token }),
        ...(tokens.expiry_date && {
          google_oauth_token_expiry: new Date(tokens.expiry_date).toISOString(),
        }),
      })
      .eq('id', botId)
  })

  return oauth2Client
}

/**
 * Returns the Google OAuth URL to start the connect flow for a bot.
 */
export function getOAuthUrl(botId: string, redirectUri: string): string | null {
  const oauth2Client = getOAuthClient()
  if (!oauth2Client) return null

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: botId,
    redirect_uri: redirectUri,
  })
}

/**
 * Exchanges an OAuth code for tokens and persists them on the bot record.
 */
export async function handleOAuthCallback(
  botId: string,
  code: string,
  redirectUri: string
): Promise<{ email: string | null }> {
  const oauth2Client = getOAuthClient()
  if (!oauth2Client) throw new Error('Google OAuth is not configured')

  const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri })
  oauth2Client.setCredentials(tokens)

  // Get the connected account's email
  let email: string | null = null
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data } = await oauth2.userinfo.get()
    email = data.email ?? null
  } catch {
    // non-fatal — email display is optional
  }

  const supabase = createServiceClient()
  await supabase
    .from('bots')
    .update({
      google_oauth_access_token: tokens.access_token ?? null,
      google_oauth_refresh_token: tokens.refresh_token ?? null,
      google_oauth_token_expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
      google_oauth_email: email,
    })
    .eq('id', botId)

  return { email }
}

/**
 * Disconnects the Google account from a bot.
 */
export async function disconnectGoogleCalendar(botId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('bots')
    .update({
      google_oauth_access_token: null,
      google_oauth_refresh_token: null,
      google_oauth_token_expiry: null,
      google_oauth_email: null,
    })
    .eq('id', botId)
}

export interface CalendarEventInput {
  calendarId: string
  summary: string
  description: string
  start: string  // ISO datetime string
  end: string    // ISO datetime string
  location?: string
}

/**
 * Creates a Google Calendar event and returns the event ID.
 * Returns null if the bot has no connected Google account or creation fails.
 */
export async function createCalendarEvent(
  botId: string,
  params: CalendarEventInput
): Promise<string | null> {
  const auth = await getAuthForBot(botId)
  if (!auth) return null

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    const res = await calendar.events.insert({
      calendarId: params.calendarId,
      requestBody: {
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: { dateTime: params.start, timeZone: TIMEZONE },
        end: { dateTime: params.end, timeZone: TIMEZONE },
      },
    })
    return res.data.id ?? null
  } catch (err) {
    console.error('[Google Calendar] createCalendarEvent failed:', err)
    return null
  }
}

/**
 * Updates an existing Google Calendar event.
 */
export async function updateCalendarEvent(
  botId: string,
  calendarId: string,
  eventId: string,
  params: Partial<Omit<CalendarEventInput, 'calendarId'>>
): Promise<void> {
  const auth = await getAuthForBot(botId)
  if (!auth) return

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        ...(params.summary !== undefined && { summary: params.summary }),
        ...(params.description !== undefined && { description: params.description }),
        ...(params.location !== undefined && { location: params.location }),
        ...(params.start !== undefined && {
          start: { dateTime: params.start, timeZone: TIMEZONE },
        }),
        ...(params.end !== undefined && {
          end: { dateTime: params.end, timeZone: TIMEZONE },
        }),
      },
    })
  } catch (err) {
    console.error('[Google Calendar] updateCalendarEvent failed:', err)
  }
}

/**
 * Deletes a Google Calendar event.
 */
export async function deleteCalendarEvent(
  botId: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const auth = await getAuthForBot(botId)
  if (!auth) return

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    await calendar.events.delete({ calendarId, eventId })
  } catch (err) {
    console.error('[Google Calendar] deleteCalendarEvent failed:', err)
  }
}

/**
 * Lists the bot's Google Calendars so the user can pick one.
 */
export async function listCalendars(
  botId: string
): Promise<{ id: string; summary: string; primary: boolean }[]> {
  const auth = await getAuthForBot(botId)
  if (!auth) return []

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    const res = await calendar.calendarList.list()
    return (res.data.items ?? []).map((c) => ({
      id: c.id ?? '',
      summary: c.summary ?? '',
      primary: c.primary ?? false,
    }))
  } catch (err) {
    console.error('[Google Calendar] listCalendars failed:', err)
    return []
  }
}
