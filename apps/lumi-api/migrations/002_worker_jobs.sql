-- Durable worker jobs. Leases live in PostgreSQL so two worker processes can
-- share one database without claiming the same row.

create table if not exists worker_job (
  job_id uuid primary key,
  kind text not null,
  payload_json jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'leased', 'done', 'failed')),
  available_at timestamptz not null default now(),
  lease_owner text null,
  lease_expires_at timestamptz null,
  attempts int not null default 0,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_job_claim_idx
  on worker_job (status, available_at, lease_expires_at);

grant select, insert, update on worker_job to lumi_app;
