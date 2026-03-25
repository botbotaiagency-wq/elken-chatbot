import { createServiceClient } from '@/lib/supabase/service'
import { embedQuery } from '@/lib/ingest/embedder'
import type { Intent } from '@/types/database'

export interface ChunkResult {
  id: string
  content: string
  document_id: string
  similarity: number
}

export interface FAQResult {
  id: string
  question: string
  answer: string
  language: string
  similarity: number
}

export interface ProductResult {
  id: string
  name: string
  description: string | null
  key_ingredients: string | null
  health_benefits: string | null
  pricing: string | null
  suggested_usage: string | null
  category: string
  similarity: number
}

export interface RetrievalResult {
  faqs: FAQResult[]
  chunks: ChunkResult[]
  products: ProductResult[]
  ragFound: boolean
}

const SIMILARITY_THRESHOLD = 0.55
const TOP_K_CHUNKS = 5
const TOP_K_FAQS = 3
const TOP_K_PRODUCTS = 3

export async function retrieveContext(
  query: string,
  botId: string,
  intent: Intent
): Promise<RetrievalResult> {
  const supabase = createServiceClient()
  const queryEmbedding = await embedQuery(query)

  // 1. FAQ semantic match (priority — always checked)
  const { data: faqs } = await supabase.rpc('match_faqs', {
    query_embedding: queryEmbedding,
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: TOP_K_FAQS,
    p_bot_id: botId,
  })

  // 2. Document chunk search
  const { data: chunks } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: TOP_K_CHUNKS,
    p_bot_id: botId,
  })

  // 3. Product search (for browse_product and health_issue intents)
  let products: ProductResult[] = []
  if (intent === 'browse_product' || intent === 'health_issue') {
    const { data: productData } = await supabase.rpc('match_products', {
      query_embedding: queryEmbedding,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: TOP_K_PRODUCTS,
      p_bot_id: botId,
    })
    products = productData ?? []
  }

  const ragFound = (faqs?.length ?? 0) > 0 || (chunks?.length ?? 0) > 0 || products.length > 0

  return {
    faqs: faqs ?? [],
    chunks: chunks ?? [],
    products,
    ragFound,
  }
}
