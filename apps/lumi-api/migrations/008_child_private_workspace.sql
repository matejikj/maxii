-- Owner-scoped child-private workspace. Family membership alone never grants
-- access: admin/caregiver roles are not private superusers. Named recipients
-- may read only non-revoked share snapshots they are listed on.

create table if not exists child_private_project (
  project_id uuid primary key,
  owner_app_user_id uuid not null references app_user (app_user_id),
  -- Soft UI link only — never used by RLS to open rows for parents.
  linked_child_profile_id text null,
  title text not null check (char_length(title) between 1 and 80),
  intent text not null default '' check (char_length(intent) <= 2000),
  -- Live reflection stays owner-only; shares never copy this column.
  reflection text null check (reflection is null or char_length(reflection) <= 2000),
  status text not null check (status in ('idea', 'active', 'paused', 'closed', 'archived')),
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists child_private_project_owner_idx
  on child_private_project (owner_app_user_id);

create table if not exists child_private_portfolio_item (
  portfolio_item_id uuid primary key,
  owner_app_user_id uuid not null references app_user (app_user_id),
  project_id uuid not null references child_private_project (project_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text null check (description is null or char_length(description) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists child_private_portfolio_owner_idx
  on child_private_portfolio_item (owner_app_user_id);

create table if not exists child_private_share_snapshot (
  share_id uuid primary key,
  owner_app_user_id uuid not null references app_user (app_user_id),
  source_project_id uuid not null references child_private_project (project_id) on delete cascade,
  published_title text not null check (char_length(published_title) between 1 and 80),
  published_body text not null,
  audience_app_user_ids uuid[] not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint child_private_share_audience_nonempty
    check (cardinality(audience_app_user_ids) >= 1)
);

create index if not exists child_private_share_owner_idx
  on child_private_share_snapshot (owner_app_user_id);

create index if not exists child_private_share_audience_gin
  on child_private_share_snapshot using gin (audience_app_user_ids);

alter table child_private_project enable row level security;
alter table child_private_portfolio_item enable row level security;
alter table child_private_share_snapshot enable row level security;
alter table child_private_project force row level security;
alter table child_private_portfolio_item force row level security;
alter table child_private_share_snapshot force row level security;

-- Owner full access. Family GUC / membership is intentionally ignored here.
create policy child_private_project_owner_all on child_private_project
  for all to lumi_app
  using (owner_app_user_id::text = current_setting('lumi.app_user_id', true))
  with check (owner_app_user_id::text = current_setting('lumi.app_user_id', true));

create policy child_private_portfolio_owner_all on child_private_portfolio_item
  for all to lumi_app
  using (owner_app_user_id::text = current_setting('lumi.app_user_id', true))
  with check (owner_app_user_id::text = current_setting('lumi.app_user_id', true));

create policy child_private_share_owner_all on child_private_share_snapshot
  for all to lumi_app
  using (owner_app_user_id::text = current_setting('lumi.app_user_id', true))
  with check (owner_app_user_id::text = current_setting('lumi.app_user_id', true));

-- Named recipients see only the frozen snapshot body, never live projects.
create policy child_private_share_recipient_select on child_private_share_snapshot
  for select to lumi_app
  using (
    revoked_at is null
    and current_setting('lumi.app_user_id', true) <> ''
    and current_setting('lumi.app_user_id', true)::uuid = any (audience_app_user_ids)
  );

grant select, insert, update, delete
  on child_private_project, child_private_portfolio_item, child_private_share_snapshot
  to lumi_app;
