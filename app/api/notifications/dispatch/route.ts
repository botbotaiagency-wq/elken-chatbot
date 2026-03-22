import { createServiceClient } from '@/lib/supabase/service'
import { dispatchNotification } from '@/lib/booking/notifications'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // 1. Validate CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Skip non-production environments
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return Response.json({ skipped: true, env: process.env.VERCEL_ENV })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const plus23h = new Date(now.getTime() + 23 * 3600 * 1000).toISOString()
  const plus25h = new Date(now.getTime() + 25 * 3600 * 1000).toISOString()

  let remindersSent = 0
  let remindersFailed = 0
  let surveysSent = 0
  let surveysFailed = 0

  // 3. Process reminders due (23-25 hours before session_start)
  const { data: remindersDue } = await supabase
    .from('bookings')
    .select('id, bot_id, reminder_retry_count')
    .eq('reminder_sent', false)
    .eq('status', 'confirmed')
    .lt('reminder_retry_count', 3)
    .gte('session_start', plus23h)
    .lte('session_start', plus25h)

  for (const booking of remindersDue ?? []) {
    const sent = await dispatchNotification(booking.bot_id, booking.id, 'reminder')
    if (sent) {
      await supabase
        .from('bookings')
        .update({
          reminder_sent: true,
          reminder_sent_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', booking.id)
      remindersSent++
    } else {
      const newRetryCount = booking.reminder_retry_count + 1
      await supabase
        .from('bookings')
        .update({
          reminder_retry_count: newRetryCount,
          updated_at: now.toISOString(),
        })
        .eq('id', booking.id)
      remindersFailed++
    }
  }

  // 4. Process surveys due (session_start < now, completed sessions)
  const { data: surveysDue } = await supabase
    .from('bookings')
    .select('id, bot_id, survey_retry_count')
    .eq('survey_sent', false)
    .in('status', ['confirmed', 'walk_in'])
    .lt('survey_retry_count', 3)
    .lt('session_start', now.toISOString())

  for (const booking of surveysDue ?? []) {
    const sent = await dispatchNotification(booking.bot_id, booking.id, 'survey')
    if (sent) {
      await supabase
        .from('bookings')
        .update({
          survey_sent: true,
          survey_sent_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', booking.id)
      surveysSent++
    } else {
      const newRetryCount = booking.survey_retry_count + 1
      await supabase
        .from('bookings')
        .update({
          survey_retry_count: newRetryCount,
          updated_at: now.toISOString(),
        })
        .eq('id', booking.id)
      surveysFailed++
    }
  }

  return Response.json({
    ok: true,
    timestamp: now.toISOString(),
    reminders: { sent: remindersSent, failed: remindersFailed, queued: (remindersDue ?? []).length },
    surveys: { sent: surveysSent, failed: surveysFailed, queued: (surveysDue ?? []).length },
  })
}
