import { createServiceClient } from '@/lib/supabase/service'
import type { FacilityType, BookingLocation, BookingStatus } from '@/lib/booking/types'

export interface CheckAndCreateParams {
  botId: string
  facilityType: FacilityType
  location: BookingLocation
  sessionStart: string   // ISO timestamp
  sessionEnd: string     // ISO timestamp
  customerName: string
  memberId: string | null
  contact: string
  isMember: boolean
  hasBes: boolean | null
  gender: 'male' | 'female' | null
  status: BookingStatus
  userId?: string | null
  channel?: string | null
}

export interface CheckAndCreateResult {
  success: boolean
  booking_id?: string
  reason?: string
}

/**
 * Atomically checks slot availability and creates a booking via Supabase RPC.
 * Uses SELECT FOR UPDATE internally to prevent double-booking race conditions.
 */
export async function checkAndCreateBooking(
  params: CheckAndCreateParams
): Promise<CheckAndCreateResult> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('check_and_create_booking', {
    p_bot_id: params.botId,
    p_facility_type: params.facilityType,
    p_location: params.location,
    p_session_start: params.sessionStart,
    p_session_end: params.sessionEnd,
    p_customer_name: params.customerName,
    p_member_id: params.memberId,
    p_contact: params.contact,
    p_is_member: params.isMember,
    p_has_bes: params.hasBes,
    p_gender: params.gender,
    p_status: params.status,
    p_user_id: params.userId ?? null,
    p_channel: params.channel ?? null,
  })

  if (error) {
    console.error('[slot-checker] checkAndCreateBooking RPC error:', error)
    return { success: false, reason: error.message }
  }

  // RPC returns { success, booking_id, reason }
  const result = data as { success: boolean; booking_id?: string; reason?: string }
  return result
}

export interface SlotWindow {
  slot_start: string
  slot_end: string
}

/**
 * Finds the next N available slots after a given date/time via Supabase RPC.
 */
export async function findNextAvailableSlots(
  botId: string,
  facilityType: FacilityType,
  location: BookingLocation,
  afterDate: string,
  limit = 3
): Promise<SlotWindow[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('find_next_available_slots', {
    p_bot_id: botId,
    p_facility_type: facilityType,
    p_location: location,
    p_after: afterDate,
    p_limit: limit,
  })

  if (error) {
    console.error('[slot-checker] findNextAvailableSlots RPC error:', error)
    return []
  }

  return (data as SlotWindow[]) ?? []
}

/**
 * Gets available time slots for a specific date by querying existing bookings
 * and comparing against the facility capacity from facilities_config.
 * Returns the list of { slot_start, slot_end } that still have capacity.
 */
export async function getAvailableSlots(
  botId: string,
  facilityType: FacilityType,
  location: BookingLocation,
  date: string // YYYY-MM-DD
): Promise<SlotWindow[]> {
  const supabase = createServiceClient()

  // 1. Get facility config for this bot + facility type
  const { data: config, error: configError } = await supabase
    .from('facilities_config')
    .select('capacity, duration_minutes, min_advance_hours, max_window_days')
    .eq('bot_id', botId)
    .eq('facility_type', facilityType)
    .single()

  if (configError || !config) {
    console.error('[slot-checker] getAvailableSlots: no facilities_config found', configError)
    return []
  }

  const { capacity, duration_minutes } = config

  // 2. Build all possible slot windows for the day (09:00-18:00 MYT, hardcoded for Malaysia)
  const possibleSlots: SlotWindow[] = []
  const startHour = 9
  const endHour = 18
  const slotDuration = duration_minutes

  for (let hour = startHour; hour < endHour; ) {
    const slotStartMinutes = hour * 60
    const slotEndMinutes = slotStartMinutes + slotDuration

    if (slotEndMinutes > endHour * 60) break

    const startH = String(Math.floor(slotStartMinutes / 60)).padStart(2, '0')
    const startM = String(slotStartMinutes % 60).padStart(2, '0')
    const endH = String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')
    const endM = String(slotEndMinutes % 60).padStart(2, '0')

    possibleSlots.push({
      slot_start: `${date}T${startH}:${startM}:00+08:00`,
      slot_end: `${date}T${endH}:${endM}:00+08:00`,
    })

    hour += slotDuration / 60
  }

  // 3. Count existing confirmed/pending bookings per slot
  const dayStart = `${date}T00:00:00+08:00`
  const dayEnd = `${date}T23:59:59+08:00`

  const { data: existingBookings, error: bookingError } = await supabase
    .from('bookings')
    .select('session_start, session_end')
    .eq('bot_id', botId)
    .eq('facility_type', facilityType)
    .eq('location', location)
    .gte('session_start', dayStart)
    .lte('session_start', dayEnd)
    .in('status', ['pending', 'confirmed'])

  if (bookingError) {
    console.error('[slot-checker] getAvailableSlots: booking query error', bookingError)
    return []
  }

  const bookings = existingBookings ?? []

  // 4. For each possible slot, count bookings that overlap and check capacity
  const availableSlots: SlotWindow[] = []

  for (const slot of possibleSlots) {
    const count = bookings.filter((b) => {
      // Count bookings that start in this slot window
      return b.session_start >= slot.slot_start && b.session_start < slot.slot_end
    }).length

    if (count < capacity) {
      availableSlots.push(slot)
    }
  }

  return availableSlots
}
