-- At most one live session per venue.
--
-- Since an account owns exactly one venue, this is effectively "one live
-- session per user". Enforced in the database so two concurrent "Go live"
-- submissions cannot both win the race.

-- Existing data may already have several live sessions for a venue, which
-- would make the index below fail to build. Retire all but the most recently
-- started one per venue first.
with ranked as (
  select
    id,
    row_number() over (
      partition by venue_id
      order by started_at desc nulls last, created_at desc
    ) as rn
  from public.sessions
  where status = 'live'
)
update public.sessions as s
set
  status = 'completed',
  ended_at = coalesce(s.ended_at, now())
from ranked
where s.id = ranked.id
  and ranked.rn > 1;

-- Partial index: only 'live' rows participate, so a venue can still keep any
-- number of scheduled and completed sessions.
create unique index if not exists sessions_one_live_per_venue
  on public.sessions (venue_id)
  where status = 'live';
