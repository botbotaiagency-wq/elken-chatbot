-- Phase 2: Fix vector dimension (1536 -> 1024) for voyage-3-large compatibility
-- Add products table, add embedding column to faqs
-- CRITICAL: voyage-3-large supports only 256, 512, 1024, 2048 — NOT 1536

-- 1. Drop existing HNSW index (can't alter column with active index)
DROP INDEX IF EXISTS chunks_embedding_hnsw_idx;

-- 2. Alter chunks.embedding from vector(1536) to vector(1024)
-- Safe: Phase 1 stores no embedding data — column is all NULLs
ALTER TABLE public.chunks
  ALTER COLUMN embedding TYPE extensions.vector(1024)
  USING NULL;

-- 3. Recreate HNSW index for 1024-dim cosine distance
CREATE INDEX chunks_embedding_hnsw_idx
  ON public.chunks
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Add embedding column to faqs for semantic FAQ matching
ALTER TABLE public.faqs
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1024);

CREATE INDEX faqs_embedding_hnsw_idx
  ON public.faqs
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. Create products table with structured fields
CREATE TABLE public.products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id           uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  key_ingredients  text,
  health_benefits  text,
  pricing          text,
  suggested_usage  text,
  category         text NOT NULL DEFAULT 'Other'
                   CHECK (category IN ('Beauty', 'FMCG', 'GenQi', 'Healthfood', 'Home Appliances', 'Other')),
  embedding        extensions.vector(1024),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX products_bot_id_idx ON public.products (bot_id);
CREATE INDEX products_embedding_hnsw_idx
  ON public.products
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 6. RLS on products — same pattern as other bot_id-scoped tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_tenant_isolation" ON public.products
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_super_admin())
    OR bot_id IN (
      SELECT b.id FROM public.bots b
      WHERE b.tenant_id = (SELECT public.jwt_tenant_id())
    )
  )
  WITH CHECK (
    (SELECT public.is_super_admin())
    OR bot_id IN (
      SELECT b.id FROM public.bots b
      WHERE b.tenant_id = (SELECT public.jwt_tenant_id())
    )
  );

-- 7. Add storage_path column to documents for Supabase Storage reference
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS storage_path text;

-- 8. Add error_message column to documents for failure details
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS error_message text;
