-- ══════════════════════════════════════════════════════════
--  RISE Opening Event — separate live-competition engine
--  (additive; does NOT touch the powerlifting schema in 001)
-- ══════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────
create type rise_scoring_mode as enum ('reps', 'time_fastest', 'time_longest', 'measure_max');
create type rise_status       as enum ('setup', 'live', 'ended');
create type rise_round_status as enum ('pending', 'active', 'done');
create type rise_entry_status as enum ('pending', 'active', 'done');

-- ── Events (one row per sub-event) ────────────────────────
create table rise_events (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  scoring_mode  rise_scoring_mode not null,
  is_team       boolean default false,
  unit          text not null default 'reps',   -- 'reps' | 'sec' | 'cm'
  config        jsonb default '{}',
  status        rise_status default 'setup',
  display_order int default 0,
  created_at    timestamptz default now()
);

-- ── Teams (RISE Battle Cycles only) ───────────────────────
create table rise_teams (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references rise_events(id) on delete cascade,
  name          text not null,
  display_order int default 0
);

-- ── Competitors (per-event roster — solo athletes or team members) ──
create type rise_gender as enum ('M', 'F');

create table rise_competitors (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references rise_events(id) on delete cascade,
  team_id       uuid references rise_teams(id) on delete set null,
  name          text not null,
  gender        rise_gender default 'M',
  display_order int default 0,
  meta          jsonb default '{}'
);

-- ── Rounds (qual / final / amrap; optional per event) ─────
create table rise_rounds (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references rise_events(id) on delete cascade,
  name          text not null,
  display_order int default 0,
  duration_sec  int,
  status        rise_round_status default 'pending',
  config        jsonb default '{}'
);

-- ── Entries (the scoreable unit — carries every score type) ──
create table rise_entries (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid references rise_events(id) on delete cascade,
  round_id         uuid references rise_rounds(id) on delete cascade,
  competitor_id    uuid references rise_competitors(id) on delete cascade,
  team_id          uuid references rise_teams(id) on delete cascade,
  counter          int default 0,            -- reps
  time_ms          bigint,                   -- finished timer result
  timer_started_at timestamptz,
  timer_running    boolean default false,
  measure_value    numeric(7,2),             -- box-jump cm
  phase            text,                     -- RISE final: 'chipper' | 'amrap'
  status           rise_entry_status default 'pending',
  meta             jsonb default '{}',
  updated_at       timestamptz default now()
);

create index rise_entries_event_idx on rise_entries(event_id);
create index rise_entries_round_idx on rise_entries(round_id);

-- ── Judge tokens (anonymous access via unguessable link) ──
create table rise_judge_tokens (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references rise_events(id) on delete cascade,
  token         text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  label         text,
  scope         jsonb default '{}',   -- { team_id?, competitor_id?, round_id? }
  created_at    timestamptz default now()
);

-- ══════════════════════════════════════════════════════════
--  RPCs — atomic mutations for judges (security definer → bypass RLS)
-- ══════════════════════════════════════════════════════════

-- Atomic counter adjust (prevents double-tap races, never goes below 0)
create or replace function rise_adjust_counter(p_entry_id uuid, p_delta int)
returns rise_entries
language plpgsql
security definer
set search_path = public
as $$
  declare result rise_entries;
begin
  update rise_entries
     set counter = greatest(0, counter + p_delta),
         updated_at = now()
   where id = p_entry_id
  returning * into result;
  return result;
end;
$$;

-- Start a timer
create or replace function rise_timer_start(p_entry_id uuid)
returns rise_entries
language plpgsql
security definer
set search_path = public
as $$
  declare result rise_entries;
begin
  update rise_entries
     set timer_running = true,
         timer_started_at = now(),
         status = 'active',
         updated_at = now()
   where id = p_entry_id
  returning * into result;
  return result;
end;
$$;

-- Stop a timer — compute elapsed ms from timer_started_at
create or replace function rise_timer_stop(p_entry_id uuid)
returns rise_entries
language plpgsql
security definer
set search_path = public
as $$
  declare result rise_entries;
begin
  update rise_entries
     set time_ms = case
                     when timer_started_at is not null
                     then greatest(0, (extract(epoch from (now() - timer_started_at)) * 1000)::bigint)
                     else time_ms
                   end,
         timer_running = false,
         status = 'done',
         updated_at = now()
   where id = p_entry_id
  returning * into result;
  return result;
end;
$$;

grant execute on function rise_adjust_counter(uuid, int) to anon, authenticated;
grant execute on function rise_timer_start(uuid)          to anon, authenticated;
grant execute on function rise_timer_stop(uuid)           to anon, authenticated;

-- ══════════════════════════════════════════════════════════
--  Row Level Security
-- ══════════════════════════════════════════════════════════
alter table rise_events       enable row level security;
alter table rise_teams        enable row level security;
alter table rise_competitors  enable row level security;
alter table rise_rounds       enable row level security;
alter table rise_entries      enable row level security;
alter table rise_judge_tokens enable row level security;

-- Public read on everything spectators / judges need
create policy "rise_public_read_events"      on rise_events       for select using (true);
create policy "rise_public_read_teams"       on rise_teams        for select using (true);
create policy "rise_public_read_competitors" on rise_competitors  for select using (true);
create policy "rise_public_read_rounds"      on rise_rounds       for select using (true);
create policy "rise_public_read_entries"     on rise_entries      for select using (true);
create policy "rise_public_read_tokens"      on rise_judge_tokens for select using (true);

-- Admin (authenticated) full write on config tables
create policy "rise_auth_write_events"      on rise_events       for all using (auth.role() = 'authenticated');
create policy "rise_auth_write_teams"       on rise_teams        for all using (auth.role() = 'authenticated');
create policy "rise_auth_write_competitors" on rise_competitors  for all using (auth.role() = 'authenticated');
create policy "rise_auth_write_tokens"      on rise_judge_tokens for all using (auth.role() = 'authenticated');

-- Live tables: permissive write (closed one-day event behind unguessable URLs).
-- Judges score via anon key; admin also writes here.
create policy "rise_public_write_rounds"  on rise_rounds  for all using (true) with check (true);
create policy "rise_public_write_entries" on rise_entries for all using (true) with check (true);

-- ══════════════════════════════════════════════════════════
--  Realtime
-- ══════════════════════════════════════════════════════════
alter publication supabase_realtime add table rise_entries;
alter publication supabase_realtime add table rise_rounds;
alter publication supabase_realtime add table rise_events;
