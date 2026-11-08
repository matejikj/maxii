-- Invitation secrets are stored as hashes only. Runtime role stays read-scoped.

create table if not exists family_invitation (
  invitation_id uuid primary key,
  family_id uuid not null references family (family_id),
  role text not null check (role = 'caregiver'),
  invited_by uuid not null references app_user (app_user_id),
  token_hash text not null unique,
  status text not null check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  attempts int not null default 0,
  accepted_by uuid null references app_user (app_user_id),
  created_at timestamptz not null default now()
);

create index if not exists family_invitation_family_idx
  on family_invitation (family_id, status);

alter table family_invitation enable row level security;
alter table family_invitation force row level security;

create policy family_invitation_admin_read on family_invitation
  for select to lumi_app
  using (
    exists (
      select 1 from family_membership m
      where m.family_id = family_invitation.family_id
        and m.app_user_id::text = current_setting('lumi.app_user_id', true)
        and m.status = 'active'
        and m.role = 'admin'
    )
  );

grant select on family_invitation to lumi_app;

alter table family add column if not exists erased_at timestamptz null;
