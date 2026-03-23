import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return null
  return service
}

export async function GET() {
  const service = await requireSuperAdmin()
  if (!service) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: profiles }, { data: authData }, { data: tenants }] = await Promise.all([
    service.from('profiles').select('id, role, tenant_id, full_name'),
    service.auth.admin.listUsers(),
    service.from('tenants').select('id, name, slug').order('name'),
  ])

  const tenantMap = Object.fromEntries((tenants ?? []).map((t) => [t.id, t]))
  const emailMap = Object.fromEntries(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? ''])
  )

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailMap[p.id] ?? '',
    full_name: p.full_name ?? '',
    role: p.role,
    tenant_id: p.tenant_id ?? null,
    tenant_name: p.tenant_id ? (tenantMap[p.tenant_id]?.name ?? '') : '',
  }))

  return NextResponse.json({ users, tenants: tenants ?? [] })
}

export async function PATCH(req: Request) {
  const service = await requireSuperAdmin()
  if (!service) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { userId, tenant_id, role } = body as {
    userId: string
    tenant_id?: string | null
    role?: string
  }

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (tenant_id !== undefined) update.tenant_id = tenant_id || null
  if (role !== undefined) update.role = role

  const { error } = await service.from('profiles').update(update).eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
