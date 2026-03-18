-- Helper functions for RLS policies

create or replace function public.jwt_tenant_id()
returns uuid
language sql stable
security invoker
as $$
  select nullif(
    (auth.jwt()->'app_metadata'->>'tenant_id'),
    ''
  )::uuid
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable
security invoker
as $$
  select (auth.jwt()->'app_metadata'->>'role') = 'super_admin'
$$;

-- RLS on tenants
alter table public.tenants enable row level security;

create policy "tenants_select" on public.tenants
  for select to authenticated
  using (
    (select public.is_super_admin())
    or id = (select public.jwt_tenant_id())
  );

create policy "tenants_modify_superadmin" on public.tenants
  for all to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

-- RLS on bots
alter table public.bots enable row level security;

create policy "bots_select" on public.bots
  for select to authenticated
  using (
    (select public.is_super_admin())
    or tenant_id = (select public.jwt_tenant_id())
  );

create policy "bots_modify_superadmin" on public.bots
  for all to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

-- RLS on profiles
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (
    (select public.is_super_admin())
    or id = auth.uid()
  );

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Grant supabase_auth_admin access to profiles BEFORE RLS blocks it
-- This is CRITICAL: the auth hook reads profiles and will fail without this grant
grant select on table public.profiles to supabase_auth_admin;

-- RLS on documents (bot_id scoped)
alter table public.documents enable row level security;

create policy "documents_tenant_isolation" on public.documents
  for all to authenticated
  using (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  )
  with check (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  );

-- RLS on chunks (bot_id scoped)
alter table public.chunks enable row level security;

create policy "chunks_tenant_isolation" on public.chunks
  for all to authenticated
  using (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  )
  with check (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  );

-- RLS on conversations (bot_id scoped)
alter table public.conversations enable row level security;

create policy "conversations_tenant_isolation" on public.conversations
  for all to authenticated
  using (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  )
  with check (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  );

-- RLS on messages (bot_id scoped)
alter table public.messages enable row level security;

create policy "messages_tenant_isolation" on public.messages
  for all to authenticated
  using (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  )
  with check (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  );

-- RLS on faqs (bot_id scoped)
alter table public.faqs enable row level security;

create policy "faqs_tenant_isolation" on public.faqs
  for all to authenticated
  using (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  )
  with check (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  );

-- RLS on response_templates (bot_id scoped)
alter table public.response_templates enable row level security;

create policy "response_templates_tenant_isolation" on public.response_templates
  for all to authenticated
  using (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  )
  with check (
    (select public.is_super_admin())
    or bot_id in (
      select b.id from public.bots b
      where b.tenant_id = (select public.jwt_tenant_id())
    )
  );
