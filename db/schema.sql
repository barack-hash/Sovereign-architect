-- Sovereign — Neon Postgres schema.
-- Run once against the Neon database (SQL editor or psql). Idempotent.
--
-- Design notes:
-- * The Plan stays one jsonb blob. The engine consumes a whole Plan object;
--   shredding it into relational tables would buy nothing and cost a lot.
-- * ids are client-generated text, not server uuids, because plans can be
--   created offline and synced later — the client must own id generation.
--   The composite primary key (owner_id, id) namespaces every id per owner,
--   so one user can never collide with or overwrite another user's row no
--   matter what id their client sends.
-- * owner_id is the Clerk user id (e.g. 'user_2abc...'), verified server-side
--   from the session token. It is never taken from the request body.

create table if not exists plans (
  owner_id       text        not null,
  id             text        not null,
  name           text        not null,
  schema_version int         not null,
  data           jsonb       not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (owner_id, id)
);

create index if not exists plans_owner_updated
  on plans (owner_id, updated_at desc);

create table if not exists plan_snapshots (
  owner_id   text        not null,
  id         text        not null,
  plan_id    text        not null,
  name       text        not null,
  data       jsonb       not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  foreign key (owner_id, plan_id)
    references plans (owner_id, id) on delete cascade
);

create index if not exists plan_snapshots_by_plan
  on plan_snapshots (owner_id, plan_id, created_at desc);
