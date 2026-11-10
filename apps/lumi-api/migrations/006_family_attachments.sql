-- Family attachment metadata (not diary blobs). Object bytes live in the
-- attachment object store; this table only holds opaque IDs, digests, and erase
-- generation so RLS can deny cross-family metadata reads.

create table if not exists family_attachment (
  family_id uuid not null references family (family_id),
  attachment_id uuid not null,
  child_id text not null,
  event_id text not null,
  created_by uuid not null references app_user (app_user_id),
  erase_generation integer null,
  erased_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, attachment_id),
  constraint family_attachment_erase_nonnegative
    check (erase_generation is null or erase_generation >= 1)
);

create table if not exists family_attachment_object (
  family_id uuid not null,
  attachment_id uuid not null,
  role text not null check (role in ('display', 'thumbnail')),
  object_key text not null,
  byte_length integer not null check (byte_length > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  activated_at timestamptz not null default now(),
  primary key (family_id, attachment_id, role),
  foreign key (family_id, attachment_id)
    references family_attachment (family_id, attachment_id)
    on delete cascade
);

create index if not exists family_attachment_family_idx
  on family_attachment (family_id);

create index if not exists family_attachment_object_family_idx
  on family_attachment_object (family_id);

alter table family_attachment enable row level security;
alter table family_attachment_object enable row level security;
alter table family_attachment force row level security;
alter table family_attachment_object force row level security;

create policy family_attachment_member_all on family_attachment
  for all to lumi_app
  using (
    family_id::text = current_setting('lumi.family_id', true)
    and exists (
      select 1 from family_membership m
      where m.family_id = family_attachment.family_id
        and m.app_user_id::text = current_setting('lumi.app_user_id', true)
        and m.status = 'active'
    )
  )
  with check (
    family_id::text = current_setting('lumi.family_id', true)
    and exists (
      select 1 from family_membership m
      where m.family_id = family_attachment.family_id
        and m.app_user_id::text = current_setting('lumi.app_user_id', true)
        and m.status = 'active'
    )
  );

create policy family_attachment_object_member_all on family_attachment_object
  for all to lumi_app
  using (
    family_id::text = current_setting('lumi.family_id', true)
    and exists (
      select 1 from family_membership m
      where m.family_id = family_attachment_object.family_id
        and m.app_user_id::text = current_setting('lumi.app_user_id', true)
        and m.status = 'active'
    )
  )
  with check (
    family_id::text = current_setting('lumi.family_id', true)
    and exists (
      select 1 from family_membership m
      where m.family_id = family_attachment_object.family_id
        and m.app_user_id::text = current_setting('lumi.app_user_id', true)
        and m.status = 'active'
    )
  );

grant select, insert, update, delete on family_attachment, family_attachment_object to lumi_app;
