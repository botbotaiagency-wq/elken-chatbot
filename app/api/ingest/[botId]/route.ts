export const maxDuration = 60

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { DocumentCategory } from '@/types/database'

const VALID_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

const VALID_CATEGORIES: DocumentCategory[] = [
  'Beauty',
  'FMCG',
  'GenQi',
  'Healthfood',
  'Home Appliances',
  'Other',
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  let body: { filename?: string; category?: string; subcategory?: string; contentType?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { filename, category, subcategory, contentType } = body

  if (!filename || typeof filename !== 'string') {
    return Response.json({ error: 'filename is required' }, { status: 400 })
  }

  if (!contentType || !VALID_CONTENT_TYPES.includes(contentType)) {
    return Response.json(
      {
        error: `contentType must be one of: ${VALID_CONTENT_TYPES.join(', ')}`,
      },
      { status: 400 }
    )
  }

  const resolvedCategory: DocumentCategory =
    category && VALID_CATEGORIES.includes(category as DocumentCategory)
      ? (category as DocumentCategory)
      : 'Other'

  const supabase = createServiceClient()

  // Insert document record with status=pending
  const { data: doc, error: insertError } = await supabase
    .from('documents')
    .insert({
      bot_id: botId,
      filename,
      category: resolvedCategory,
      subcategory: subcategory?.trim() || null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError || !doc) {
    return Response.json(
      { error: insertError?.message ?? 'Failed to create document record' },
      { status: 500 }
    )
  }

  // Generate storage path and create signed upload URL
  const storagePath = `${botId}/${doc.id}/${filename}`

  const { data: signedData, error: storageError } = await supabase.storage
    .from('bot-files')
    .createSignedUploadUrl(storagePath)

  if (storageError || !signedData) {
    return Response.json(
      { error: storageError?.message ?? 'Failed to create signed upload URL' },
      { status: 500 }
    )
  }

  // Update document with storage_path
  const { error: updateError } = await supabase
    .from('documents')
    .update({ storage_path: storagePath })
    .eq('id', doc.id)

  if (updateError) {
    return Response.json(
      { error: updateError.message },
      { status: 500 }
    )
  }

  return Response.json({
    documentId: doc.id,
    signedUrl: signedData.signedUrl,
    token: signedData.token,
    path: storagePath,
  })
}
