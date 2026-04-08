import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/onboarding/invite/[token] — validate token (public, no auth)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const service = createServiceClient()

  const { data: invite, error } = await service
    .from('tenant_invites')
    .select('*, tenants(name)')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }

  return NextResponse.json({
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      tenant_id: invite.tenant_id,
      bot_id: invite.bot_id,
      expires_at: invite.expires_at,
      token: invite.token,
    },
    // @ts-expect-error Supabase join type
    tenant_name: invite.tenants?.name ?? null,
  })
}

// POST /api/onboarding/invite/[token] — accept invite, create user account
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const service = createServiceClient()

  // Re-validate token
  const { data: invite, error: fetchError } = await service
    .from('tenant_invites')
    .select('*')
    .eq('token', token)
    .single()

  if (fetchError || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }

  const body = await request.json()
  const { full_name, password } = body

  if (!full_name || !password) {
    return NextResponse.json({ error: 'full_name and password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Create the user via admin API
  const { data: newUser, error: createError } = await service.auth.admin.createUser({
    email: invite.email,
    password,
    user_metadata: { full_name },
    email_confirm: true, // auto-confirm since invite validates identity
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Create profile with assigned role and tenant
  const { error: profileError } = await service
    .from('profiles')
    .insert({
      id: newUser.user.id,
      tenant_id: invite.tenant_id,
      role: invite.role,
      full_name,
    })

  if (profileError) {
    // Rollback: delete the user we just created
    await service.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // If bot_id provided, create agent_profile record for agent role
  if (invite.bot_id && invite.role === 'agent') {
    await service.from('agent_profiles').insert({
      user_id: newUser.user.id,
      bot_id: invite.bot_id,
      display_name: full_name,
    })
  }

  // Mark invite as accepted
  await service
    .from('tenant_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  // Ensure onboarding_progress record exists for the tenant
  if (invite.tenant_id) {
    await service
      .from('onboarding_progress')
      .upsert({ tenant_id: invite.tenant_id }, { onConflict: 'tenant_id', ignoreDuplicates: true })
  }

  return NextResponse.json({ success: true, user_id: newUser.user.id })
}
