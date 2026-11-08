-- Durable sync receipts and commit-safe changelog. Sequence is owned by the
-- family row lock at accept time so pull cannot skip a later-committed change.

create table if not exists family_sync_state (
  family_id uuid primary key references family (family_id),
  epoch int not null default 1,
  last_changelog_seq bigint not null default 0,
  writer_generation int not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists family_sync_operation (
  family_id uuid not null references family (family_id),
  operation_id uuid not null,
  payload_hash text not null,
  revision_id uuid not null,
  entity_id uuid not null,
  kind text not null,
  device_id text not null,
  actor_app_user_id uuid not null references app_user (app_user_id),
  parent_revision_ids jsonb not null default '[]'::jsonb,
  payload_json jsonb not null,
  changelog_seq bigint not null,
  accepted_at timestamptz not null default now(),
  primary key (family_id, operation_id),
  unique (family_id, changelog_seq)
);

create index if not exists family_sync_operation_pull_idx
  on family_sync_operation (family_id, changelog_seq);

alter table family_sync_state enable row level security;
alter table family_sync_operation enable row level security;
alter table family_sync_state force row level security;
alter table family_sync_operation force row level security;

create policy family_sync_state_member on family_sync_state
  for select to lumi_app
  using (
    exists (
      select 1 from family_membership m
      where m.family_id = family_sync_state.family_id
        and m.app_user_id::text = current_setting('lumi.app_user_id', true)
        and m.status = 'active'
    )
  );

create policy family_sync_operation_member on family_sync_operation
  for select to lumi_app
  using (
    family_id::text = current_setting('lumi.family_id', true)
    and exists (
      select 1 from family_membership m
      where m.family_id = family_sync_operation.family_id
        and m.app_user_id::text = current_setting('lumi.app_user_id', true)
        and m.status = 'active'
    )
  );

grant select on family_sync_state, family_sync_operation to lumi_app;
