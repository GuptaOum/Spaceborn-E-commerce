-- A company runs Spaceborn with a team of admins, often one per city. Membership lives here,
-- keyed by email so a person can be invited before their first sign-in. `regions` is a list of
-- lower-cased store cities the admin may act on; null means every city. Owners manage the team.

create table admin_members (
  email        text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  display_name text,
  regions      text[],
  is_owner     boolean not null default false,
  added_by     text,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger admin_members_updated_at before update on admin_members
  for each row execute function set_updated_at();

-- The founding account also lives in code (DEFAULT_ADMIN_EMAILS) so the team can never lock itself out.
insert into admin_members (email, is_owner, note) values ('oumgupta555@gmail.com', true, 'Founding owner')
on conflict (email) do nothing;

-- Anyone promoted by hand in earlier releases keeps access as a global admin.
insert into admin_members (email, regions, is_owner, note)
select lower(btrim(u.email)), null, false, 'Migrated from users.role'
  from users u
 where u.role = 'admin' and u.email is not null and position('@' in u.email) > 1
on conflict (email) do nothing;

-- Who did what. Every admin decision writes a row so a distributed team can review each other.
create table admin_audit_log (
  id           bigserial primary key,
  actor_id     text,
  actor_email  text,
  action       text not null,
  target_type  text,
  target_id    text,
  city         text,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index admin_audit_log_created_idx on admin_audit_log (created_at desc);
create index admin_audit_log_target_idx on admin_audit_log (target_type, target_id);
