-- Remove women from the Evolve Deadlift Ladder roster/leaderboard.
-- Existing score/manual rows tied to these competitors are removed by cascade.

delete from rise_competitors c
using rise_events e
where c.event_id = e.id
  and e.slug = 'evolve-deadlift-ladder'
  and c.gender = 'F';
