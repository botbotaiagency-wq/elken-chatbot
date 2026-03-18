-- Custom Access Token Hook: injects role + tenant_id into JWT app_metadata
-- This runs BEFORE every token issuance by Supabase Auth
-- Source: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_role text;
  user_tenant_id uuid;
begin
  select p.role, p.tenant_id
  into user_role, user_tenant_id
  from public.profiles p
  where p.id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(coalesce(user_role, 'tenant_admin')));

  if user_tenant_id is not null then
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', to_jsonb(user_tenant_id::text));
  else
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', 'null'::jsonb);
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Grants: ONLY supabase_auth_admin can execute the hook
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
