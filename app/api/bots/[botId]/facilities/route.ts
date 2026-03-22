import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { FacilityType } from '@/lib/booking/types'

const FACILITY_TYPES: FacilityType[] = [
  'bed_female',
  'bed_male',
  'bed_unisex',
  'inhaler',
  'room_small',
  'room_large',
]

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('facilities_config')
    .select('*')
    .eq('bot_id', botId)

  if (error) {
    console.error('[facilities GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ configs: data ?? [] })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const body = await req.json()
  const { configs } = body as {
    configs: Array<{
      facility_type: FacilityType
      capacity: number
      duration_minutes: number
      min_advance_hours: number
      max_window_days: number
    }>
  }

  if (!configs || !Array.isArray(configs)) {
    return NextResponse.json({ error: 'configs array is required' }, { status: 400 })
  }

  // Validate all facility types are present
  const submittedTypes = configs.map((c) => c.facility_type)
  const missingTypes = FACILITY_TYPES.filter((ft) => !submittedTypes.includes(ft))
  if (missingTypes.length > 0) {
    return NextResponse.json(
      { error: `Missing facility types: ${missingTypes.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const rows = configs.map((c) => ({
    bot_id: botId,
    facility_type: c.facility_type,
    capacity: c.capacity,
    duration_minutes: c.duration_minutes,
    min_advance_hours: c.min_advance_hours,
    max_window_days: c.max_window_days,
  }))

  const { error } = await supabase
    .from('facilities_config')
    .upsert(rows, { onConflict: 'bot_id,facility_type' })

  if (error) {
    console.error('[facilities POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
