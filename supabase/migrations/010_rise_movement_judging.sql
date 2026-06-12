-- RISE Battle Cycles: three judges per team, one per movement.
-- Each team's entry keeps a single row; the three movement counts live in
-- meta.reps = { mu, pu, dips } and counter is kept as their sum, so every
-- existing read of counter (ranking, leaderboard, control) stays correct.

-- Atomically bump one movement's count (clamped >= 0) and recompute the total.
-- Row-locked so the three movement judges on a team never lose an update.
create or replace function rise_adjust_movement(p_entry_id uuid, p_movement text, p_delta int)
returns rise_entries
language plpgsql
security definer
set search_path = public
as $$
  declare
    result rise_entries;
    v_reps jsonb;
    v_mu int;
    v_pu int;
    v_dips int;
begin
  if p_movement not in ('mu', 'pu', 'dips') then
    raise exception 'invalid movement: %', p_movement;
  end if;

  select coalesce(meta->'reps', '{}'::jsonb) into v_reps
    from rise_entries where id = p_entry_id for update;

  v_mu   := coalesce((v_reps->>'mu')::int, 0);
  v_pu   := coalesce((v_reps->>'pu')::int, 0);
  v_dips := coalesce((v_reps->>'dips')::int, 0);

  if p_movement = 'mu' then
    v_mu := greatest(0, v_mu + p_delta);
  elsif p_movement = 'pu' then
    v_pu := greatest(0, v_pu + p_delta);
  else
    v_dips := greatest(0, v_dips + p_delta);
  end if;

  update rise_entries
     set meta = jsonb_set(coalesce(meta, '{}'::jsonb), '{reps}',
                  jsonb_build_object('mu', v_mu, 'pu', v_pu, 'dips', v_dips)),
         counter = v_mu + v_pu + v_dips,
         status = case when status = 'pending' then 'active' else status end,
         updated_at = now()
   where id = p_entry_id
  returning * into result;

  return result;
end;
$$;

grant execute on function rise_adjust_movement(uuid, text, int) to anon, authenticated;

-- Flag the event so the app uses per-movement judging (3 links/team, split UI).
update rise_events
set config = config || '{"movement_scored": true}'::jsonb
where slug = 'rise-battle-cycles';
