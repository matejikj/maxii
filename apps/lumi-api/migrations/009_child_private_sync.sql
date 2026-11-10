-- Durable owner-scoped child-private sync ledger. Family membership never
-- opens these rows; named recipients may only SELECT share publish/revoke ops
-- they are listed on. Sequence is global so recipient inboxes stay ordered.

create table if not exists child_private_sync_ledger (
  id boolean primary key default true check (id),
  epoch int not null default 1,
  updated_at timestamptz not null default now()
);

insert into child_private_sync_ledger (id, epoch)
values (true, 1)
on conflict (id) do nothing;

create sequence if not exists child_private_sync_global_seq;

create table if not exists child_private_sync_state (
  owner_app_user_id uuid primary key references app_user (app_user_id),
  writer_generation int not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists child_private_sync_operation (
  owner_app_user_id uuid not null references app_user (app_user_id),
  operation_id uuid not null,
  payload_hash text not null,
  revision_id uuid not null,
  entity_id uuid not null,
  kind text not null,
  device_id text not null,
  actor_app_user_id uuid not null references app_user (app_user_id),
  parent_revision_ids jsonb not null default '[]'::jsonb,
  payload_json jsonb not null,
  -- Denormalized for RLS; null on non-share kinds.
  audience_app_user_ids uuid[] null,
  changelog_seq bigint not null,
  accepted_at timestamptz not null default now(),
  primary key (owner_app_user_id, operation_id),
  unique (changelog_seq),
  constraint child_private_sync_kind_prefix
    check (kind like 'child_private.%')
);

create index if not exists child_private_sync_operation_pull_idx
  on child_private_sync_operation (changelog_seq);

create index if not exists child_private_sync_operation_audience_gin
  on child_private_sync_operation using gin (audience_app_user_ids);

alter table child_private_sync_ledger enable row level security;
alter table child_private_sync_state enable row level security;
alter table child_private_sync_operation enable row level security;
alter table child_private_sync_ledger force row level security;
alter table child_private_sync_state force row level security;
alter table child_private_sync_operation force row level security;

-- Any authenticated principal may read the ledger epoch for cursor checks.
create policy child_private_sync_ledger_authenticated on child_private_sync_ledger
  for select to lumi_app
  using (current_setting('lumi.app_user_id', true) <> '');

create policy child_private_sync_state_owner_all on child_private_sync_state
  for all to lumi_app
  using (owner_app_user_id::text = current_setting('lumi.app_user_id', true))
  with check (owner_app_user_id::text = current_setting('lumi.app_user_id', true));

create policy child_private_sync_operation_owner_all on child_private_sync_operation
  for all to lumi_app
  using (owner_app_user_id::text = current_setting('lumi.app_user_id', true))
  with check (owner_app_user_id::text = current_setting('lumi.app_user_id', true));

-- Recipients see only frozen share ops addressed to them — never live projects.
create policy child_private_sync_operation_recipient_select on child_private_sync_operation
  for select to lumi_app
  using (
    kind in ('child_private.share.publish', 'child_private.share.revoke')
    and current_setting('lumi.app_user_id', true) <> ''
    and audience_app_user_ids is not null
    and current_setting('lumi.app_user_id', true)::uuid = any (audience_app_user_ids)
  );

grant select on child_private_sync_ledger to lumi_app;
grant select, insert, update, delete
  on child_private_sync_state, child_private_sync_operation
  to lumi_app;
grant usage, select on sequence child_private_sync_global_seq to lumi_app;
