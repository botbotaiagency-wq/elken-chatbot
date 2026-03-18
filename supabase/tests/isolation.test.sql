-- pgTAP: Two-tenant isolation + super-admin bypass test
-- Covers: AUTH-02 (tenant scoping), AUTH-03 (super-admin access), AUTH-04 (RLS enforcement)
-- Run with: supabase test db

begin;
select plan(8);

-- Setup: two tenants, two bots, documents for each bot
insert into public.tenants (id, name, slug) values
  ('11111111-0000-0000-0000-000000000001', 'Tenant A', 'test-tenant-a'),
  ('22222222-0000-0000-0000-000000000002', 'Tenant B', 'test-tenant-b');

insert into public.bots (id, tenant_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Bot A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Bot B');

insert into public.documents (id, bot_id, filename) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'doc-a.pdf'),
  ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'doc-b.pdf');

-- TEST 1-2: Tenant A admin sees only their own bot and documents
set local role authenticated;
set local request.jwt.claims = '{"sub":"user-a","app_metadata":{"role":"tenant_admin","tenant_id":"11111111-0000-0000-0000-000000000001"}}';

select results_eq(
  $$ select count(*)::int from public.bots $$,
  $$ values (1) $$,
  'Tenant A admin sees exactly 1 bot'
);

select is(
  (select name from public.bots limit 1),
  'Bot A',
  'Tenant A admin sees Bot A, not Bot B'
);

-- TEST 3-4: Tenant B admin sees only their own bot and documents
set local request.jwt.claims = '{"sub":"user-b","app_metadata":{"role":"tenant_admin","tenant_id":"22222222-0000-0000-0000-000000000002"}}';

select results_eq(
  $$ select count(*)::int from public.bots $$,
  $$ values (1) $$,
  'Tenant B admin sees exactly 1 bot'
);

select is(
  (select name from public.bots limit 1),
  'Bot B',
  'Tenant B admin sees Bot B, not Bot A'
);

-- TEST 5-6: Tenant A cannot see Tenant B documents (bot_id scoped table)
set local request.jwt.claims = '{"sub":"user-a","app_metadata":{"role":"tenant_admin","tenant_id":"11111111-0000-0000-0000-000000000001"}}';

select results_eq(
  $$ select count(*)::int from public.documents $$,
  $$ values (1) $$,
  'Tenant A admin sees exactly 1 document'
);

select is(
  (select filename from public.documents limit 1),
  'doc-a.pdf',
  'Tenant A admin sees doc-a.pdf, not doc-b.pdf'
);

-- TEST 7-8: Super-admin sees everything
set local request.jwt.claims = '{"sub":"user-super","app_metadata":{"role":"super_admin","tenant_id":null}}';

select results_eq(
  $$ select count(*)::int from public.bots $$,
  $$ values (2) $$,
  'Super-admin sees both bots'
);

select results_eq(
  $$ select count(*)::int from public.documents $$,
  $$ values (2) $$,
  'Super-admin sees both documents'
);

select * from finish();
rollback;
