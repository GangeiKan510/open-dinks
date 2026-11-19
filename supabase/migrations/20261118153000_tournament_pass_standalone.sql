-- Tournament days no longer require a paid club month.
-- Databases that already applied 20261118140000 keep the old function until this runs.

create or replace function public.facility_has_tournament_access(
  p_facility_id uuid,
  p_on date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tournament_passes p
    where p.facility_id = p_facility_id
      and p.starts_on <= p_on
      and p.ends_on >= p_on
  );
$$;
