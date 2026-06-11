-- ══════════════════════════════════════════════════════════
--  RISE Opening Event — seed data
--  Safe to re-run: uses slugs / names as natural keys.
-- ══════════════════════════════════════════════════════════

-- ── The 5 events ──────────────────────────────────────────
insert into rise_events (name, slug, scoring_mode, is_team, unit, config, display_order) values
  ('RISE Battle Cycles',     'rise-battle-cycles',  'reps',         true,  'reps',
     '{"qual_duration":180,"final_duration":360,"chipper":{"mu":0,"pu":0,"dips":0}}', 1),
  ('Evolve Deadlift Ladder', 'evolve-deadlift-ladder','reps',       false, 'reps',
     '{"amrap_weight":100,"qualifiers":3,"top_bar":220}', 2),
  ('LFTD Hyrox Challenge',   'lftd-hyrox',          'time_fastest', false, 'sec', '{}', 3),
  ('Turbo Deadhang',         'turbo-deadhang',      'time_longest', false, 'sec', '{}', 4),
  ('RLNTLSS Box Jumps',      'rlntlss-box-jumps',   'measure_max',  false, 'cm',  '{}', 5)
on conflict (slug) do nothing;

-- ── RISE Battle Cycles: teams + members + rounds ──────────
do $$
declare
  v_event uuid;
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_t4 uuid;
begin
  select id into v_event from rise_events where slug = 'rise-battle-cycles';

  -- Teams (only seed if none exist yet for this event)
  if not exists (select 1 from rise_teams where event_id = v_event) then
    insert into rise_teams (event_id, name, display_order) values
      (v_event, 'Team 1', 1) returning id into v_t1;
    insert into rise_teams (event_id, name, display_order) values
      (v_event, 'Team 2', 2) returning id into v_t2;
    insert into rise_teams (event_id, name, display_order) values
      (v_event, 'Team 3', 3) returning id into v_t3;
    insert into rise_teams (event_id, name, display_order) values
      (v_event, 'Team 4', 4) returning id into v_t4;

    insert into rise_competitors (event_id, team_id, name, display_order) values
      (v_event, v_t1, 'yahya', 1),
      (v_event, v_t1, 'Salamony', 2),
      (v_event, v_t1, 'abdullah samir', 3),
      (v_event, v_t1, 'Youssef fathy', 4),
      (v_event, v_t1, 'osama', 5),
      (v_event, v_t2, 'barakat', 1),
      (v_event, v_t2, 'simo', 2),
      (v_event, v_t2, 'Ahmed Tantawy', 3),
      (v_event, v_t2, 'shaer', 4),
      (v_event, v_t2, 'yousef ayman', 5),
      (v_event, v_t3, 'soona', 1),
      (v_event, v_t3, 'Kamel', 2),
      (v_event, v_t3, 'Mazen', 3),
      (v_event, v_t3, 'Omar Khallad', 4),
      (v_event, v_t3, 'yassin naem', 5),
      (v_event, v_t4, 'box', 1),
      (v_event, v_t4, 'johny', 2),
      (v_event, v_t4, 'Youssef Ehab', 3),
      (v_event, v_t4, 'Zeiad Ali', 4),
      (v_event, v_t4, 'Maher', 5);
  end if;

  -- Rounds
  if not exists (select 1 from rise_rounds where event_id = v_event) then
    insert into rise_rounds (event_id, name, display_order, duration_sec, config) values
      (v_event, 'Qualification', 1, 180, '{}'),
      (v_event, 'Final',         2, 360, '{"phase":"chipper"}');
  end if;
end $$;
