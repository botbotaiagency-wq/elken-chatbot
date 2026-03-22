import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Analytics query functions.
 * Each function returns { data, error } from Supabase.
 * The API route handles error responses.
 */

export async function getMessageVolume(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string
) {
  return supabase.rpc('get_message_volume', {
    p_bot_id: botId,
    p_from: from,
    p_to: to,
  })
}

export async function getIntentBreakdown(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string
) {
  return supabase.rpc('get_intent_breakdown', {
    p_bot_id: botId,
    p_from: from,
    p_to: to,
  })
}

export async function getUnansweredQueries(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string
) {
  return supabase.rpc('get_unanswered_queries', {
    p_bot_id: botId,
    p_from: from,
    p_to: to,
  })
}

export async function getLatencyStats(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string
) {
  return supabase.rpc('get_latency_stats', {
    p_bot_id: botId,
    p_from: from,
    p_to: to,
  })
}

export async function getBookingFunnel(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string
) {
  return supabase.rpc('get_booking_funnel', {
    p_bot_id: botId,
    p_from: from,
    p_to: to,
  })
}

export async function getConfirmedBookings(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string,
  location?: string
) {
  let query = supabase
    .from('bookings')
    .select('*')
    .eq('bot_id', botId)
    .eq('status', 'confirmed')
    .gte('created_at', from)
    .lte('created_at', to)

  if (location && location !== 'all') {
    query = query.eq('location', location)
  }

  return query.order('created_at', { ascending: false })
}

export async function getCancellations(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string
) {
  return supabase
    .from('bookings')
    .select('*')
    .eq('bot_id', botId)
    .eq('status', 'cancelled')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
}

export async function getFacilityBreakdown(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string
) {
  const { data, error } = await supabase
    .from('bookings')
    .select('facility_type')
    .eq('bot_id', botId)
    .gte('created_at', from)
    .lte('created_at', to)

  if (error || !data) return { data, error }

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.facility_type] = (counts[row.facility_type] ?? 0) + 1
  }

  const result = Object.entries(counts).map(([facility_type, count]) => ({
    facility_type,
    count,
  }))

  return { data: result, error: null }
}

export async function getLocationVolume(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string
) {
  const { data, error } = await supabase
    .from('bookings')
    .select('location')
    .eq('bot_id', botId)
    .gte('created_at', from)
    .lte('created_at', to)

  if (error || !data) return { data, error }

  const result: Record<string, number> = {}
  for (const row of data) {
    result[row.location] = (result[row.location] ?? 0) + 1
  }

  return { data: result, error: null }
}

export async function getAuditTrail(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string
) {
  return supabase
    .from('bookings')
    .select('id, customer_name, facility_type, location, status, audit_log, created_at')
    .eq('bot_id', botId)
    .gte('created_at', from)
    .lte('created_at', to)
    .not('audit_log', 'eq', '[]')
    .order('created_at', { ascending: false })
}

export async function getSurveyResponses(
  supabase: SupabaseClient,
  botId: string,
  from: string,
  to: string
) {
  return supabase
    .from('bookings')
    .select('id, customer_name, facility_type, location, session_start, survey_response, created_at')
    .eq('bot_id', botId)
    .gte('created_at', from)
    .lte('created_at', to)
    .not('survey_response', 'is', null)
    .order('created_at', { ascending: false })
}
