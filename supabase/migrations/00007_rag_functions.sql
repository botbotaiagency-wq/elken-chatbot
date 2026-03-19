-- Phase 2: RPC functions for semantic search
-- Called via supabase.rpc() from lib/rag/retrieve.ts

-- match_chunks: cosine similarity search on document chunks
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding extensions.vector(1024),
  match_threshold float,
  match_count int,
  p_bot_id uuid
)
RETURNS TABLE(id uuid, content text, document_id uuid, similarity float)
LANGUAGE sql
AS $$
  SELECT
    c.id,
    c.content,
    c.document_id,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.chunks c
  WHERE
    c.bot_id = p_bot_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= match_threshold
  ORDER BY c.embedding <=> query_embedding ASC
  LIMIT LEAST(match_count, 20);
$$;

-- match_faqs: cosine similarity search on FAQ embeddings
CREATE OR REPLACE FUNCTION match_faqs(
  query_embedding extensions.vector(1024),
  match_threshold float,
  match_count int,
  p_bot_id uuid
)
RETURNS TABLE(id uuid, question text, answer text, language text, similarity float)
LANGUAGE sql
AS $$
  SELECT
    f.id,
    f.question,
    f.answer,
    f.language,
    1 - (f.embedding <=> query_embedding) AS similarity
  FROM public.faqs f
  WHERE
    f.bot_id = p_bot_id
    AND f.embedding IS NOT NULL
    AND 1 - (f.embedding <=> query_embedding) >= match_threshold
  ORDER BY f.embedding <=> query_embedding ASC
  LIMIT LEAST(match_count, 5);
$$;

-- match_products: cosine similarity search on product embeddings
CREATE OR REPLACE FUNCTION match_products(
  query_embedding extensions.vector(1024),
  match_threshold float,
  match_count int,
  p_bot_id uuid
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  key_ingredients text,
  health_benefits text,
  pricing text,
  suggested_usage text,
  category text,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.key_ingredients,
    p.health_benefits,
    p.pricing,
    p.suggested_usage,
    p.category,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.products p
  WHERE
    p.bot_id = p_bot_id
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) >= match_threshold
  ORDER BY p.embedding <=> query_embedding ASC
  LIMIT LEAST(match_count, 10);
$$;
