import { createServiceClient } from '@/lib/supabase/service'
import { FACILITY_LABELS } from '@/lib/booking/types'

export type NotificationType = 'confirmation' | 'reminder' | 'survey'

export async function dispatchNotification(
  botId: string,
  bookingId: string,
  type: NotificationType
): Promise<boolean> {
  const supabase = createServiceClient()

  // 1. Fetch the booking record
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, channel, customer_name, facility_type, location, session_start, session_end')
    .eq('id', bookingId)
    .eq('bot_id', botId)
    .single()

  if (bookingError || !booking) {
    console.error(`[Notification] Booking ${bookingId} not found:`, bookingError)
    return false
  }

  // 2. Fetch the bot's n8n outbound webhook URL
  const { data: bot } = await supabase
    .from('bots')
    .select('n8n_outbound_webhook, name')
    .eq('id', botId)
    .single()

  if (!bot?.n8n_outbound_webhook) {
    console.warn(`[Notification] Bot ${botId} has no n8n_outbound_webhook configured — skipping notification`)
    return false
  }

  // 3. Build message based on notification type
  const facilityLabel = FACILITY_LABELS[booking.facility_type as keyof typeof FACILITY_LABELS] ?? booking.facility_type
  const locationLabel = booking.location === 'okr' ? 'GenQi Old Klang Road' : 'GenQi Subang'
  const sessionDate = new Date(booking.session_start).toLocaleDateString('en-MY', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  const sessionTime = new Date(booking.session_start).toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })

  let message = ''

  switch (type) {
    case 'confirmation':
      message = `Hi ${booking.customer_name}, your booking has been confirmed!\n\nFacility: ${facilityLabel}\nLocation: ${locationLabel}\nDate: ${sessionDate}\nTime: ${sessionTime}\n\nPlease arrive 10 minutes early. See you there!`
      break
    case 'reminder':
      message = `Hi ${booking.customer_name}, this is a reminder about your booking tomorrow.\n\nFacility: ${facilityLabel}\nLocation: ${locationLabel}\nDate: ${sessionDate}\nTime: ${sessionTime}\n\nWe look forward to seeing you!`
      break
    case 'survey':
      message = `Hi ${booking.customer_name}, thank you for visiting ${locationLabel} today!\n\nWe'd love to hear about your experience. Please rate your session:\n1. Excellent\n2. Good\n3. Average\n4. Poor\n\nReply with a number to share your feedback.`
      break
  }

  // 4. POST to n8n outbound webhook
  try {
    const response = await fetch(bot.n8n_outbound_webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: booking.user_id,
        channel: booking.channel,
        message,
        type,
        bookingId: booking.id,
        botName: bot.name,
      }),
    })

    if (!response.ok) {
      console.error(`[Notification] n8n webhook returned ${response.status} for booking ${bookingId}`)
      return false
    }

    return true
  } catch (error) {
    console.error(`[Notification] Failed to dispatch ${type} for booking ${bookingId}:`, error)
    return false
  }
}
