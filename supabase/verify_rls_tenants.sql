-- Optional two-tenant RLS probe. Run AFTER 0001–0008.
-- Creates throwaway rows, switches to the authenticated role, then rolls back.
-- Skip this script if SET ROLE authenticated is not permitted in your SQL editor.

begin;

create temporary table rls_probe (
  user_a uuid,
  user_b uuid,
  org_a uuid,
  org_b uuid,
  acc_a uuid,
  acc_b uuid
);

insert into rls_probe
select gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

insert into public.users (id, email, full_name)
select user_a, 'rls-a@example.invalid', 'RLS User A' from rls_probe
union all
select user_b, 'rls-b@example.invalid', 'RLS User B' from rls_probe;

insert into public.organizations (id, name, slug)
select org_a, 'RLS Org A', 'rls-org-a-' || substr(user_a::text, 1, 8) from rls_probe
union all
select org_b, 'RLS Org B', 'rls-org-b-' || substr(user_b::text, 1, 8) from rls_probe;

insert into public.organization_members (org_id, user_id, role)
select org_a, user_a, 'member' from rls_probe
union all
select org_b, user_b, 'member' from rls_probe;

insert into public.accounts (id, org_id, name)
select acc_a, org_a, 'Account A' from rls_probe
union all
select acc_b, org_b, 'Account B' from rls_probe;

insert into public.chunks (org_id, account_id, source_type, source_id, content)
select org_a, acc_a, 'note', acc_a, 'secret-from-org-a' from rls_probe
union all
select org_b, acc_b, 'note', acc_b, 'secret-from-org-b' from rls_probe;

select set_config('request.jwt.claim.sub', user_a::text, true) from rls_probe;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_a, 'role', 'authenticated')::text,
  true
) from rls_probe;

set local role authenticated;

do $$
declare
  seen int;
  acc_b uuid;
  org_b uuid;
begin
  select count(*) into seen from public.accounts;
  if seen <> 1 then
    raise exception 'User A should see 1 account via RLS, saw %', seen;
  end if;

  select p.acc_b, p.org_b into acc_b, org_b from rls_probe p;
  select count(*) into seen from public.accounts where id = acc_b;
  if seen <> 0 then
    raise exception 'User A selected Org B account via RLS';
  end if;

  select count(*) into seen from public.chunks where content = 'secret-from-org-b';
  if seen <> 0 then
    raise exception 'User A selected Org B RAG chunks via RLS';
  end if;

  begin
    insert into public.accounts (org_id, name) values (org_b, 'Forged into B');
    raise exception 'User A inserted into Org B via RLS';
  exception
    when others then
      if sqlerrm like 'User A inserted%' then
        raise;
      end if;
  end;
end $$;

reset role;
rollback;
