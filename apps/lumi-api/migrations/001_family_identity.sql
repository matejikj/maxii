-- Family identity schema with RLS. Runtime role must not own tables or bypass RLS.
-- Applied by the migration role; application connects as lumi_app.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lumi_migrator') then
    create role lumi_migrator login password 'lumi_migrator_dev_only';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'lumi_app') then
    create role lumi_app login password 'lumi_app_dev_only' nosuperuser nocreatedb nocreaterole;
  end if;
end
$$;

grant connect on database lumi_app to lumi_migrator;
grant connect on database lumi_app to lumi_app;

create table if not exists app_user (
  app_user_id uuid primary key,
  created_at timestamptz not null default now(),
  status text not null check (status in ('active', 'revoked'))
);

create table if not exists external_identity_binding (
  issuer text not null,
  subject text not null,
  app_user_id uuid not null references app_user (app_user_id),
  bound_at timestamptz not null default now(),
  revoked_at timestamptz null,
  primary key (issuer, subject)
);

create table if not exists family (
  family_id uuid primary key,
  display_name text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references app_user (app_user_id)
);

create table if not exists family_membership (
  membership_id uuid primary key,
  family_id uuid not null references family (family_id),
  app_user_id uuid not null references app_user (app_user_id),
  role text not null check (role in ('admin', 'caregiver')),
  status text not null check (status in ('active', 'revoked')),
  joined_at timestamptz not null default now(),
  unique (family_id, app_user_id)
);

create table if not exists family_object (
  object_id uuid primary key,
  family_id uuid not null references family (family_id),
  kind text not null,
  label text not null,
  created_at timestamptz not null default now()
);

alter table app_user enable row level security;
alter table external_identity_binding enable row level security;
alter table family enable row level security;
alter table family_membership enable row level security;
alter table family_object enable row level security;

alter table app_user force row level security;
alter table external_identity_binding force row level security;
alter table family force row level security;
alter table family_membership force row level security;
alter table family_object force row level security;

-- Membership lookup for the authenticated user (no family GUC required).
create policy app_user_self on app_user
  for select to lumi_app
  using (app_user_id::text = current_setting('lumi.app_user_id', true));

create policy binding_self on external_identity_binding
  for select to lumi_app
  using (app_user_id::text = current_setting('lumi.app_user_id', true));

create policy membership_self on family_membership
  for select to lumi_app
  using (
    app_user_id::text = current_setting('lumi.app_user_id', true)
    and status = 'active'
  );

create policy family_member_read on family
  for select to lumi_app
  using (
    exists (
      select 1 from family_membership m
      where m.family_id = family.family_id
        and m.app_user_id::text = current_setting('lumi.app_user_id', true)
        and m.status = 'active'
    )
  );

create policy family_object_member_read on family_object
  for select to lumi_app
  using (
    family_id::text = current_setting('lumi.family_id', true)
    and exists (
      select 1 from family_membership m
      where m.family_id = family_object.family_id
        and m.app_user_id::text = current_setting('lumi.app_user_id', true)
        and m.status = 'active'
    )
  );

grant usage on schema public to lumi_app;
grant select on app_user, external_identity_binding, family, family_membership, family_object to lumi_app;
-- Writes go through controlled API transactions with migrator/service paths later;
-- runtime role stays read-scoped for object fetches in this first cut.
