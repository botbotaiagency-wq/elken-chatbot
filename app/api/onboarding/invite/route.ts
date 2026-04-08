import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// POST /api/onboarding/invite — super_admin only
// Creates a new tenant invite and returns the invite token/URL
export async function POST(request: Request) {
  // Verify caller is super_admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: super_admin only' }, { status: 403 })
  }

  const body = await request.json()
  const { email, tenantId, botId, role = 'tenant_admin' } = body

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  if (!['tenant_admin', 'agent'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const { data: invite, error } = await service
    .from('tenant_invites')
    .insert({
      email,
      tenant_id: tenantId ?? null,
      bot_id: botId ?? null,
      invited_by: user.id,
      role,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const inviteUrl = `${appUrl}/invite/${invite.token}`

  return NextResponse.json({ invite, invite_url: inviteUrl }, { status: 201 })
}
