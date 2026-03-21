import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceClient()

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }

  let botsQuery = serviceClient
    .from('bots')
    .select('id, name, feature_flags, created_at, tenant_id')

  if (profile.role !== 'super_admin') {
    botsQuery = botsQuery.eq('tenant_id', profile.tenant_id)
  }

  const { data: bots, error: botsError } = await botsQuery

  if (botsError) {
    console.error('[bots GET]', botsError)
    return NextResponse.json({ error: 'Failed to fetch bots' }, { status: 500 })
  }

  return NextResponse.json({ bots: bots ?? [] })
}
