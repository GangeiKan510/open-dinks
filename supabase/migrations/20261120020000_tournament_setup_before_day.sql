-- Setup (categories, teams, settings) is allowed as soon as the facility has
-- a paid day that has not ended, including days still ahead. Building a draw
-- stays limited to a paid day plus the 6:00 AM grace.

create or replace function public.facility_tournament_setup(
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
  v_today date;
begin
  if public.facility_tournament_open(p_facility_id, p_at, p_tz) then
    return true;
  end if;

  v_today := (p_at at time zone coalesce(nullif(p_tz, ''), 'UTC'))::date;
  return exists (
    select 1
    from public.tournament_passes p
    where p.facility_id = p_facility_id
      and p.ends_on >= v_today
  );
end;
$$;

revoke all on function public.facility_tournament_setup(uuid, timestamptz, text) from public;
grant execute on function public.facility_tournament_setup(uuid, timestamptz, text) to anon, authenticated;

create or replace function public.tournament_document_has_draw(doc jsonb)
returns boolean
language sql
immutable
as $$
  select
    coalesce(doc->>'phase', 'setup') <> 'setup'
    or exists (
      select 1
      from jsonb_array_elements(coalesce(doc->'categories', '[]'::jsonb)) as cat
      where coalesce(cat->>'phase', 'setup') <> 'setup'
    );
$$;

revoke all on function public.tournament_document_has_draw(jsonb) from public;

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
     or not public.facility_tournament_setup(v_facility, now(), v_tz) then
    raise exception 'Tournament mode is locked' using errcode = 'P0403';
  end if;

  if not public.facility_tournament_open(v_facility, now(), v_tz)
     and public.tournament_document_has_draw(new.document) then
    raise exception 'Brackets can be built on a tournament day'
      using errcode = 'P0403';
  end if;

  return new;
end;
$$;
