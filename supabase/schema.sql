-- Golf Event Tournament App schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query > paste > Run).
-- All access goes through the Next.js server using the service-role key, so RLS is
-- enabled with no policies (deny-all for anon/authenticated) purely as a safety net.

create table events (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  event_date    date,
  format        text not null check (format in ('scramble','stroke','best_ball','stableford')),
  status        text not null default 'setup' check (status in ('setup','live','final')),
  organizer_pin text not null,
  config        jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create table holes (
  event_id      uuid not null references events(id) on delete cascade,
  hole_number   int  not null check (hole_number between 1 and 18),
  par           int  not null check (par between 3 and 6),
  stroke_index  int  check (stroke_index between 1 and 18),
  primary key (event_id, hole_number)
);

create table teams (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  name       text not null,
  join_code  text not null,
  sort_order int  not null default 0,
  unique (event_id, join_code)
);

create table players (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  name       text not null,
  handicap   numeric(4,1) not null default 0,
  sort_order int  not null default 0
);

create table scores (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  player_id   uuid references players(id) on delete cascade,  -- NULL = team score (scramble)
  hole_number int  not null check (hole_number between 1 and 18),
  strokes     int  not null check (strokes between 1 and 20),
  updated_at  timestamptz not null default now()
);

-- Idempotent upsert targets. player_id is nullable so two partial unique indexes:
create unique index scores_team_hole   on scores(team_id, hole_number)   where player_id is null;
create unique index scores_player_hole on scores(player_id, hole_number) where player_id is not null;
create index scores_event on scores(event_id);

-- A team's scores for a hole become read-only once locked (organizer can unlock).
create table hole_locks (
  team_id     uuid not null references teams(id) on delete cascade,
  hole_number int  not null check (hole_number between 1 and 18),
  locked_at   timestamptz not null default now(),
  primary key (team_id, hole_number)
);

create table contests (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  name         text not null,
  prize_amount numeric(8,2) not null default 0,
  winner_name  text
);

-- Deny-all RLS: the app only ever connects with the service-role key, which bypasses RLS.
alter table events   enable row level security;
alter table holes    enable row level security;
alter table teams    enable row level security;
alter table players  enable row level security;
alter table scores     enable row level security;
alter table hole_locks enable row level security;
alter table contests   enable row level security;
