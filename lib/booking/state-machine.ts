import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import {
  FACILITY_LABELS,
  FACILITY_LOCATION_CONSTRAINTS,
  LOCATION_LABELS,
  type BookingState,
  type FacilityType,
  type BookingLocation,
} from '@/lib/booking/types'
import {
  checkAndCreateBooking,
  findNextAvailableSlots,
  getAvailableSlots,
} from '@/lib/booking/slot-checker'
import { retrieveContext } from '@/lib/rag/retrieve'
import { buildSystemPrompt } from '@/lib/rag/prompt'

// 30-minute TTL in milliseconds
const BOOKING_TTL_MS = 30 * 60 * 1000

/**
 * Returns true if the booking state has been inactive for more than 30 minutes.
 */
export function isBookingExpired(state: BookingState): boolean {
  const lastActivity = new Date(state.last_activity_at).getTime()
  return Date.now() - lastActivity > BOOKING_TTL_MS
}

interface HandleBookingFlowParams {
  conversationId: string
  botId: string
  message: string
  state: BookingState | null
  detection: { intent: string; language: string }
  userId: string
  channel: string
}

interface HandleBookingFlowResult {
  response: string
  updatedState: BookingState | null
}

/**
 * Main booking conversation handler. Routes the message to the appropriate step handler.
 * Persists updated state to conversations.metadata.
 */
export async function handleBookingFlow(
  params: HandleBookingFlowParams
): Promise<HandleBookingFlowResult> {
  const { conversationId, botId, message, state, detection, userId: _userId, channel: _channel } = params
  const supabase = createServiceClient()

  // --- New booking session ---
  if (state === null) {
    const newState: BookingState = {
      step: 'facility',
      started_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    }

    await persistState(supabase, conversationId, newState)

    const facilityList = buildFacilityList()
    const response = `I'd be happy to help you book a session! Please select a facility type:\n\n${facilityList}\n\nPlease reply with the number of your choice.`

    return { response, updatedState: newState }
  }

  // --- Existing session ---
  // Always update last_activity_at
  const updatedState: BookingState = {
    ...state,
    last_activity_at: new Date().toISOString(),
  }

  // Route to the correct step handler
  let result: { response: string; nextState: BookingState | null }

  switch (updatedState.step) {
    case 'facility':
      result = await handleFacilityStep(message, updatedState)
      break
    case 'location':
      result = await handleLocationStep(message, updatedState)
      break
    case 'datetime':
      result = await handleDatetimeStep(message, updatedState, botId)
      break
    case 'details':
      result = await handleDetailsStep(message, updatedState)
      break
    case 'summary':
      result = await handleSummaryStep(message, updatedState, botId, conversationId)
      break
    case 'confirmed':
    case 'expired':
      // State was already confirmed/expired — clear it and return fresh start prompt
      await persistState(supabase, conversationId, null)
      return {
        response: 'Your previous booking session has ended. You can start a new booking anytime by asking to book a session.',
        updatedState: null,
      }
    default:
      result = { response: 'Something went wrong with your booking. Please start over.', nextState: null }
  }

  // Check if this was an off-topic message that returned unchanged state — handle it
  if (result.nextState && result.nextState === updatedState && result.response.startsWith('__OFF_TOPIC__')) {
    // Off-topic handling was triggered — the response already has the RAG answer + re-prompt
    const ragResponse = result.response.replace('__OFF_TOPIC__', '').trim()
    await persistState(supabase, conversationId, updatedState)
    return { response: ragResponse, updatedState }
  }

  // Persist final state (null means booking is complete/cancelled)
  await persistState(supabase, conversationId, result.nextState)

  return { response: result.response, updatedState: result.nextState }
}

// --- Step Handlers ---

async function handleFacilityStep(
  message: string,
  state: BookingState
): Promise<{ response: string; nextState: BookingState | null }> {
  const facilityTypes: FacilityType[] = [
    'bed_female',
    'bed_male',
    'bed_unisex',
    'inhaler',
    'room_small',
    'room_large',
  ]

  const selected = parseFacilitySelection(message, facilityTypes)

  if (!selected) {
    // Check for off-topic
    if (isLikelyOffTopic(message, state.step)) {
      const ragResponse = await handleOffTopic(message)
      const reprompt = `\n\nTo continue your booking, please select a facility type:\n\n${buildFacilityList()}\n\nPlease reply with the number of your choice.`
      return { response: ragResponse + reprompt, nextState: state }
    }

    return {
      response: `I didn't understand your selection. Please reply with a number from 1 to 6:\n\n${buildFacilityList()}`,
      nextState: state,
    }
  }

  const facilityType = selected
  const validLocations = FACILITY_LOCATION_CONSTRAINTS[facilityType]

  const updatedState: BookingState = { ...state, facility_type: facilityType }

  // If only one location is valid, auto-select it and skip to datetime
  if (validLocations.length === 1) {
    const autoLocation = validLocations[0]
    const stateWithLocation: BookingState = {
      ...updatedState,
      location: autoLocation,
      step: 'datetime',
    }

    return {
      response: `Great! You've selected *${FACILITY_LABELS[facilityType]}*.\n\nThis facility is available at *${LOCATION_LABELS[autoLocation]}* only.\n\nPlease enter your preferred date (e.g., 2026-03-25) or type 'today' or 'tomorrow':`,
      nextState: stateWithLocation,
    }
  }

  // Multiple locations — ask user to choose
  const locationList = buildLocationList(validLocations)
  return {
    response: `Great! You've selected *${FACILITY_LABELS[facilityType]}*.\n\nPlease select a location:\n\n${locationList}\n\nPlease reply with the number of your choice.`,
    nextState: { ...updatedState, step: 'location' },
  }
}

async function handleLocationStep(
  message: string,
  state: BookingState
): Promise<{ response: string; nextState: BookingState | null }> {
  if (!state.facility_type) {
    return { response: 'Sorry, something went wrong. Please start your booking again.', nextState: null }
  }

  const validLocations = FACILITY_LOCATION_CONSTRAINTS[state.facility_type]
  const selected = parseLocationSelection(message, validLocations)

  if (!selected) {
    if (isLikelyOffTopic(message, state.step)) {
      const ragResponse = await handleOffTopic(message)
      const locationList = buildLocationList(validLocations)
      const reprompt = `\n\nTo continue your booking, please select a location:\n\n${locationList}`
      return { response: ragResponse + reprompt, nextState: state }
    }

    const locationList = buildLocationList(validLocations)
    return {
      response: `I didn't understand your selection. Please choose a location:\n\n${locationList}`,
      nextState: state,
    }
  }

  return {
    response: `Perfect! You've selected *${LOCATION_LABELS[selected]}*.\n\nPlease enter your preferred date (e.g., 2026-03-25) or type 'today' or 'tomorrow':`,
    nextState: { ...state, location: selected, step: 'datetime' },
  }
}

async function handleDatetimeStep(
  message: string,
  state: BookingState,
  botId: string
): Promise<{ response: string; nextState: BookingState | null }> {
  if (!state.facility_type || !state.location) {
    return { response: 'Sorry, something went wrong. Please start your booking again.', nextState: null }
  }

  // If state already has a date but no time — user is selecting a slot number
  if (state.session_date && !state.session_time) {
    return await handleSlotSelection(message, state, botId)
  }

  // Otherwise — user is entering a date
  const date = parseDateInput(message)

  if (!date) {
    if (isLikelyOffTopic(message, state.step)) {
      const ragResponse = await handleOffTopic(message)
      const reprompt = `\n\nTo continue your booking, please enter your preferred date (e.g., 2026-03-25) or type 'today' or 'tomorrow':`
      return { response: ragResponse + reprompt, nextState: state }
    }

    return {
      response: `I didn't recognise that date. Please enter a date in the format YYYY-MM-DD (e.g., ${getExampleDate()}), or type 'today' or 'tomorrow':`,
      nextState: state,
    }
  }

  // Validate date constraints from facilities_config
  const constraintError = await validateDateConstraints(botId, state.facility_type, date)
  if (constraintError) {
    return { response: constraintError, nextState: state }
  }

  // Get available slots for the date
  const slots = await getAvailableSlots(botId, state.facility_type, state.location, date)

  if (slots.length === 0) {
    return {
      response: `No available slots on ${date}. Would you like to try another date? Please enter a different date:`,
      nextState: state,
    }
  }

  const slotList = slots
    .map((s, i) => `${i + 1}. ${formatTime(s.slot_start)} - ${formatTime(s.slot_end)}`)
    .join('\n')

  const stateWithSlots: BookingState = {
    ...state,
    session_date: date,
    // Store available slots temporarily in the state for selection
  }

  // We store the available slots count in a temp key via on_loan_unit hack (or just expect user to enter number)
  return {
    response: `Here are the available time slots for ${date}:\n\n${slotList}\n\nPlease reply with the number of your preferred time slot, or enter a different date:`,
    nextState: { ...stateWithSlots, on_loan_unit: JSON.stringify(slots) },
  }
}

async function handleSlotSelection(
  message: string,
  state: BookingState,
  botId: string
): Promise<{ response: string; nextState: BookingState | null }> {
  if (!state.facility_type || !state.location || !state.session_date) {
    return { response: 'Sorry, something went wrong. Please start your booking again.', nextState: null }
  }

  // Check if user wants a different date
  const newDate = parseDateInput(message)
  if (newDate) {
    const constraintError = await validateDateConstraints(botId, state.facility_type, newDate)
    if (constraintError) {
      return { response: constraintError, nextState: state }
    }

    const slots = await getAvailableSlots(botId, state.facility_type, state.location, newDate)
    if (slots.length === 0) {
      return {
        response: `No available slots on ${newDate}. Please try another date:`,
        nextState: { ...state, session_date: undefined, on_loan_unit: undefined },
      }
    }

    const slotList = slots
      .map((s, i) => `${i + 1}. ${formatTime(s.slot_start)} - ${formatTime(s.slot_end)}`)
      .join('\n')

    return {
      response: `Here are the available time slots for ${newDate}:\n\n${slotList}\n\nPlease reply with the number of your preferred time slot:`,
      nextState: { ...state, session_date: newDate, on_loan_unit: JSON.stringify(slots) },
    }
  }

  // Parse slot number selection
  const slots: { slot_start: string; slot_end: string }[] = state.on_loan_unit
    ? JSON.parse(state.on_loan_unit)
    : []

  const num = parseNumberInput(message)

  if (!num || num < 1 || num > slots.length) {
    if (isLikelyOffTopic(message, state.step)) {
      const ragResponse = await handleOffTopic(message)
      const slotList = slots
        .map((s, i) => `${i + 1}. ${formatTime(s.slot_start)} - ${formatTime(s.slot_end)}`)
        .join('\n')
      const reprompt = `\n\nTo continue your booking, please select a time slot:\n\n${slotList}`
      return { response: ragResponse + reprompt, nextState: state }
    }

    const slotList = slots.length > 0
      ? slots.map((s, i) => `${i + 1}. ${formatTime(s.slot_start)} - ${formatTime(s.slot_end)}`).join('\n')
      : 'No slots loaded. Please enter a date to see available slots:'

    return {
      response: `Please reply with a number from 1 to ${slots.length}:\n\n${slotList}`,
      nextState: state,
    }
  }

  const selectedSlot = slots[num - 1]
  const sessionTime = formatTime(selectedSlot.slot_start)

  return {
    response: buildDetailsPrompt(state.facility_type),
    nextState: {
      ...state,
      session_time: sessionTime,
      on_loan_unit: undefined, // Clear temp slot storage
      step: 'details',
    },
  }
}

async function handleDetailsStep(
  message: string,
  state: BookingState
): Promise<{ response: string; nextState: BookingState | null }> {
  if (!state.facility_type) {
    return { response: 'Sorry, something went wrong. Please start your booking again.', nextState: null }
  }

  // Check if this looks like a details response
  const parsed = parseDetailsResponse(message, state.facility_type)

  if (!parsed.customer_name || !parsed.contact_number) {
    if (isLikelyOffTopic(message, state.step)) {
      const ragResponse = await handleOffTopic(message)
      const reprompt = `\n\nTo continue your booking, please provide your details:\n\n${buildDetailsPrompt(state.facility_type)}`
      return { response: ragResponse + reprompt, nextState: state }
    }

    return {
      response: `I need at least your full name and contact number. Please provide the following details:\n\n${buildDetailsPrompt(state.facility_type)}`,
      nextState: state,
    }
  }

  // Determine gender from facility type
  let customer_gender: 'male' | 'female' | undefined
  if (state.facility_type === 'bed_female') {
    customer_gender = 'female'
  } else if (state.facility_type === 'bed_male') {
    customer_gender = 'male'
  } else if (state.facility_type === 'bed_unisex') {
    // Try to infer from message, default to undefined (will be handled by staff)
    customer_gender = parsed.customer_gender
  }

  // Meeting Room + Non-member check
  const isMeetingRoom = state.facility_type === 'room_small' || state.facility_type === 'room_large'
  if (isMeetingRoom && parsed.is_member === false) {
    return {
      response: `Meeting rooms are available to Elken members only. Please provide your Member ID or select a different facility.\n\nWould you like to:\n1. Provide your Member ID\n2. Cancel and select a different facility`,
      nextState: state,
    }
  }

  const updatedState: BookingState = {
    ...state,
    customer_name: parsed.customer_name,
    member_id: parsed.member_id ?? undefined,
    contact_number: parsed.contact_number,
    is_member: parsed.is_member ?? false,
    has_bes_device: parsed.has_bes_device,
    customer_gender,
    step: 'summary',
  }

  return {
    response: buildSummary(updatedState),
    nextState: updatedState,
  }
}

async function handleSummaryStep(
  message: string,
  state: BookingState,
  botId: string,
  conversationId: string
): Promise<{ response: string; nextState: BookingState | null }> {
  const normalised = message.trim().toLowerCase()

  if (normalised === 'cancel' || normalised.includes('cancel')) {
    return {
      response: 'Booking cancelled. You can start a new booking anytime by asking to book a session.',
      nextState: null,
    }
  }

  if (
    normalised === 'confirm' ||
    normalised === 'yes' ||
    normalised === 'ok' ||
    normalised.startsWith('yes') ||
    normalised.startsWith('confirm')
  ) {
    return await confirmBooking(state, botId, conversationId)
  }

  // Not a valid response — re-prompt
  return {
    response: `${buildSummary(state)}\n\nPlease type *confirm* to submit your booking, or *cancel* to start over.`,
    nextState: state,
  }
}

async function confirmBooking(
  state: BookingState,
  botId: string,
  conversationId: string
): Promise<{ response: string; nextState: BookingState | null }> {
  if (
    !state.facility_type ||
    !state.location ||
    !state.session_date ||
    !state.session_time ||
    !state.customer_name ||
    !state.contact_number
  ) {
    return {
      response: 'Some booking details are missing. Please start your booking again.',
      nextState: null,
    }
  }

  // Build session_start and session_end ISO timestamps
  const sessionStart = buildISOTimestamp(state.session_date, state.session_time)

  // Get duration from facilities_config
  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from('facilities_config')
    .select('duration_minutes')
    .eq('bot_id', botId)
    .eq('facility_type', state.facility_type)
    .single()

  const durationMinutes = config?.duration_minutes ?? 60
  const sessionEnd = addMinutesToISOTimestamp(sessionStart, durationMinutes)

  const result = await checkAndCreateBooking({
    botId,
    facilityType: state.facility_type,
    location: state.location,
    sessionStart,
    sessionEnd,
    customerName: state.customer_name,
    memberId: state.member_id ?? null,
    contact: state.contact_number,
    isMember: state.is_member ?? false,
    hasBes: state.has_bes_device ?? null,
    gender: state.customer_gender ?? null,
    status: 'pending',
  })

  if (result.success) {
    const confirmedState: BookingState = { ...state, step: 'confirmed' }

    // Determine confirmation message based on facility type and membership
    let confirmMsg: string

    const isMeetingRoom = state.facility_type === 'room_small' || state.facility_type === 'room_large'
    const isBedOrInhaler = ['bed_female', 'bed_male', 'bed_unisex', 'inhaler'].includes(state.facility_type)

    if (isMeetingRoom) {
      confirmMsg = 'Your booking has been submitted for staff approval. You will receive a confirmation message once approved.'
    } else if (isBedOrInhaler && state.is_member) {
      confirmMsg = 'Your booking has been submitted for staff approval. You will receive a confirmation message once approved.'
    } else if (isBedOrInhaler && !state.is_member) {
      confirmMsg = 'Thank you! Our specialist will contact you within 24 hours to complete your booking.'
    } else {
      confirmMsg = 'Your booking has been submitted. You will be contacted shortly.'
    }

    return {
      response: `Booking confirmed!\n\n${confirmMsg}\n\nBooking reference: ${result.booking_id ?? 'N/A'}`,
      nextState: null, // Clear state after confirmation
    }

    void confirmedState // mark as used (we clear state)
  }

  // Slot not available
  const reason = result.reason ?? 'slot_full'

  if (reason === 'slot_full' || reason.includes('full') || reason.includes('capacity')) {
    const alternatives = await findNextAvailableSlots(
      botId,
      state.facility_type,
      state.location,
      sessionStart,
      3
    )

    if (alternatives.length > 0) {
      const altList = alternatives
        .map((s, i) => `${i + 1}. ${formatDateTime(s.slot_start)}`)
        .join('\n')

      return {
        response: `That slot is no longer available. Here are the next 3 available times:\n\n${altList}\n\nPlease select a number or enter a different date:`,
        nextState: { ...state, step: 'datetime', session_date: undefined, session_time: undefined, on_loan_unit: undefined },
      }
    }

    return {
      response: 'That slot is no longer available and no alternatives were found. Please choose a different date.',
      nextState: { ...state, step: 'datetime', session_date: undefined, session_time: undefined, on_loan_unit: undefined },
    }
  }

  if (reason.includes('gender')) {
    const alternatives = await findNextAvailableSlots(
      botId,
      state.facility_type,
      state.location,
      sessionStart,
      3
    )

    const altList = alternatives.length > 0
      ? '\n\nAlternative slots:\n' + alternatives.map((s, i) => `${i + 1}. ${formatDateTime(s.slot_start)}`).join('\n')
      : ''

    return {
      response: `That time slot already has a booking for a different gender group. Unisex beds cannot mix genders at the same time.${altList}\n\nPlease select an alternative or enter a different date:`,
      nextState: { ...state, step: 'datetime', session_date: undefined, session_time: undefined, on_loan_unit: undefined },
    }
  }

  return {
    response: `Sorry, we couldn't process your booking: ${reason}. Please try again or contact us directly.`,
    nextState: null,
  }

  void conversationId // available for future audit logging
}

// --- State Persistence ---

async function persistState(
  supabase: ReturnType<typeof createServiceClient>,
  conversationId: string,
  state: BookingState | null
) {
  await supabase
    .from('conversations')
    .update({
      metadata: state ? { booking: state } : {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
}

// --- Off-Topic Handler ---

async function handleOffTopic(message: string): Promise<string> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const offTopicResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: message }],
      system:
        'You are a helpful customer service assistant for an Elken wellness centre. Answer the user\'s question concisely. If you don\'t have specific information, provide a helpful general response and suggest contacting the centre directly.',
    })

    const text = (offTopicResponse.content[0] as { type: 'text'; text: string }).text
    return text
  } catch (err) {
    console.error('[state-machine] handleOffTopic error:', err)
    return "I'm sorry, I couldn't process that question right now."
  }
}

// --- Helpers ---

function buildFacilityList(): string {
  const facilityTypes: FacilityType[] = [
    'bed_female',
    'bed_male',
    'bed_unisex',
    'inhaler',
    'room_small',
    'room_large',
  ]
  return facilityTypes.map((f, i) => `${i + 1}. ${FACILITY_LABELS[f]}`).join('\n')
}

function buildLocationList(locations: BookingLocation[]): string {
  return locations.map((l, i) => `${i + 1}. ${LOCATION_LABELS[l]}`).join('\n')
}

function buildDetailsPrompt(facilityType: FacilityType): string {
  const isBed = facilityType.startsWith('bed')
  const isInhaler = facilityType === 'inhaler'
  const needsBes = isBed || isInhaler

  const lines = [
    '- Full Name:',
    '- Member ID (if Elken member, or type N/A):',
    '- Contact Number:',
    '- Are you an Elken member? (Yes/No):',
  ]

  if (needsBes) {
    lines.push('- Do you have a BES device? (Yes/No):')
  }

  return lines.join('\n')
}

function buildSummary(state: BookingState): string {
  if (!state.facility_type || !state.location || !state.session_date || !state.session_time) {
    return 'Booking summary is incomplete.'
  }

  const lines = [
    "Here's your booking summary:",
    '',
    `- Facility: ${FACILITY_LABELS[state.facility_type]}`,
    `- Location: ${LOCATION_LABELS[state.location]}`,
    `- Date & Time: ${state.session_date} at ${state.session_time}`,
    `- Name: ${state.customer_name ?? 'Not provided'}`,
    `- Member ID: ${state.member_id ?? 'N/A'}`,
    `- Contact: ${state.contact_number ?? 'Not provided'}`,
    `- Elken Member: ${state.is_member ? 'Yes' : 'No'}`,
  ]

  const needsBes = state.facility_type.startsWith('bed') || state.facility_type === 'inhaler'
  if (needsBes && state.has_bes_device !== undefined) {
    lines.push(`- BES Device: ${state.has_bes_device ? 'Yes' : 'No'}`)
  }

  lines.push('')
  lines.push("Please type 'confirm' to submit your booking, or 'cancel' to start over.")

  return lines.join('\n')
}

// --- Parsers ---

function parseFacilitySelection(message: string, facilities: FacilityType[]): FacilityType | null {
  const trimmed = message.trim()

  // Try numeric selection
  const num = parseInt(trimmed, 10)
  if (!isNaN(num) && num >= 1 && num <= facilities.length) {
    return facilities[num - 1]
  }

  // Try text match against labels
  const lower = trimmed.toLowerCase()
  for (const f of facilities) {
    if (FACILITY_LABELS[f].toLowerCase().includes(lower) || lower.includes(FACILITY_LABELS[f].toLowerCase())) {
      return f
    }
  }

  return null
}

function parseLocationSelection(message: string, locations: BookingLocation[]): BookingLocation | null {
  const trimmed = message.trim()

  // Try numeric selection
  const num = parseInt(trimmed, 10)
  if (!isNaN(num) && num >= 1 && num <= locations.length) {
    return locations[num - 1]
  }

  // Try text match
  const lower = trimmed.toLowerCase()
  for (const l of locations) {
    if (LOCATION_LABELS[l].toLowerCase().includes(lower) || lower.includes(l)) {
      return l
    }
  }

  return null
}

function parseDateInput(message: string): string | null {
  const trimmed = message.trim().toLowerCase()

  if (trimmed === 'today') {
    return getTodayDate()
  }

  if (trimmed === 'tomorrow') {
    return getTomorrowDate()
  }

  // Match YYYY-MM-DD
  const match = trimmed.match(/(\d{4}-\d{2}-\d{2})/)
  if (match) {
    const dateStr = match[1]
    // Validate it's a real date
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      return dateStr
    }
  }

  // Match DD/MM/YYYY or DD-MM-YYYY
  const altMatch = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (altMatch) {
    const day = altMatch[1].padStart(2, '0')
    const month = altMatch[2].padStart(2, '0')
    const year = altMatch[3]
    const dateStr = `${year}-${month}-${day}`
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      return dateStr
    }
  }

  return null
}

interface ParsedDetails {
  customer_name?: string
  member_id?: string
  contact_number?: string
  is_member?: boolean
  has_bes_device?: boolean
  customer_gender?: 'male' | 'female'
}

function parseDetailsResponse(message: string, facilityType: FacilityType): ParsedDetails {
  const result: ParsedDetails = {}
  const lines = message.split('\n').map((l) => l.trim()).filter(Boolean)

  for (const line of lines) {
    const lower = line.toLowerCase()

    // Full Name
    const nameMatch = line.match(/(?:full\s*name|name)\s*[:：]\s*(.+)/i)
    if (nameMatch) {
      result.customer_name = nameMatch[1].trim()
      continue
    }

    // Member ID
    const memberIdMatch = line.match(/member\s*id\s*[:：]\s*(.+)/i)
    if (memberIdMatch) {
      const val = memberIdMatch[1].trim()
      result.member_id = val.toLowerCase() === 'n/a' || val.toLowerCase() === 'na' ? undefined : val
      continue
    }

    // Contact
    const contactMatch = line.match(/(?:contact|phone|number|tel)\s*(?:number)?\s*[:：]\s*(.+)/i)
    if (contactMatch) {
      result.contact_number = contactMatch[1].trim()
      continue
    }

    // Is member
    if (lower.includes('elken member') || lower.includes('member?') || lower.includes('are you')) {
      if (lower.includes('yes') || lower.includes('ya') || lower.includes('true')) {
        result.is_member = true
      } else if (lower.includes('no') || lower.includes('tidak') || lower.includes('false')) {
        result.is_member = false
      }
      continue
    }

    // BES device
    const needsBes = facilityType.startsWith('bed') || facilityType === 'inhaler'
    if (needsBes && (lower.includes('bes') || lower.includes('device'))) {
      if (lower.includes('yes') || lower.includes('ya') || lower.includes('have')) {
        result.has_bes_device = true
      } else if (lower.includes('no') || lower.includes('tidak') || lower.includes("don't") || lower.includes('dont')) {
        result.has_bes_device = false
      }
      continue
    }
  }

  // Fallback: if message is a single line or freeform, try to extract phone number
  if (!result.contact_number) {
    const phoneMatch = message.match(/(\+?6?\d[\d\s\-]{7,14}\d)/)
    if (phoneMatch) {
      result.contact_number = phoneMatch[1].replace(/\s/g, '')
    }
  }

  // Fallback: if no name extracted and single-line, first segment might be name
  if (!result.customer_name && lines.length === 1) {
    const nameOnly = lines[0].replace(/(\+?6?\d[\d\s\-]{7,14}\d)/, '').trim()
    if (nameOnly.length > 2 && nameOnly.length < 60) {
      result.customer_name = nameOnly
    }
  }

  return result
}

function parseNumberInput(message: string): number | null {
  const trimmed = message.trim()
  const num = parseInt(trimmed, 10)
  if (!isNaN(num)) return num
  return null
}

function isLikelyOffTopic(message: string, step: string): boolean {
  const lower = message.trim().toLowerCase()

  // Common booking answers — NOT off-topic
  const bookingPatterns = [
    /^\d+$/, // Pure number
    /^(yes|no|ya|tidak|confirm|cancel|today|tomorrow)$/i,
    /\d{4}-\d{2}-\d{2}/, // Date
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/, // Alt date
    /name\s*:/i,
    /member\s*id/i,
    /contact/i,
    /bes\s*device/i,
    /\+?6?\d[\d\s\-]{7,14}\d/, // Phone
  ]

  for (const pattern of bookingPatterns) {
    if (pattern.test(lower)) return false
  }

  // If the message is very short (1-2 words), it's probably a booking answer
  if (lower.split(/\s+/).length <= 2) return false

  // If it contains a question mark or is clearly a question, it's likely off-topic
  if (lower.includes('?') || lower.startsWith('what') || lower.startsWith('how') || lower.startsWith('where') || lower.startsWith('when') || lower.startsWith('why') || lower.startsWith('can')) {
    return true
  }

  // During details step, longer freeform text might be details entry
  if (step === 'details' && lower.includes(':')) return false

  return false
}

async function validateDateConstraints(
  botId: string,
  facilityType: FacilityType,
  date: string
): Promise<string | null> {
  const supabase = createServiceClient()

  const { data: config } = await supabase
    .from('facilities_config')
    .select('min_advance_hours, max_window_days')
    .eq('bot_id', botId)
    .eq('facility_type', facilityType)
    .single()

  if (!config) return null // No constraints found — allow

  const now = new Date()
  const requestedDate = new Date(date)

  // Check min advance hours
  const minAdvanceMs = (config.min_advance_hours ?? 2) * 60 * 60 * 1000
  const earliest = new Date(now.getTime() + minAdvanceMs)
  if (requestedDate < earliest) {
    return `Bookings must be made at least ${config.min_advance_hours} hours in advance. Please choose a later date.`
  }

  // Check max window days
  const maxWindowMs = (config.max_window_days ?? 30) * 24 * 60 * 60 * 1000
  const latest = new Date(now.getTime() + maxWindowMs)
  if (requestedDate > latest) {
    return `Bookings can only be made up to ${config.max_window_days} days in advance. Please choose a closer date.`
  }

  return null
}

// --- Date/Time Utilities ---

function getTodayDate(): string {
  // MYT is UTC+8
  const now = new Date()
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return myt.toISOString().slice(0, 10)
}

function getTomorrowDate(): string {
  const now = new Date()
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000)
  return myt.toISOString().slice(0, 10)
}

function getExampleDate(): string {
  const tomorrow = getTomorrowDate()
  return tomorrow
}

function formatTime(isoTimestamp: string): string {
  // Extract HH:MM from ISO timestamp like 2026-03-25T09:00:00+08:00
  const match = isoTimestamp.match(/T(\d{2}:\d{2})/)
  if (match) return match[1]
  return isoTimestamp
}

function formatDateTime(isoTimestamp: string): string {
  const dateMatch = isoTimestamp.match(/(\d{4}-\d{2}-\d{2})/)
  const timeMatch = isoTimestamp.match(/T(\d{2}:\d{2})/)
  const date = dateMatch ? dateMatch[1] : ''
  const time = timeMatch ? timeMatch[1] : ''
  return `${date} at ${time}`
}

function buildISOTimestamp(date: string, time: string): string {
  // Combine YYYY-MM-DD and HH:MM into ISO with MYT offset
  return `${date}T${time}:00+08:00`
}

function addMinutesToISOTimestamp(isoTimestamp: string, minutes: number): string {
  const d = new Date(isoTimestamp)
  d.setMinutes(d.getMinutes() + minutes)
  // Return with +08:00 offset
  const utcPlus8 = new Date(d.getTime())
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = utcPlus8.getUTCFullYear()
  const mm = pad(utcPlus8.getUTCMonth() + 1)
  const dd = pad(utcPlus8.getUTCDate())
  const hh = pad(utcPlus8.getUTCHours())
  const min = pad(utcPlus8.getUTCMinutes())
  const ss = pad(utcPlus8.getUTCSeconds())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+08:00`
}
