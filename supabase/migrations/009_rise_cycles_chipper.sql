-- RISE Battle Cycles final buy-in (chipper): set reps + loads.
-- Muscle-ups 10 @ 10kg, Pull-ups 20 @ 30kg, Dips 40 @ 50kg.
-- Merges into the existing config so other keys (durations) are preserved.

update rise_events
set config = config || jsonb_build_object(
  'chipper', jsonb_build_object(
    'mu', 10, 'pu', 20, 'dips', 40,
    'mu_kg', 10, 'pu_kg', 30, 'dips_kg', 50
  )
)
where slug = 'rise-battle-cycles';
