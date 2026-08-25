-- Facilities for co-branding (Open Dinks | {facility name}).
-- Each venue belongs to a facility owned/configured by the host account.
-- There is no global default facility — branding comes from the account's facility.

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  tagline text not null default '',
  created_at timestamptz not null default now()
);

alter table public.venues
  add column if not exists facility_id uuid references public.facilities (id) on delete restrict;

-- Backfill existing venues: one facility per venue named after the venue.
insert into public.facilities (slug, name, short_name, tagline)
select
  left(v.slug, 48),
  v.name,
  left(v.name, 32),
  ''
from public.venues v
where v.facility_id is null
on conflict (slug) do nothing;

update public.venues v
set facility_id = f.id
from public.facilities f
where v.facility_id is null
  and f.slug = left(v.slug, 48);

do $$
begin
  alter table public.venues
    alter column facility_id set not null;
exception
  when others then null;
end $$;

create index if not exists venues_facility_id_idx on public.venues (facility_id);

alter table public.facilities enable row level security;

drop policy if exists "Anyone can read facilities" on public.facilities;
create policy "Anyone can read facilities"
  on public.facilities for select to anon, authenticated
  using (true);

drop policy if exists "Authenticated can create facilities" on public.facilities;
create policy "Authenticated can create facilities"
  on public.facilities for insert to authenticated
  with check (true);

drop policy if exists "Venue owners update facilities" on public.facilities;
create policy "Venue owners update facilities"
  on public.facilities for update to authenticated
  using (
    exists (
      select 1
      from public.venues v
      join public.venue_members vm on vm.venue_id = v.id
      where v.facility_id = facilities.id
        and vm.user_id = auth.uid()
        and vm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.venues v
      join public.venue_members vm on vm.venue_id = v.id
      where v.facility_id = facilities.id
        and vm.user_id = auth.uid()
        and vm.role in ('owner', 'admin')
    )
  );
