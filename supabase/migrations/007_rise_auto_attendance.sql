-- ══════════════════════════════════════════════════════════
--  RISE — Auto attendance from recorded scores
--  When an entry gets a recorded result (reps, time, or measure),
--  mark the athlete(s) checked in. Covers every scoring path.
--  Additive + re-runnable.
-- ══════════════════════════════════════════════════════════

create or replace function rise_mark_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Does this entry carry a recorded result?
  if coalesce(new.counter, 0) > 0 or new.time_ms is not null or new.measure_value is not null then
    -- Individual athlete entry → mark that athlete present.
    if new.competitor_id is not null then
      update rise_competitors
         set checked_in = true,
             checked_in_at = coalesce(checked_in_at, now())
       where id = new.competitor_id and checked_in is distinct from true;
    end if;
    -- Team entry (e.g. Hyrox) → mark every team member present.
    if new.team_id is not null then
      update rise_competitors
         set checked_in = true,
             checked_in_at = coalesce(checked_in_at, now())
       where team_id = new.team_id and checked_in is distinct from true;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rise_entries_attendance on rise_entries;
create trigger rise_entries_attendance
  after insert or update on rise_entries
  for each row execute function rise_mark_attendance();

-- One-time backfill: mark anyone who already has a recorded result.
update rise_competitors c
   set checked_in = true,
       checked_in_at = coalesce(c.checked_in_at, now())
 where c.checked_in is distinct from true
   and exists (
     select 1 from rise_entries e
      where (e.competitor_id = c.id or e.team_id = c.team_id)
        and (coalesce(e.counter, 0) > 0 or e.time_ms is not null or e.measure_value is not null)
   );
