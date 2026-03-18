-- Core multi-tenant schema
-- Hierarchy: tenants -> bots -> (documents, chunks, conversations, messages)
-- bot_id is the universal isolation key

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz default now()
);

create table public.bots (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  api_key_hash  text,
  feature_flags jsonb not null default '{}',
  created_at    timestamptz default now()
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete set null,
  role        text not null default 'tenant_admin'
              check (role in ('super_admin', 'tenant_admin')),
  full_name   text,
  created_at  timestamptz default now()
);

create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  bot_id      uuid not null references public.bots(id) on delete cascade,
  filename    text not null,
  category    text not null default 'Other'
              check (category in ('Beauty', 'FMCG', 'GenQi', 'Healthfood', 'Home Appliances', 'Other')),
  status      text not null default 'pending'
              check (status in ('pending', 'processing', 'ready', 'failed')),
  chunk_count integer not null default 0,
  created_at  timestamptz default now()
);

create table public.chunks (
  id           uuid primary key default gen_random_uuid(),
  bot_id       uuid not null references public.bots(id) on delete cascade,
  document_id  uuid not null references public.documents(id) on delete cascade,
  content      text not null,
  embedding    extensions.vector(1536),
  created_at   timestamptz default now()
);

create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  bot_id      uuid not null references public.bots(id) on delete cascade,
  user_id     text not null,
  channel     text not null check (channel in ('whatsapp', 'telegram', 'web')),
  metadata    jsonb not null default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  bot_id           uuid not null references public.bots(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant', 'system')),
  content          text not null,
  intent           text,
  source_chunks    jsonb,
  rag_found        boolean,
  latency_ms       integer,
  created_at       timestamptz default now()
);

create table public.faqs (
  id          uuid primary key default gen_random_uuid(),
  bot_id      uuid not null references public.bots(id) on delete cascade,
  question    text not null,
  answer      text not null,
  language    text not null check (language in ('en', 'bm', 'zh')),
  created_at  timestamptz default now()
);

create table public.response_templates (
  id          uuid primary key default gen_random_uuid(),
  bot_id      uuid not null references public.bots(id) on delete cascade,
  intent_key  text not null,
  language    text not null check (language in ('en', 'bm', 'zh')),
  content     text not null,
  created_at  timestamptz default now(),
  unique (bot_id, intent_key, language)
);

-- Auto-create profile row when a user is created in auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
