-- A tournament day stays open until 06:00 the next morning in the venue timezone.
-- Consecutive days already cover each other, so the extra hours land after the
-- last day of a run. A gap between dates closes at 06:00.

create or replace function public.facility_tournament_open(
  p_facility_id uuid,
  p_at timestamptz,
  p_tz text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_local timestamp;
  v_today date;
begin
  v_local := p_at at time zone coalesce(nullif(p_tz, ''), 'UTC');
  v_today := v_local::date;

  if public.facility_has_tournament_access(p_facility_id, v_today) then
    return true;
  end if;

  return extract(hour from v_local) < 6
    and public.facility_has_tournament_access(p_facility_id, v_today - 1);
end;
$$;

revoke all on function public.facility_tournament_open(uuid, timestamptz, text) from public;
grant execute on function public.facility_tournament_open(uuid, timestamptz, text) to anon, authenticated;

create or replace function public.tournament_desk_open(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_facility uuid;
  v_tz text;
begin
  select v.facility_id, v.timezone
    into v_facility, v_tz
  from public.tournament_umpire_links l
  join public.tournaments t on t.id = l.tournament_id
  join public.venue_members vm
    on vm.user_id = t.created_by
   and vm.role in ('owner', 'admin')
  join public.venues v on v.id = vm.venue_id
  where l.token = p_token
  order by v.created_at
  limit 1;

  if v_facility is null then
    return false;
  end if;

  return public.facility_tournament_open(v_facility, now(), v_tz);
end;
$$;

create or replace function public.reject_tournament_without_pass()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_facility uuid;
  v_tz text;
begin
  select v.facility_id, v.timezone
    into v_facility, v_tz
  from public.venue_members vm
  join public.venues v on v.id = vm.venue_id
  where vm.user_id = new.created_by
    and vm.role in ('owner', 'admin')
  order by v.created_at
  limit 1;

  if v_facility is null
     or not public.facility_tournament_open(v_facility, now(), v_tz) then
    raise exception 'Tournament mode is locked' using errcode = 'P0403';
  end if;
  return new;
end;
$$;
