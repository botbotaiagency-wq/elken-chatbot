export const maxDuration = 60

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

function getMimeTypeFromFilename(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.txt')) return 'text/plain'
  return 'text/plain'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  let body: { documentId?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { documentId } = body

  if (!documentId || typeof documentId !== 'string') {
    return Response.json({ error: 'documentId is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch document record and verify ownership
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (fetchError || !doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  if (doc.bot_id !== botId) {
    return Response.json({ error: 'Document does not belong to this bot' }, { status: 403 })
  }

  if (!doc.storage_path) {
    return Response.json({ error: 'Document has no storage path — upload the file first' }, { status: 400 })
  }

  // Set status to processing
  await supabase
    .from('documents')
    .update({ status: 'processing' })
    .eq('id', documentId)

  try {
    // Dynamic imports — avoids module-level crash if a package fails to load on Vercel
    const [{ extractText }, { chunkText }, { embedDocumentChunks }] = await Promise.all([
      import('@/lib/ingest/extractor'),
      import('@/lib/ingest/chunker'),
      import('@/lib/ingest/embedder'),
    ])

    // Download file from storage
    const { data: blob, error: downloadError } = await supabase.storage
      .from('bot-files')
      .download(doc.storage_path)

    if (downloadError || !blob) {
      throw new Error(downloadError?.message ?? 'Failed to download file from storage')
    }

    // Extract text
    const mimeType = getMimeTypeFromFilename(doc.filename)
    const buffer = Buffer.from(await blob.arrayBuffer())
    const text = await extractText(buffer, mimeType)

    // Chunk the text
    const chunks = chunkText(text, 500, 50)

    if (chunks.length === 0) {
      await supabase
        .from('documents')
        .update({ status: 'failed', error_message: 'No text content extracted' })
        .eq('id', documentId)
      return Response.json({ error: 'No text content extracted' }, { status: 422 })
    }

    // Embed all chunks
    const embeddings = await embedDocumentChunks(chunks)

    // Bulk insert chunks into the chunks table
    const chunkRows = chunks.map((content, i) => ({
      bot_id: botId,
      document_id: documentId,
      content,
      embedding: embeddings[i],
    }))

    const { error: insertError } = await supabase.from('chunks').insert(chunkRows)

    if (insertError) {
      throw new Error(insertError.message)
    }

    // Update document to ready with chunk_count — clear any stale error_message
    await supabase
      .from('documents')
      .update({ status: 'ready', chunk_count: chunks.length, error_message: null })
      .eq('id', documentId)

    return Response.json({ success: true, chunkCount: chunks.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed'

    await supabase
      .from('documents')
      .update({ status: 'failed', error_message: message })
      .eq('id', documentId)

    return Response.json({ error: message }, { status: 500 })
  }
}
