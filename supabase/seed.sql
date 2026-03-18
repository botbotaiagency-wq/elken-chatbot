-- Seed: two test tenants + two test bots for isolation testing
-- Used by: supabase/tests/isolation.test.sql and manual smoke tests

insert into public.tenants (id, name, slug) values
  ('11111111-0000-0000-0000-000000000001', 'Test Tenant A', 'tenant-a'),
  ('22222222-0000-0000-0000-000000000002', 'Test Tenant B', 'tenant-b')
on conflict (id) do nothing;

insert into public.bots (id, tenant_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Bot A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Bot B')
on conflict (id) do nothing;
