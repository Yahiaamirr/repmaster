-- ══════════════════════════════════════════════════════════
--  RepMaster — Initial Schema
-- ══════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── Organizations ─────────────────────────────────────────
create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz default now()
);

-- ── Tournaments ───────────────────────────────────────────
create type tournament_status as enum ('setup', 'live', 'ended');

create table tournaments (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references organizations(id) on delete cascade,
  name             text not null,
  slug             text not null unique,
  date_start       date,
  date_end         date,
  status           tournament_status default 'setup',
  judges_per_attempt int default 1,  -- 1, 2, or 3
  flight_size      int default 8,    -- athletes per flight
  settings         jsonb default '{}',
  created_at       timestamptz default now()
);

-- ── Event Types (MU, PU, Dips, Squat — per tournament) ───
create table event_types (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name          text not null,  -- "MU", "PU", "Dips", "Squat"
  display_order int default 0,
  has_extras    boolean default false,  -- squat height / dips width etc.
  extra_fields  jsonb default '[]',     -- [{label, key, unit}]
  unique(tournament_id, name)
);

-- ── Weight Categories (per tournament) ────────────────────
create table categories (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name          text not null,  -- "Female", "-66", "-73" etc.
  display_order int default 0,
  unique(tournament_id, name)
);

-- ── Athletes ──────────────────────────────────────────────
create table athletes (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid references tournaments(id) on delete cascade,
  name             text not null,
  category_id      uuid references categories(id) on delete set null,
  competition_day  int default 1,   -- 1 or 2
  body_weight_kg   numeric(5,2),
  attendance       boolean default true,
  created_at       timestamptz default now()
);

-- ── Openers (one per athlete per event type) ──────────────
create table athlete_openers (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid references athletes(id) on delete cascade,
  event_type_id uuid references event_types(id) on delete cascade,
  opener_weight numeric(6,2),
  extras        jsonb default '{}',  -- {squat_height_cm: 30, dips_width_cm: 45}
  unique(athlete_id, event_type_id)
);

-- ── Flights ───────────────────────────────────────────────
create table flights (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid references tournaments(id) on delete cascade,
  event_type_id   uuid references event_types(id) on delete cascade,
  competition_day int default 1,
  name            text not null,  -- "A", "B", "C"
  platform_order  int default 0,
  created_at      timestamptz default now()
);

-- ── Flight Athlete Assignments ────────────────────────────
create table flight_athletes (
  id             uuid primary key default gen_random_uuid(),
  flight_id      uuid references flights(id) on delete cascade,
  athlete_id     uuid references athletes(id) on delete cascade,
  platform_order int default 0,
  unique(flight_id, athlete_id)
);

-- ── Attempts (3 per athlete per event type) ───────────────
create type attempt_status as enum ('pending', 'active', 'completed', 'skipped');

create table attempts (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid references athletes(id) on delete cascade,
  event_type_id   uuid references event_types(id) on delete cascade,
  attempt_number  int not null check (attempt_number between 1 and 3),
  declared_weight numeric(6,2),
  status          attempt_status default 'pending',
  created_at      timestamptz default now(),
  unique(athlete_id, event_type_id, attempt_number)
);

-- ── Scores (one per judge per attempt) ───────────────────
create type score_result as enum ('good_rep', 'no_rep');

create table scores (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid references attempts(id) on delete cascade,
  judge_id    uuid,   -- references auth.users — nullable for anonymous judge tokens
  judge_label text,   -- "Judge 1", "Head Judge" etc.
  result      score_result not null,
  created_at  timestamptz default now(),
  unique(attempt_id, judge_id)
);

-- ── Platform State (live "on platform" indicator) ─────────
create table platform_state (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade unique,
  flight_id     uuid references flights(id) on delete set null,
  athlete_id    uuid references athletes(id) on delete set null,
  attempt_id    uuid references attempts(id) on delete set null,
  updated_at    timestamptz default now()
);

-- ── Judge Tokens (short-lived access without full auth) ───
create table judge_tokens (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  token         text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  label         text,   -- "Judge 1", "Head Judge"
  judge_number  int,
  created_at    timestamptz default now(),
  expires_at    timestamptz
);

-- ══════════════════════════════════════════════════════════
--  Views (pre-computed for leaderboard queries)
-- ══════════════════════════════════════════════════════════

-- Per-athlete, per-event-type best score
create view athlete_event_maxes as
select
  a.athlete_id,
  a.event_type_id,
  et.name                                   as event_name,
  et.tournament_id,
  max(case
    when (
      select count(*) from scores s
      where s.attempt_id = a.id and s.result = 'good_rep'
    ) > (
      select count(*) from scores s
      where s.attempt_id = a.id and s.result = 'no_rep'
    )
    then a.declared_weight
    else 0
  end)                                      as best_weight
from attempts a
join event_types et on et.id = a.event_type_id
where a.status = 'completed'
group by a.athlete_id, a.event_type_id, et.name, et.tournament_id;

-- Full leaderboard view
create view leaderboard as
select
  ath.id                                    as athlete_id,
  ath.tournament_id,
  ath.name                                  as athlete_name,
  c.name                                    as category,
  c.display_order                           as category_order,
  ath.competition_day,
  coalesce(sum(aem.best_weight), 0)         as total,
  jsonb_object_agg(
    coalesce(aem.event_name, 'none'),
    coalesce(aem.best_weight, 0)
  ) filter (where aem.event_name is not null) as scores_by_event,
  rank() over (
    partition by ath.tournament_id, c.id
    order by coalesce(sum(aem.best_weight), 0) desc
  )                                         as rank_in_category
from athletes ath
left join categories c on c.id = ath.category_id
left join athlete_event_maxes aem on aem.athlete_id = ath.id
where ath.attendance = true
group by ath.id, ath.tournament_id, ath.name, c.id, c.name, c.display_order, ath.competition_day;

-- ══════════════════════════════════════════════════════════
--  Row Level Security
-- ══════════════════════════════════════════════════════════

alter table tournaments enable row level security;
alter table event_types enable row level security;
alter table categories enable row level security;
alter table athletes enable row level security;
alter table athlete_openers enable row level security;
alter table flights enable row level security;
alter table flight_athletes enable row level security;
alter table attempts enable row level security;
alter table scores enable row level security;
alter table platform_state enable row level security;
alter table judge_tokens enable row level security;

-- Public read on leaderboard-relevant tables (no auth needed for spectators)
create policy "public_read_tournaments" on tournaments for select using (true);
create policy "public_read_event_types" on event_types for select using (true);
create policy "public_read_categories" on categories for select using (true);
create policy "public_read_athletes" on athletes for select using (true);
create policy "public_read_flights" on flights for select using (true);
create policy "public_read_flight_athletes" on flight_athletes for select using (true);
create policy "public_read_attempts" on attempts for select using (true);
create policy "public_read_scores" on scores for select using (true);
create policy "public_read_platform_state" on platform_state for select using (true);

-- Full write access for authenticated users (admin/director)
-- In production: narrow this to specific roles via auth.jwt() claims
create policy "auth_write_tournaments" on tournaments for all using (auth.role() = 'authenticated');
create policy "auth_write_event_types" on event_types for all using (auth.role() = 'authenticated');
create policy "auth_write_categories" on categories for all using (auth.role() = 'authenticated');
create policy "auth_write_athletes" on athletes for all using (auth.role() = 'authenticated');
create policy "auth_write_openers" on athlete_openers for all using (auth.role() = 'authenticated');
create policy "auth_write_flights" on flights for all using (auth.role() = 'authenticated');
create policy "auth_write_flight_athletes" on flight_athletes for all using (auth.role() = 'authenticated');
create policy "auth_write_attempts" on attempts for all using (auth.role() = 'authenticated');
create policy "auth_write_scores" on scores for all using (auth.role() = 'authenticated');
create policy "auth_write_platform_state" on platform_state for all using (auth.role() = 'authenticated');
create policy "auth_write_judge_tokens" on judge_tokens for all using (auth.role() = 'authenticated');
create policy "auth_read_judge_tokens" on judge_tokens for select using (auth.role() = 'authenticated');

-- ══════════════════════════════════════════════════════════
--  Realtime (enable broadcast for live features)
-- ══════════════════════════════════════════════════════════
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table attempts;
alter publication supabase_realtime add table platform_state;
