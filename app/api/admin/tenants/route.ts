import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
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

export async function POST(req: Request) {
  const service = await requireSuperAdmin()
  if (!service) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Auto-generate slug from name
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // Ensure slug uniqueness by appending a short random suffix if needed
  const { data: existing } = await service
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  const finalSlug = existing
    ? `${slug}-${Math.random().toString(36).slice(2, 6)}`
    : slug

  const { data: tenant, error } = await service
    .from('tenants')
    .insert({ name: name.trim(), slug: finalSlug })
    .select('id, name, slug')
    .single()

  if (error) {
    console.error('[tenants POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tenant }, { status: 201 })
}
