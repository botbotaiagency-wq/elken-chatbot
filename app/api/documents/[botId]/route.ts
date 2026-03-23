import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = createServiceClient()

  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, filename, category, subcategory, status, chunk_count, error_message, created_at')
    .eq('bot_id', botId)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(documents ?? [])
}
