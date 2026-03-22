import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const body = await req.json()
  const { bookingId, userId, rating, feedback } = body as {
    bookingId?: string
    userId?: string
    rating?: number
    feedback?: string
  }

  if (!bookingId && !userId) {
    return Response.json(
      { error: 'Either bookingId or userId is required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Find the booking — by bookingId directly, or by userId (most recent completed booking)
  let bookingQuery = supabase
    .from('bookings')
    .select('id')
    .eq('bot_id', botId)

  if (bookingId) {
    bookingQuery = bookingQuery.eq('id', bookingId)
  } else if (userId) {
    bookingQuery = bookingQuery
      .eq('user_id', userId)
      .eq('survey_sent', true)
      .is('survey_response', null)
      .order('session_start', { ascending: false })
      .limit(1)
  }

  const { data: booking, error: findError } = await bookingQuery.maybeSingle()

  if (findError || !booking) {
    return Response.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Store survey response
  const surveyData = {
    rating: rating ?? null,
    feedback: feedback ?? null,
    submitted_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      survey_response: surveyData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
    .eq('bot_id', botId)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  return Response.json({ ok: true, bookingId: booking.id })
}
