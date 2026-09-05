-- Coaching sessions occupy a court as well as a coach.
-- Confirmed coaching blocks both the coach calendar and the court calendar
-- (rentals + open play), so the two booking types cannot double-book a court.

alter table public.coaching_bookings
  add column if not exists court_id uuid references public.courts(id) on delete restrict;

-- Drop any sessions created before courts were required (dev / early testing).
delete from public.coaching_bookings where court_id is null;

do $$ begin
  alter table public.coaching_bookings
    alter column court_id set not null;
exception
  when others then null;
end $$;

create index if not exists coaching_bookings_court_starts_idx
  on public.coaching_bookings (court_id, starts_at);

do $$ begin
  alter table public.coaching_bookings
    add constraint coaching_bookings_court_no_overlap
    exclude using gist (
      court_id with =,
      tstzrange(starts_at, ends_at) with &&
    ) where (status = 'confirmed');
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

-- Court busy ranges include confirmed coaching so public + staff calendars match.
create or replace function public.get_court_busy_ranges(
  p_venue_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (court_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select b.court_id, b.starts_at, b.ends_at
  from public.bookings b
  where b.venue_id = p_venue_id
    and b.status = 'confirmed'
    and b.ends_at > p_from
    and b.starts_at < p_to
  union all
  select cb.court_id, cb.starts_at, cb.ends_at
  from public.coaching_bookings cb
  where cb.venue_id = p_venue_id
    and cb.status = 'confirmed'
    and cb.ends_at > p_from
    and cb.starts_at < p_to
  order by starts_at;
$$;

-- Court rental requests also refuse times held by confirmed coaching.
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
begin
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

  insert into public.bookings (
    venue_id, court_id, starts_at, ends_at, status,
    booked_by_name, contact_email, contact_phone, notes, source
  )
  values (
    p_venue_id, p_court_id, p_starts_at, p_ends_at, 'pending',
    p_booked_by_name, p_contact_email, p_contact_phone, p_notes, 'public'
  )
  returning public_token into v_token;

  return v_token;
end;
$$;

drop function if exists public.request_coaching_booking(
  uuid, uuid, timestamptz, timestamptz, text, text, text, text
);

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
begin
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

  insert into public.coaching_bookings (
    venue_id, coach_id, court_id, starts_at, ends_at, status,
    booked_by_name, contact_email, contact_phone, notes,
    price_cents, payment_status, source
  )
  values (
    p_venue_id, p_coach_id, p_court_id, p_starts_at, p_ends_at, 'pending',
    p_booked_by_name, p_contact_email, p_contact_phone, p_notes,
    v_rate * v_hours, 'unpaid', 'public'
  )
  returning public_token into v_token;

  return v_token;
end;
$$;

grant execute on function public.request_coaching_booking(
  uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, text
) to anon, authenticated;

create or replace function public.get_coaching_request_status(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
    'kind', 'coaching',
    'status', b.status,
    'bookedByName', b.booked_by_name,
    'startsAt', b.starts_at,
    'endsAt', b.ends_at,
    'venueName', v.name,
    'venueSlug', v.slug,
    'venueTimezone', v.timezone,
    'coachName', c.name,
    'courtName', ct.name,
    'priceCents', b.price_cents
  )
  from public.coaching_bookings b
  join public.venues v on v.id = b.venue_id
  join public.coaches c on c.id = b.coach_id
  join public.courts ct on ct.id = b.court_id
  where b.public_token = p_token
    and b.source = 'public';
$$;
