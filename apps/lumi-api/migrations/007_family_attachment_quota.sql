-- Durable per-family photo quota ledger. Server-only (no RLS): rows are mutated
-- by the API process under SELECT ... FOR UPDATE so concurrent intents cannot
-- both pass a stale read. Upload intents themselves stay in process memory;
-- expired-intent GC releases reserved_bytes here.

create table if not exists family_attachment_quota (
  family_id uuid primary key,
  used_bytes bigint not null default 0 check (used_bytes >= 0),
  reserved_bytes bigint not null default 0 check (reserved_bytes >= 0),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on family_attachment_quota to lumi_app;
