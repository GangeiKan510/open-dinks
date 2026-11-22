-- Club subscription and tournament-day passes.
-- Open play and booking follow the trial or a paid club period.
-- Tournament writes require a pass that covers the venue's local date.
-- A club month is not required.
-- Players and public scoreboards are not gated. Billing rows are written by the
-- service role (PayMongo webhook), not by the host's browser session.

create table if not exists public.facility_billing (
  facility_id uuid primary key references public.facilities (id) on delete cascade,
  trial_ends_at timestamptz not null,
  club_status text not null default 'none'
    check (club_status in ('none', 'active', 'past_due', 'canceled')),
  club_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.paymongo_payments (
  checkout_id text primary key,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  kind text not null check (kind in ('club', 'day', 'weekend')),
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_passes (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  kind text not null check (kind in ('day', 'weekend')),
  starts_on date not null,
  ends_on date not null,
  paymongo_checkout_id text unique,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists tournament_passes_facility_idx
  on public.tournament_passes (facility_id, starts_on, ends_on);

create or replace function public.facility_has_club_access(p_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.facility_billing b
    where b.facility_id = p_facility_id
      and (
        b.trial_ends_at > now()
        or (
          b.club_status = 'active'
          and b.club_period_end is not null
          and b.club_period_end > now()
        )
      )
  );
$$;

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

  return public.facility_has_tournament_access(
    v_facility,
    (now() at time zone coalesce(nullif(v_tz, ''), 'UTC'))::date
  );
end;
$$;

revoke all on function public.tournament_desk_open(text) from public;
grant execute on function public.tournament_desk_open(text) to anon, authenticated;

create or replace function public.start_facility_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.facility_billing (facility_id, trial_ends_at)
  values (new.id, now() + interval '7 days')
  on conflict (facility_id) do nothing;
  return new;
end;
$$;

drop trigger if exists facilities_start_trial on public.facilities;
create trigger facilities_start_trial
  after insert on public.facilities
  for each row execute function public.start_facility_trial();

-- Existing clubs get a fresh 7 days so applying this migration does not
-- lock a venue that was already running.
insert into public.facility_billing (facility_id, trial_ends_at)
select id, now() + interval '7 days'
from public.facilities
on conflict (facility_id) do nothing;

create or replace function public.reject_session_without_club()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.facility_has_club_access(
    (select facility_id from public.venues where id = new.venue_id)
  ) then
    raise exception 'Open play is locked' using errcode = 'P0403';
  end if;
  return new;
end;
$$;

drop trigger if exists sessions_require_club on public.sessions;
create trigger sessions_require_club
  before insert on public.sessions
  for each row execute function public.reject_session_without_club();

create or replace function public.reject_booking_without_club()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.facility_has_club_access(
    (select facility_id from public.venues where id = new.venue_id)
  ) then
    raise exception 'This club is not taking bookings' using errcode = 'P0403';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_require_club on public.bookings;
create trigger bookings_require_club
  before insert on public.bookings
  for each row execute function public.reject_booking_without_club();

drop trigger if exists coaching_bookings_require_club on public.coaching_bookings;
create trigger coaching_bookings_require_club
  before insert on public.coaching_bookings
  for each row execute function public.reject_booking_without_club();

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
     or not public.facility_has_tournament_access(
       v_facility,
       (now() at time zone coalesce(nullif(v_tz, ''), 'UTC'))::date
     ) then
    raise exception 'Tournament mode is locked' using errcode = 'P0403';
  end if;
  return new;
end;
$$;

drop trigger if exists tournaments_require_pass on public.tournaments;
create trigger tournaments_require_pass
  before insert or update on public.tournaments
  for each row execute function public.reject_tournament_without_pass();

-- Public requests go through security definer RPCs, which skip row policies.
-- Repeat the club check there so a direct call cannot bypass the trigger
-- intent if row_security is off. The insert trigger still runs.

create or replace function public.request_booking(
  p_venue_id uuid,
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_booked_by_name text,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
set row_security = off
as $$
declare
  v_token uuid;
  v_user uuid := auth.uid();
  v_email text;
begin
  if v_user is null then
    raise exception 'Sign in required to request a booking' using errcode = '42501';
  end if;

  if not public.facility_has_club_access(
    (select facility_id from public.venues where id = p_venue_id)
  ) then
    raise exception 'This club is not taking bookings' using errcode = 'P0403';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'Booking must end after it starts' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.courts
    where id = p_court_id and venue_id = p_venue_id
  ) then
    raise exception 'Court does not belong to this venue' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.bookings
    where court_id = p_court_id
      and status = 'confirmed'
      and ends_at > p_starts_at
      and starts_at < p_ends_at
  ) then
    raise exception 'That court is already booked for the selected time'
      using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.coaching_bookings
    where court_id = p_court_id
      and status = 'confirmed'
      and ends_at > p_starts_at
      and starts_at < p_ends_at
  ) then
    raise exception 'That court is already booked for the selected time'
      using errcode = '23P01';
  end if;

  v_email := nullif(trim(coalesce(p_contact_email, '')), '');
  if v_email is null then
    select email into v_email from auth.users where id = v_user;
  end if;

  insert into public.bookings (
    venue_id, court_id, starts_at, ends_at, status,
    booked_by_name, contact_email, contact_phone, notes, source, created_by
  )
  values (
    p_venue_id, p_court_id, p_starts_at, p_ends_at, 'pending',
    p_booked_by_name, v_email, p_contact_phone, p_notes, 'public', v_user
  )
  returning public_token into v_token;

  return v_token;
end;
$$;

create or replace function public.request_coaching_booking(
  p_venue_id uuid,
  p_coach_id uuid,
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_booked_by_name text,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
set row_security = off
as $$
declare
  v_token uuid;
  v_rate int;
  v_hours int;
  v_user uuid := auth.uid();
  v_email text;
begin
  if v_user is null then
    raise exception 'Sign in required to request a booking' using errcode = '42501';
  end if;

  if not public.facility_has_club_access(
    (select facility_id from public.venues where id = p_venue_id)
  ) then
    raise exception 'This club is not taking bookings' using errcode = 'P0403';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'Booking must end after it starts' using errcode = '22023';
  end if;

  select rate_cents into v_rate
  from public.coaches
  where id = p_coach_id
    and venue_id = p_venue_id
    and active = true;

  if v_rate is null then
    raise exception 'Coach does not belong to this venue' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.courts
    where id = p_court_id and venue_id = p_venue_id
  ) then
    raise exception 'Court does not belong to this venue' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.coaching_bookings
    where coach_id = p_coach_id
      and status = 'confirmed'
      and ends_at > p_starts_at
      and starts_at < p_ends_at
  ) then
    raise exception 'That coach is already booked for the selected time'
      using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.bookings
    where court_id = p_court_id
      and status = 'confirmed'
      and ends_at > p_starts_at
      and starts_at < p_ends_at
  )
  or exists (
    select 1 from public.coaching_bookings
    where court_id = p_court_id
      and status = 'confirmed'
      and ends_at > p_starts_at
      and starts_at < p_ends_at
  ) then
    raise exception 'That court is already booked for the selected time'
      using errcode = '23P01';
  end if;

  v_hours := greatest(
    1,
    round(extract(epoch from (p_ends_at - p_starts_at)) / 3600.0)::int
  );

  v_email := nullif(trim(coalesce(p_contact_email, '')), '');
  if v_email is null then
    select email into v_email from auth.users where id = v_user;
  end if;

  insert into public.coaching_bookings (
    venue_id, coach_id, court_id, starts_at, ends_at, status,
    booked_by_name, contact_email, contact_phone, notes,
    price_cents, payment_status, source, created_by
  )
  values (
    p_venue_id, p_coach_id, p_court_id, p_starts_at, p_ends_at, 'pending',
    p_booked_by_name, v_email, p_contact_phone, p_notes,
    v_rate * v_hours, 'unpaid', 'public', v_user
  )
  returning public_token into v_token;

  return v_token;
end;
$$;

create or replace function public.get_public_booking_venue(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'slug', v.slug,
    'timezone', v.timezone,
    'bookingOpenHour', v.booking_open_hour,
    'bookingCloseHour', v.booking_close_hour,
    'acceptingBookings', public.facility_has_club_access(v.facility_id),
    'courts', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', c.id, 'name', c.name)
        order by c.sort_order, c.name
      )
      from public.courts c
      where c.venue_id = v.id
    ), '[]'::jsonb)
  )
  from public.venues v
  where v.slug = p_slug;
$$;

alter table public.facility_billing enable row level security;
alter table public.tournament_passes enable row level security;

drop policy if exists "Owners read facility billing" on public.facility_billing;
create policy "Owners read facility billing"
  on public.facility_billing for select to authenticated
  using (
    exists (
      select 1
      from public.venues v
      join public.venue_members vm on vm.venue_id = v.id
      where v.facility_id = facility_billing.facility_id
        and vm.user_id = auth.uid()
        and vm.role in ('owner', 'admin')
    )
  );

drop policy if exists "Owners read tournament passes" on public.tournament_passes;
create policy "Owners read tournament passes"
  on public.tournament_passes for select to authenticated
  using (
    exists (
      select 1
      from public.venues v
      join public.venue_members vm on vm.venue_id = v.id
      where v.facility_id = tournament_passes.facility_id
        and vm.user_id = auth.uid()
        and vm.role in ('owner', 'admin')
    )
  );

grant select on public.facility_billing to authenticated;
grant select on public.tournament_passes to authenticated;

alter table public.paymongo_payments enable row level security;
revoke all on public.paymongo_payments from anon, authenticated;
