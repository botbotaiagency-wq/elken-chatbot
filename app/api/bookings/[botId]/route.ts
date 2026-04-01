import { createServiceClient } from '@/lib/supabase/service'
import { dispatchNotification } from '@/lib/booking/notifications'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/lib/booking/google-calendar'
import { FACILITY_LABELS, LOCATION_LABELS } from '@/lib/booking/types'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const url = new URL(req.url)
  const location = url.searchParams.get('location')          // 'okr' | 'subang' | null
  const status = url.searchParams.get('status')              // BookingStatus | null
  const facilityType = url.searchParams.get('facility_type') // FacilityType | null
  const dateFrom = url.searchParams.get('date_from')         // ISO date string | null
  const dateTo = url.searchParams.get('date_to')             // ISO date string | null

  const supabase = createServiceClient()

  let query = supabase
    .from('bookings')
    .select('*')
    .eq('bot_id', botId)
    .order('session_start', { ascending: false })

  if (location) query = query.eq('location', location)
  if (status) query = query.eq('status', status)
  if (facilityType) query = query.eq('facility_type', facilityType)
  if (dateFrom) query = query.gte('session_start', dateFrom)
  if (dateTo) query = query.lte('session_start', dateTo)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const body = await req.json()
  const {
    customer_name,
    member_id,
    contact_number,
    facility_type,
    location,
    session_start,
    is_member,
    has_bes_device,
    on_loan_unit,
    customer_gender,
  } = body

  // Validate required fields
  if (!customer_name || !contact_number || !facility_type || !location || !session_start) {
    return Response.json(
      { error: 'Missing required fields: customer_name, contact_number, facility_type, location, session_start' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Fetch facility config for duration
  const { data: config } = await supabase
    .from('facilities_config')
    .select('duration_minutes')
    .eq('bot_id', botId)
    .eq('facility_type', facility_type)
    .single()

  const durationMinutes = config?.duration_minutes ?? 60
  const sessionStart = new Date(session_start)
  const sessionEnd = new Date(sessionStart.getTime() + durationMinutes * 60 * 1000)

  // Use RPC for atomic walk-in creation (prevents double-booking)
  const { data, error } = await supabase.rpc('check_and_create_booking', {
    p_bot_id: botId,
    p_facility_type: facility_type,
    p_location: location,
    p_session_start: sessionStart.toISOString(),
    p_session_end: sessionEnd.toISOString(),
    p_customer_name: customer_name,
    p_member_id: member_id ?? null,
    p_contact: contact_number,
    p_is_member: is_member ?? false,
    p_has_bes: has_bes_device ?? null,
    p_gender: customer_gender ?? null,
    p_status: 'walk_in',
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (data?.success === false) {
    return Response.json({ error: data.reason }, { status: 409 })
  }

  return Response.json({ ok: true, booking_id: data.booking_id }, { status: 201 })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const body = await req.json()
  const { bookingId, action, staffName, note } = body

  if (!bookingId || !action || !staffName) {
    return Response.json(
      { error: 'Missing required fields: bookingId, action, staffName' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  if (action === 'edit') {
    // Field edit — uses update_booking_fields RPC
    const { session_start, session_end, facility_type, location: editLocation } = body
    const { data, error } = await supabase.rpc('update_booking_fields', {
      p_booking_id: bookingId,
      p_bot_id: botId,
      p_staff_name: staffName,
      p_note: note ?? '',
      p_session_start: session_start ?? null,
      p_session_end: session_end ?? null,
      p_facility_type: facility_type ?? null,
      p_location: editLocation ?? null,
    })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (data?.success === false) return Response.json({ error: data.reason }, { status: 404 })

    // Update Google Calendar event if booking has one
    syncCalendarEdit(supabase, botId, bookingId, { session_start, session_end, facility_type, location: editLocation })

    return Response.json({ ok: true })
  }

  // Status change — uses update_booking_status RPC
  if (!['confirm', 'cancel', 'no_show'].includes(action)) {
    return Response.json({ error: 'Invalid action. Must be: confirm, cancel, no_show, edit' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_bot_id: botId,
    p_action: action,
    p_staff_name: staffName,
    p_note: note ?? '',
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (data?.success === false) return Response.json({ error: data.reason }, { status: 404 })

  if (action === 'confirm') {
    // Dispatch n8n notification (fire-and-forget)
    dispatchNotification(botId, bookingId, 'confirmation').catch(err =>
      console.error(`[Booking] Failed to dispatch confirmation for ${bookingId}:`, err)
    )
    // Create Google Calendar event (fire-and-forget)
    syncCalendarConfirm(supabase, botId, bookingId)
  }

  if (action === 'cancel' || action === 'no_show') {
    // Delete Google Calendar event if one exists (fire-and-forget)
    syncCalendarCancel(supabase, botId, bookingId)
  }

  return Response.json({ ok: true })
}

// ── Google Calendar sync helpers (fire-and-forget) ──────────────────────────

type SupabaseClient = ReturnType<typeof createServiceClient>

async function syncCalendarConfirm(supabase: SupabaseClient, botId: string, bookingId: string) {
  try {
    const [{ data: booking }, { data: bot }] = await Promise.all([
      supabase
        .from('bookings')
        .select('customer_name, facility_type, location, session_start, session_end, contact_number')
        .eq('id', bookingId)
        .single(),
      supabase
        .from('bots')
        .select('google_calendar_id, name')
        .eq('id', botId)
        .single(),
    ])

    if (!booking || !bot?.google_calendar_id) return

    const facilityLabel = FACILITY_LABELS[booking.facility_type as keyof typeof FACILITY_LABELS] ?? booking.facility_type
    const locationLabel = LOCATION_LABELS[booking.location as keyof typeof LOCATION_LABELS] ?? booking.location

    const eventId = await createCalendarEvent(botId, {
      calendarId: bot.google_calendar_id,
      summary: `${facilityLabel} — ${booking.customer_name}`,
      description: `Customer: ${booking.customer_name}\nContact: ${booking.contact_number}\nLocation: ${locationLabel}\nBooking ID: ${bookingId}`,
      start: booking.session_start,
      end: booking.session_end,
      location: locationLabel,
    })

    if (eventId) {
      await supabase
        .from('bookings')
        .update({ google_calendar_event_id: eventId })
        .eq('id', bookingId)
    }
  } catch (err) {
    console.error('[Booking] syncCalendarConfirm failed:', err)
  }
}

async function syncCalendarCancel(supabase: SupabaseClient, botId: string, bookingId: string) {
  try {
    const [{ data: booking }, { data: bot }] = await Promise.all([
      supabase
        .from('bookings')
        .select('google_calendar_event_id')
        .eq('id', bookingId)
        .single(),
      supabase
        .from('bots')
        .select('google_calendar_id')
        .eq('id', botId)
        .single(),
    ])

    if (!booking?.google_calendar_event_id || !bot?.google_calendar_id) return

    await deleteCalendarEvent(botId, bot.google_calendar_id, booking.google_calendar_event_id)

    await supabase
      .from('bookings')
      .update({ google_calendar_event_id: null })
      .eq('id', bookingId)
  } catch (err) {
    console.error('[Booking] syncCalendarCancel failed:', err)
  }
}

async function syncCalendarEdit(
  supabase: SupabaseClient,
  botId: string,
  bookingId: string,
  changes: { session_start?: string; session_end?: string; facility_type?: string; location?: string }
) {
  try {
    const [{ data: booking }, { data: bot }] = await Promise.all([
      supabase
        .from('bookings')
        .select('google_calendar_event_id, customer_name, contact_number, facility_type, location, session_start, session_end')
        .eq('id', bookingId)
        .single(),
      supabase
        .from('bots')
        .select('google_calendar_id')
        .eq('id', botId)
        .single(),
    ])

    if (!booking?.google_calendar_event_id || !bot?.google_calendar_id) return

    const facilityType = changes.facility_type ?? booking.facility_type
    const location = changes.location ?? booking.location
    const facilityLabel = FACILITY_LABELS[facilityType as keyof typeof FACILITY_LABELS] ?? facilityType
    const locationLabel = LOCATION_LABELS[location as keyof typeof LOCATION_LABELS] ?? location

    await updateCalendarEvent(botId, bot.google_calendar_id, booking.google_calendar_event_id, {
      summary: `${facilityLabel} — ${booking.customer_name}`,
      description: `Customer: ${booking.customer_name}\nContact: ${booking.contact_number}\nLocation: ${locationLabel}\nBooking ID: ${bookingId}`,
      start: changes.session_start ?? booking.session_start,
      end: changes.session_end ?? booking.session_end,
      location: locationLabel,
    })
  } catch (err) {
    console.error('[Booking] syncCalendarEdit failed:', err)
  }
}
