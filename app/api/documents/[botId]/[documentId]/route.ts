import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ botId: string; documentId: string }> }
) {
  const { botId, documentId } = await params

  const supabase = createServiceClient()

  // Fetch document and verify ownership
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('id, bot_id, storage_path')
    .eq('id', documentId)
    .single()

  if (fetchError || !doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  if (doc.bot_id !== botId) {
    return Response.json({ error: 'Document does not belong to this bot' }, { status: 403 })
  }

  // Remove from storage if storage_path exists
  if (doc.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('bot-files')
      .remove([doc.storage_path])

    if (storageError) {
      return Response.json({ error: storageError.message }, { status: 500 })
    }
  }

  // Clean up associated script if this was a script-mode document
  await supabase.from('scripts').delete().eq('document_id', documentId)

  // Delete document record — FK cascade removes all chunks automatically
  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
