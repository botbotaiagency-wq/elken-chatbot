import { createServiceClient } from '@/lib/supabase/service'
import { generateApiKey } from '@/lib/api-keys/generate'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const body = await req.json()
  const { label } = body as { label?: string }

  if (!label || typeof label !== 'string' || label.trim() === '') {
    return Response.json({ error: 'label is required' }, { status: 400 })
  }

  const { raw, hash, prefix } = generateApiKey()
  const supabase = createServiceClient()

  // Revoke any existing active key with the same label (idempotent re-generation)
  await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('bot_id', botId)
    .eq('label', label)
    .is('revoked_at', null)

  // Insert the new key (store hash only — never persist plaintext)
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ bot_id: botId, label, key_prefix: prefix, key_hash: hash })
    .select('id, label, key_prefix, created_at')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Return plaintext key exactly once — it will never be retrievable again
  return Response.json({ key: raw, ...data })
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, label, key_prefix, last_used_at, created_at')
    .eq('bot_id', botId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ keys: data ?? [] })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const body = await req.json()
  const { keyId } = body as { keyId?: string }

  if (!keyId || typeof keyId !== 'string' || keyId.trim() === '') {
    return Response.json({ error: 'keyId is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Soft delete: set revoked_at. The .eq('bot_id', botId) is the isolation guard.
  await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('bot_id', botId)
    .is('revoked_at', null)

  return Response.json({ success: true })
}
