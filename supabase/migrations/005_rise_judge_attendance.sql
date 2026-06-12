-- ══════════════════════════════════════════════════════════
--  RISE — Judge identity, judging log & per-event attendance
--  Additive + re-runnable. Apply in the Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════

-- ── 1. Judge identity on tokens ───────────────────────────
alter table rise_judge_tokens
  add column if not exists judge_name   text,
  add column if not exists last_seen_at timestamptz;

-- ── 2. Per-event attendance (rise_competitors rows are per-event) ──
alter table rise_competitors
  add column if not exists checked_in    boolean default false,
  add column if not exists checked_in_at timestamptz;

-- ── 3. Judging log — one row per judge ↔ athlete/team pairing ──
create table if not exists rise_judge_log (
  id            uuid primary key default gen_random_uuid(),
  token_id      uuid references rise_judge_tokens(id) on delete cascade,
  event_id      uuid references rise_events(id)       on delete cascade,
  competitor_id uuid references rise_competitors(id)  on delete set null,
  team_id       uuid references rise_teams(id)        on delete set null,
  judge_name    text,
  score_count   int default 0,
  first_at      timestamptz default now(),
  last_at       timestamptz default now()
);

create unique index if not exists rise_judge_log_token_competitor
  on rise_judge_log (token_id, competitor_id) where competitor_id is not null;
create unique index if not exists rise_judge_log_token_team
  on rise_judge_log (token_id, team_id) where team_id is not null;
create index if not exists rise_judge_log_event_idx on rise_judge_log (event_id);

-- ── 4. RLS — public read; writes only through the RPCs below ──
alter table rise_judge_log enable row level security;
drop policy if exists "rise_public_read_judge_log" on rise_judge_log;
create policy "rise_public_read_judge_log" on rise_judge_log for select using (true);

-- ── 5. RPC: judge registers their name ────────────────────
create or replace function rise_register_judge(p_token text, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update rise_judge_tokens
     set judge_name   = nullif(trim(p_name), ''),
         last_seen_at = now()
   where token = p_token;
end;
$$;

-- ── 6. RPC: log that this judge judged an entry's athlete/team ──
--  Called fire-and-forget when a judge starts scoring an athlete.
--  One device per token (presence lock) → no concurrent upserts per token.
create or replace function rise_log_judge(p_token text, p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token rise_judge_tokens;
  v_entry rise_entries;
  v_found int;
begin
  select * into v_token from rise_judge_tokens where token = p_token;
  if not found then return; end if;
  select * into v_entry from rise_entries where id = p_entry_id;
  if not found then return; end if;

  if v_entry.competitor_id is not null then
    update rise_judge_log
       set score_count = score_count + 1,
           last_at     = now(),
           judge_name  = coalesce(v_token.judge_name, judge_name)
     where token_id = v_token.id and competitor_id = v_entry.competitor_id;
    get diagnostics v_found = row_count;
    if v_found = 0 then
      insert into rise_judge_log (token_id, event_id, competitor_id, team_id, judge_name, score_count)
      values (v_token.id, v_entry.event_id, v_entry.competitor_id, v_entry.team_id, v_token.judge_name, 1);
    end if;
  elsif v_entry.team_id is not null then
    update rise_judge_log
       set score_count = score_count + 1,
           last_at     = now(),
           judge_name  = coalesce(v_token.judge_name, judge_name)
     where token_id = v_token.id and team_id = v_entry.team_id;
    get diagnostics v_found = row_count;
    if v_found = 0 then
      insert into rise_judge_log (token_id, event_id, competitor_id, team_id, judge_name, score_count)
      values (v_token.id, v_entry.event_id, null, v_entry.team_id, v_token.judge_name, 1);
    end if;
  end if;
end;
$$;

grant execute on function rise_register_judge(text, text) to anon, authenticated;
grant execute on function rise_log_judge(text, uuid)       to anon, authenticated;

-- ── 7. Realtime for live admin views (guarded — re-runnable) ──
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and tablename = 'rise_judge_log') then
    alter publication supabase_realtime add table rise_judge_log;
  end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and tablename = 'rise_competitors') then
    alter publication supabase_realtime add table rise_competitors;
  end if;
end $$;
