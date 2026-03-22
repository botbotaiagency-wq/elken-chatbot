export type BookingStep =
  | 'facility'
  | 'location'
  | 'datetime'
  | 'details'
  | 'summary'
  | 'confirmed'
  | 'expired'

export type FacilityType =
  | 'bed_female'
  | 'bed_male'
  | 'bed_unisex'
  | 'inhaler'
  | 'room_small'
  | 'room_large'

export type BookingLocation = 'okr' | 'subang'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'walk_in'

export interface BookingState {
  step: BookingStep
  facility_type?: FacilityType
  location?: BookingLocation
  session_date?: string       // ISO date string YYYY-MM-DD
  session_time?: string       // 'HH:MM' 24-hour format
  customer_name?: string
  member_id?: string
  contact_number?: string
  is_member?: boolean
  has_bes_device?: boolean
  on_loan_unit?: string
  customer_gender?: 'male' | 'female'
  started_at: string          // ISO timestamp for TTL check
  last_activity_at: string    // ISO timestamp updated on every message
}

export interface AuditLogEntry {
  action: string
  by: string
  at: string
  note: string
}

export interface Booking {
  id: string
  bot_id: string
  facility_type: FacilityType
  location: BookingLocation
  session_start: string
  session_end: string
  customer_name: string
  member_id: string | null
  contact_number: string
  is_member: boolean
  has_bes_device: boolean | null
  on_loan_unit: string | null
  customer_gender: 'male' | 'female' | null
  status: BookingStatus
  user_id: string | null
  channel: string | null
  conversation_id: string | null
  audit_log: AuditLogEntry[]
  reminder_sent: boolean
  reminder_sent_at: string | null
  reminder_retry_count: number
  survey_sent: boolean
  survey_sent_at: string | null
  survey_retry_count: number
  survey_response: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface FacilityConfig {
  id: string
  bot_id: string
  facility_type: FacilityType
  capacity: number
  duration_minutes: number
  min_advance_hours: number
  max_window_days: number
  created_at: string
}

export interface StepResult {
  response: string
  nextState: BookingState
  createBooking?: boolean
}

export const FACILITY_LABELS: Record<FacilityType, string> = {
  bed_female: 'Bed (Female)',
  bed_male: 'Bed (Male)',
  bed_unisex: 'Bed (Unisex)',
  inhaler: 'Inhaler',
  room_small: 'Meeting Room Small (max 8 pax)',
  room_large: 'Meeting Room Large (max 50 pax)',
}

export const FACILITY_LOCATION_CONSTRAINTS: Record<FacilityType, BookingLocation[]> = {
  bed_female: ['okr', 'subang'],
  bed_male: ['okr', 'subang'],
  bed_unisex: ['subang'],
  inhaler: ['okr', 'subang'],
  room_small: ['okr'],
  room_large: ['okr'],
}

export const LOCATION_LABELS: Record<BookingLocation, string> = {
  okr: 'GenQi Old Klang Road',
  subang: 'GenQi Subang',
}
