import { NextRequest } from 'next/server'
import Papa from 'papaparse'
import { createServiceClient } from '@/lib/supabase/service'
import { embedDocumentChunks } from '@/lib/ingest/embedder'
import type { DocumentCategory } from '@/types/database'

const VALID_CATEGORIES: DocumentCategory[] = [
  'Beauty',
  'FMCG',
  'GenQi',
  'Healthfood',
  'Home Appliances',
  'Other',
]

function composeProductText(row: {
  name: string
  description?: string | null
  key_ingredients?: string | null
  health_benefits?: string | null
  pricing?: string | null
  suggested_usage?: string | null
}): string {
  return [
    row.name,
    row.description || '',
    `Key ingredients: ${row.key_ingredients || ''}`,
    `Health benefits: ${row.health_benefits || ''}`,
    `Pricing: ${row.pricing || ''}`,
    `Suggested usage: ${row.suggested_usage || ''}`,
  ]
    .filter(Boolean)
    .join('. ')
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = createServiceClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('id, bot_id, name, description, key_ingredients, health_benefits, pricing, suggested_usage, category, created_at')
    .eq('bot_id', botId)
    .order('name', { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(products ?? [])
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const contentType = request.headers.get('content-type') ?? ''

  // CSV bulk import
  if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    return handleCsvImport(request, botId)
  }

  // Single product creation (JSON)
  return handleSingleProduct(request, botId)
}

async function handleSingleProduct(request: NextRequest, botId: string) {
  let body: {
    name?: string
    description?: string
    key_ingredients?: string
    health_benefits?: string
    pricing?: string
    suggested_usage?: string
    category?: string
  }

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }

  const category: DocumentCategory =
    body.category && VALID_CATEGORIES.includes(body.category as DocumentCategory)
      ? (body.category as DocumentCategory)
      : 'Other'

  const productText = composeProductText({
    name: body.name,
    description: body.description,
    key_ingredients: body.key_ingredients,
    health_benefits: body.health_benefits,
    pricing: body.pricing,
    suggested_usage: body.suggested_usage,
  })

  const [embedding] = await embedDocumentChunks([productText])

  const supabase = createServiceClient()

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      bot_id: botId,
      name: body.name.trim(),
      description: body.description ?? null,
      key_ingredients: body.key_ingredients ?? null,
      health_benefits: body.health_benefits ?? null,
      pricing: body.pricing ?? null,
      suggested_usage: body.suggested_usage ?? null,
      category,
      embedding,
    })
    .select('id, bot_id, name, description, key_ingredients, health_benefits, pricing, suggested_usage, category, created_at')
    .single()

  if (error || !product) {
    return Response.json({ error: error?.message ?? 'Failed to create product' }, { status: 500 })
  }

  return Response.json(product, { status: 201 })
}

async function handleCsvImport(request: NextRequest, botId: string) {
  const csvText = await request.text()

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  if (!parsed.data || parsed.data.length === 0) {
    return Response.json({ error: 'CSV file is empty or has no valid rows' }, { status: 400 })
  }

  const errors: { row: number; message: string }[] = []
  const validRows: {
    name: string
    description: string | null
    key_ingredients: string | null
    health_benefits: string | null
    pricing: string | null
    suggested_usage: string | null
    category: DocumentCategory
  }[] = []

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i]
    const rowNum = i + 2 // 1-indexed + header row

    if (!row.name || row.name.trim() === '') {
      errors.push({ row: rowNum, message: 'name is required' })
      continue
    }

    const category: DocumentCategory =
      row.category && VALID_CATEGORIES.includes(row.category as DocumentCategory)
        ? (row.category as DocumentCategory)
        : 'Other'

    validRows.push({
      name: row.name.trim(),
      description: row.description?.trim() || null,
      key_ingredients: row.key_ingredients?.trim() || null,
      health_benefits: row.health_benefits?.trim() || null,
      pricing: row.pricing?.trim() || null,
      suggested_usage: row.suggested_usage?.trim() || null,
      category,
    })
  }

  if (validRows.length === 0) {
    return Response.json({ imported: 0, errors }, { status: 400 })
  }

  // Batch embed all valid rows
  const productTexts = validRows.map(composeProductText)
  const embeddings = await embedDocumentChunks(productTexts)

  const supabase = createServiceClient()

  const insertRows = validRows.map((row, i) => ({
    bot_id: botId,
    ...row,
    embedding: embeddings[i],
  }))

  const { error: insertError } = await supabase.from('products').insert(insertRows)

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  return Response.json({ imported: validRows.length, errors })
}
