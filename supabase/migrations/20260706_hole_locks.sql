-- Adds per-hole score locking. Run this in the Supabase SQL editor
-- (Dashboard > SQL Editor > New query > paste > Run) on projects created
-- before this migration. New projects get it via schema.sql.

create table hole_locks (
  team_id     uuid not null references teams(id) on delete cascade,
  hole_number int  not null check (hole_number between 1 and 18),
  locked_at   timestamptz not null default now(),
  primary key (team_id, hole_number)
);

alter table hole_locks enable row level security;
