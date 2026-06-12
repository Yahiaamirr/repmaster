-- ══════════════════════════════════════════════════════════
--  RISE — Manual leaderboard (per event)
--  Additive + re-runnable. When rise_events.manual_leaderboard is
--  true, the public board renders rise_manual_results instead of
--  the live rise_entries standings.
-- ══════════════════════════════════════════════════════════

-- ── 1. Per-event flag ─────────────────────────────────────
alter table rise_events
  add column if not exists manual_leaderboard boolean default false;

-- ── 2. Manual standings rows ──────────────────────────────
create table if not exists rise_manual_results (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references rise_events(id)      on delete cascade,
  competitor_id uuid references rise_competitors(id) on delete cascade,
  team_id       uuid references rise_teams(id)       on delete cascade,
  value_text    text,
  manual_rank   int default 0,
  included      boolean default true,
  created_at    timestamptz default now()
);

create index if not exists rise_manual_results_event_idx on rise_manual_results(event_id);
create unique index if not exists rise_manual_results_event_competitor
  on rise_manual_results(event_id, competitor_id) where competitor_id is not null;
create unique index if not exists rise_manual_results_event_team
  on rise_manual_results(event_id, team_id) where team_id is not null;

-- ── 3. RLS — public read, authenticated write ─────────────
alter table rise_manual_results enable row level security;
drop policy if exists "rise_public_read_manual" on rise_manual_results;
create policy "rise_public_read_manual" on rise_manual_results for select using (true);
drop policy if exists "rise_auth_write_manual" on rise_manual_results;
create policy "rise_auth_write_manual" on rise_manual_results
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── 4. Realtime (guarded — re-runnable) ───────────────────
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and tablename = 'rise_manual_results') then
    alter publication supabase_realtime add table rise_manual_results;
  end if;
end $$;
