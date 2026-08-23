-- Run after `supabase db reset`: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/integration/supabase-security.sql
begin;
do $$
declare immutable boolean := false;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values ('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls@example.test', '', now(), now(), now());
  insert into public.audit_events (owner_id, dispute_id, actor_id, event_type)
  values ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'test');
  begin
    update public.audit_events set event_type = 'tampered' where event_type = 'test';
  exception when others then immutable := true;
  end;
  if not immutable then raise exception 'audit update was allowed'; end if;
end $$;
rollback;

begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), now(), now()),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), now(), now());
insert into public.disputes (owner_id, external_id, amount_cents, reason, sla_due_at)
values
  ('20000000-0000-4000-8000-000000000001', 'OWNER-A', 1000, 'fraud', now()),
  ('20000000-0000-4000-8000-000000000002', 'OWNER-B', 1000, 'fraud', now());
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
begin
  if (select count(*) from public.disputes where external_id in ('OWNER-A', 'OWNER-B')) <> 1 then
    raise exception 'owner isolation failed';
  end if;
  if not exists (select 1 from public.disputes where owner_id is null) then
    raise exception 'public demo read failed';
  end if;
end $$;
rollback;
