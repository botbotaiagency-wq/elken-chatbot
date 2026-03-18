-- HNSW index for vector similarity search on chunks
-- m=16, ef_construction=64 are pgvector defaults; appropriate for 1536-dim at v1 scale
-- Uses cosine distance operator (vector_cosine_ops) — MUST match query operator <=>
create index chunks_embedding_hnsw_idx
  on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Btree indexes on FK columns used in RLS policy joins
-- Without these, RLS subqueries become sequential scans
create index bots_tenant_id_idx on public.bots (tenant_id);
create index documents_bot_id_idx on public.documents (bot_id);
create index chunks_bot_id_idx on public.chunks (bot_id);
create index chunks_document_id_idx on public.chunks (document_id);
create index conversations_bot_id_idx on public.conversations (bot_id);
create index messages_conversation_id_idx on public.messages (conversation_id);
create index messages_bot_id_idx on public.messages (bot_id);
create index faqs_bot_id_idx on public.faqs (bot_id);
create index response_templates_bot_id_idx on public.response_templates (bot_id);
create index profiles_tenant_id_idx on public.profiles (tenant_id);
