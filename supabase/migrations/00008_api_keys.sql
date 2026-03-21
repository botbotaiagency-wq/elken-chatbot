-- Phase 3: API Keys table for webhook authentication
CREATE TABLE public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  bot_id       uuid not null references public.bots(id) on delete cascade,
  label        text not null,
  key_prefix   text not null,
  key_hash     text not null,
  last_used_at timestamptz,
  created_at   timestamptz default now(),
  revoked_at   timestamptz
);

-- Partial index for fast validation lookup (only active keys)
CREATE INDEX api_keys_bot_id_hash_active_idx
  ON public.api_keys (bot_id, key_hash)
  WHERE revoked_at IS NULL;

-- Index for listing active keys per bot
CREATE INDEX api_keys_bot_id_revoked_at_idx
  ON public.api_keys (bot_id, revoked_at)
  WHERE revoked_at IS NULL;

-- RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Tenant admin can SELECT only their bot's keys
CREATE POLICY "tenant_admin_select_api_keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (
    bot_id IN (
      SELECT b.id FROM public.bots b
      JOIN public.profiles p ON p.tenant_id = b.tenant_id
      WHERE p.id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated role
-- All mutations go through API routes using service role client (bypasses RLS)
