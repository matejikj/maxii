-- Logical markers for backup/erasure bookkeeping. The durable erasure ledger
-- itself must also live off-host; this table is not the sole source of truth.

create table if not exists family_erasure_event (
  family_id uuid primary key,
  erased_at timestamptz not null,
  erase_generation integer not null check (erase_generation >= 1),
  registry_persisted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists remote_backup_attempt (
  backup_id uuid primary key,
  scope text not null check (scope in ('ops_host', 'family_archive')),
  family_id uuid null,
  status text not null check (status in ('running', 'completed', 'failed')),
  digest_sha256 text null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists remote_backup_attempt_completed_idx
  on remote_backup_attempt (completed_at desc);
